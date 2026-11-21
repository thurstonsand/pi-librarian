import { open, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { formatSize } from "../../../truncate.ts";
import type { FetchedDocument, FetcherResult, FetchFailure, WebFetcher } from "../../contract.ts";
import { nameForImage, RESOURCE_HEADER_BYTES } from "../../images.ts";
import { getErrorMessage, slugify, writeDocumentBody } from "../../shared.ts";
import type { Extractor } from "./local-extractor.ts";
import type { FetchWorkerClient } from "./worker-connection.ts";
import type { WorkerFetchCompletion } from "./worker-protocol.ts";

// With a null extractor, a page is kept as the HTML the browser rendered, for callers that want the
// source rather than its text.
export function createLocalFetcher(
  client: FetchWorkerClient,
  extractor: Extractor | null,
): WebFetcher {
  async function fetchOne(url: string, artifactDir: string): Promise<FetchedDocument> {
    const slug = slugify(url) || "document";
    const downloadDir = path.join(artifactDir, slug);
    const result = await client.fetch(url, downloadDir);
    const file = path.join(downloadDir, result.name);
    if (extractor && isHtmlContentType(result.contentType)) {
      return buildPageDocument(extractor, url, artifactDir, file, result);
    }
    return await buildFileDocument(url, file, result);
  }

  async function buildPageDocument(
    extractor: Extractor,
    url: string,
    artifactDir: string,
    file: string,
    result: WorkerFetchCompletion,
  ): Promise<FetchedDocument> {
    const markdown = (await extractor.extractToMarkdown(file, url)).trim();
    if (!markdown) throw new Error(`${extractor.name} extracted no content`);
    const body = await writeDocumentBody(artifactDir, url, "content.md", `${markdown}\n`);
    await unlink(file);
    return {
      kind: "local.page",
      source: "local",
      url,
      ...(result.finalUrl !== url ? { link: result.finalUrl } : {}),
      title: result.title || result.finalUrl,
      facts: result.notes,
      excerpt: markdown,
      bodies: [body],
    };
  }

  async function buildFileDocument(
    url: string,
    file: string,
    result: WorkerFetchCompletion,
  ): Promise<FetchedDocument> {
    const handle = await open(file);
    const head = Buffer.alloc(RESOURCE_HEADER_BYTES);
    const { bytesRead } = await handle.read(head, 0, head.length, 0).finally(() => handle.close());
    const { name, image } = nameForImage(path.basename(file), head.subarray(0, bytesRead));
    const saved = path.join(path.dirname(file), name);
    if (saved !== file) await rename(file, saved);
    return {
      kind: "local.file",
      source: "local",
      url,
      ...(result.finalUrl !== url ? { link: result.finalUrl } : {}),
      title: name,
      facts: [image ?? result.contentType, formatSize(result.bytes), ...result.notes],
      bodies: [{ name, path: saved, lines: 0, bytes: result.bytes }],
    };
  }

  return {
    source: "local",
    promptGuidelines: [],
    canFetch: isHttpUrl,
    async fetch({ urls, artifactDir, signal }): Promise<FetcherResult> {
      const documents: FetchedDocument[] = [];
      const failures: FetchFailure[] = [];
      await Promise.all(
        urls.map(async (url) => {
          if (signal?.aborted) {
            failures.push({ url, reason: "Fetch cancelled." });
            return;
          }
          try {
            documents.push(await fetchOne(url, artifactDir));
          } catch (error) {
            failures.push({ url, reason: getErrorMessage(error) });
          }
        }),
      );
      return { documents, failures, warnings: [] };
    },
  };
}

function isHttpUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

function isHtmlContentType(contentType: string): boolean {
  const mime = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  return mime === "text/html" || mime === "application/xhtml+xml";
}
