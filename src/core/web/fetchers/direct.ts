import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatSize } from "../../truncate.ts";
import type { FetchedDocument, FetchFailure, WebFetcher } from "../contract.ts";
import { nameForImage, RESOURCE_HEADER_BYTES } from "../images.ts";
import { getErrorMessage, slugify } from "../shared.ts";

const TIMEOUT_MS = 30_000;

// One plain GET per URL, saving the body exactly as the server sent it. `web_fetch` runs it for
// `raw` calls, ahead of the browser, so a page comes back as its served HTML rather than as text.
export function createDirectFetcher(): WebFetcher {
  async function fetchOne(
    url: string,
    artifactDir: string,
    signal: AbortSignal | undefined,
  ): Promise<FetchedDocument> {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const response = await fetch(url, {
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const body = Buffer.from(await response.arrayBuffer());
    const declared = response.headers.get("content-type") ?? "application/octet-stream";
    const served = path.posix.basename(new URL(response.url || url).pathname) || "index";
    const { name, image } = nameForImage(served, body.subarray(0, RESOURCE_HEADER_BYTES));
    const file = path.join(artifactDir, slugify(url) || "document", name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return {
      kind: "direct.file",
      source: "direct",
      url,
      ...(response.url && response.url !== url ? { link: response.url } : {}),
      title: name,
      facts: [image ?? declared, formatSize(body.byteLength)],
      bodies: [{ name, path: file, lines: 0, bytes: body.byteLength }],
    };
  }

  return {
    source: "direct",
    promptGuidelines: [],
    canFetch: (url) => /^https?:$/.test(URL.parse(url)?.protocol ?? ""),
    async fetch({ urls, artifactDir, signal }) {
      const documents: FetchedDocument[] = [];
      const failures: FetchFailure[] = [];
      await Promise.all(
        urls.map(async (url) => {
          try {
            documents.push(await fetchOne(url, artifactDir, signal));
          } catch (error) {
            if (signal?.aborted) throw error;
            failures.push({ url, reason: getErrorMessage(error) });
          }
        }),
      );
      return { documents, failures, warnings: [] };
    },
  };
}
