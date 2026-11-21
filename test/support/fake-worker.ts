import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FetchWorkerClient } from "../../src/core/web/fetchers/local/worker-connection.ts";

// The fetch browser as its client sees it: each answer is written where the real worker would
// write it, and a missing answer is a fetch the browser could not complete.
export function fakeWorker(
  pages: Record<string, { name: string; contentType: string; body: Buffer | string }>,
): FetchWorkerClient {
  return {
    async fetch(url, downloadDir) {
      const page = pages[url];
      if (!page) throw new Error("navigation failed");
      await mkdir(downloadDir, { recursive: true });
      await writeFile(path.join(downloadDir, page.name), page.body);
      const bytes = Buffer.byteLength(page.body);
      return { finalUrl: url, name: page.name, contentType: page.contentType, bytes, notes: [] };
    },
    openBrowser: async () => {},
    restart: async () => {},
  };
}
