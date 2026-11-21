import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatSize } from "../truncate.ts";
import type { FetchedDocument, FetchFailure, FetchWarning, WebFetcher } from "./contract.ts";
import type { FetchWorkerClient } from "./fetchers/local/worker-connection.ts";
import type { ParallelImageHit } from "./parallel.ts";
import { formatWarnings, getErrorMessage, slugify } from "./shared.ts";

// One slow host must not hold the whole search hostage; images that finish keep their files.
const DOWNLOAD_TIMEOUT_MS = 15_000;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/bmp": "bmp",
  "image/x-icon": "ico",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

export interface ImageFile {
  path: string;
  contentType: string;
  bytes: number;
}

export interface SavedImage extends ParallelImageHit {
  download: ImageFile | { error: string };
}

// The WHATWG MIME Sniffing standard's image patterns (§6.1), with null for its masked-out bytes.
// Enough of a resource to sniff it is its first 1445 bytes (§5.2).
export const RESOURCE_HEADER_BYTES = 1445;
const IMAGE_PATTERNS: [string, (number | null)[]][] = [
  ["image/x-icon", [0x00, 0x00, 0x01, 0x00]],
  ["image/x-icon", [0x00, 0x00, 0x02, 0x00]],
  ["image/bmp", [0x42, 0x4d]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]],
  ["image/gif", [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  [
    "image/webp",
    [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50],
  ],
  ["image/png", [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
];

export function sniffImage(bytes: Uint8Array): string | undefined {
  return IMAGE_PATTERNS.find(
    ([, pattern]) =>
      bytes.length >= pattern.length &&
      pattern.every((byte, i) => byte === null || byte === bytes[i]),
  )?.[0];
}

// A file named for what its bytes are when they are an image, so an agent's file reader opens it as
// one: servers and the browser name files after URLs, which often carry no extension or the wrong one.
export function nameForImage(name: string, head: Uint8Array): { name: string; image?: string } {
  const image = sniffImage(head);
  if (!image) return { name };
  const extension = path
    .extname(name)
    .slice(1)
    .toLowerCase()
    .replace(/^jpeg$/, "jpg");
  return extension === imageExtension(image)
    ? { name, image }
    : { name: `${name}.${imageExtension(image)}`, image };
}

export function imageExtension(contentType: string): string {
  return EXTENSIONS[contentType] ?? contentType.slice("image/".length).replace(/[^a-z0-9]+/g, "-");
}

class NotAnImageError extends Error {
  constructor(declared: string) {
    super(`not an image (${declared || "no content type"})`);
  }
}

function essence(contentType: string | null): string {
  return contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
}

// The standard's order for an image (§8.2): a declared XML type such as SVG stands, then the bytes,
// then the declared type. A server's header alone is wrong often enough: CDNs serve webp from
// `.png` paths, and the browser labels its downloads octet-stream.
function imageType(declared: string, head: Uint8Array): string {
  if (declared.startsWith("image/") && declared.endsWith("+xml")) return declared;
  const sniffed = sniffImage(head);
  if (sniffed) return sniffed;
  if (declared.startsWith("image/")) return declared;
  throw new NotAnImageError(declared);
}

async function writeImage(stem: string, contentType: string, body: Buffer): Promise<ImageFile> {
  const file = `${stem}.${imageExtension(contentType)}`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
  return { path: file, contentType, bytes: body.byteLength };
}

// One GET, decided from its first bytes the way link unfurlers do, whatever type the server
// declares (hosts label images octet-stream, binary/data, or nothing): a body that is not an image
// is cancelled once its resource header is read, and an image is read to the end.
async function downloadDirect(
  url: string,
  stem: string,
  signal: AbortSignal | undefined,
): Promise<ImageFile> {
  const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  const response = await fetch(url, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const declared = essence(response.headers.get("content-type"));
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    throw new NotAnImageError(declared);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let contentType: string | undefined;
  try {
    for (;;) {
      if (contentType === undefined && size >= RESOURCE_HEADER_BYTES) {
        contentType = imageType(declared, Buffer.concat(chunks));
      }
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } catch (error) {
    await reader.cancel();
    throw error;
  }
  const body = Buffer.concat(chunks);
  return writeImage(stem, contentType ?? imageType(declared, body), body);
}

// The worker writes into a directory of its own per image, since two results can share a file name.
async function downloadThroughBrowser(
  worker: FetchWorkerClient,
  url: string,
  stem: string,
): Promise<ImageFile> {
  const dir = `${stem}.browser`;
  try {
    const result = await worker.fetch(url, dir);
    const body = await readFile(path.join(dir, result.name));
    return await writeImage(stem, imageType(essence(result.contentType), body), body);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export type ImageDownloader = (
  url: string,
  stem: string,
  signal: AbortSignal | undefined,
) => Promise<ImageFile>;

// Plain HTTP first; any failure retries in the fetch browser, whose real browser and profile pass the
// bot checks and hotlink rules that refuse a bare client. Which status means "not a browser" varies
// by host (403, 429, a 200 HTML page), so every failure gets the retry, as in web_fetch's chain.
export function createImageDownloader(worker: FetchWorkerClient): ImageDownloader {
  return async (url, stem, signal) => {
    try {
      return await downloadDirect(url, stem, signal);
    } catch (direct) {
      if (signal?.aborted) throw direct;
      try {
        return await downloadThroughBrowser(worker, url, stem);
      } catch (browser) {
        throw new Error(`${getErrorMessage(direct)} → browser: ${getErrorMessage(browser)}`);
      }
    }
  };
}

export function saveImages(
  download: ImageDownloader,
  hits: ParallelImageHit[],
  dir: string,
  signal: AbortSignal | undefined,
): Promise<SavedImage[]> {
  return Promise.all(
    hits.map(async (hit, index): Promise<SavedImage> => {
      try {
        const file = await download(hit.image_url, path.join(dir, `${index + 1}`), signal);
        return { ...hit, download: file };
      } catch (error) {
        if (signal?.aborted) throw error;
        return { ...hit, download: { error: getErrorMessage(error) } };
      }
    }),
  );
}

export function buildImageSearchSummary(
  images: SavedImage[],
  dir: string,
  warnings: FetchWarning[],
): string {
  const warningLines = formatWarnings(warnings);
  const sections: string[] = [];
  if (warningLines.length > 0) {
    sections.push(["Warnings:", ...warningLines.map((warning) => `- ${warning}`)].join("\n"));
  }
  if (images.length === 0) {
    sections.push("No results.");
    return sections.join("\n\n");
  }
  sections.push(
    `Images (in ${dir}/):`,
    ...images.map((image, index) => {
      const { download } = image;
      const file =
        "error" in download
          ? `download failed: ${download.error}`
          : [
              path.basename(download.path),
              ...(image.width && image.height ? [`${image.width}×${image.height}`] : []),
              download.contentType,
              formatSize(download.bytes),
            ].join(" · ");
      return [
        `${index + 1}. ${image.title}`,
        `   ${file}`,
        `   page: ${image.source_page_url}`,
        `   image: ${image.image_url}`,
      ].join("\n");
    }),
  );
  return sections.join("\n\n");
}

// Claims every web URL and keeps the images among them, so an image URL without an extension is
// saved as the file rather than described in words by Parallel. A URL that is not an image, or that
// refuses a plain request, passes on to the rest of the chain; the local fetcher is its browser
// retry, since retrying here would send every refused page through the browser before Parallel.
export function createImageFetcher(): WebFetcher {
  return {
    source: "image",
    promptGuidelines: [],
    canFetch: (url) => /^https?:$/.test(URL.parse(url)?.protocol ?? ""),
    async fetch({ urls, artifactDir, signal }) {
      const documents: FetchedDocument[] = [];
      const failures: FetchFailure[] = [];
      await Promise.all(
        urls.map(async (url) => {
          try {
            const file = await downloadDirect(
              url,
              path.join(artifactDir, slugify(url) || "image", "image"),
              signal,
            );
            const name = path.basename(file.path);
            documents.push({
              kind: "image.file",
              source: "image",
              url,
              title: path.posix.basename(new URL(url).pathname) || name,
              facts: [file.contentType, formatSize(file.bytes)],
              bodies: [{ name, path: file.path, lines: 0, bytes: file.bytes }],
            });
          } catch (error) {
            if (error instanceof NotAnImageError) return;
            failures.push({ url, reason: getErrorMessage(error) });
          }
        }),
      );
      return { documents, failures, warnings: [] };
    },
  };
}
