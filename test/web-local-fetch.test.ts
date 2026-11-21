import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalFetcher } from "../src/core/web/fetchers/local/local.ts";

async function fetchFile(url: string, name: string, contentType: string, body: Buffer) {
  const artifactDir = await mkdtemp(path.join(tmpdir(), "librarian-local-"));
  const fetcher = createLocalFetcher(
    {
      fetch: async (finalUrl, downloadDir) => {
        await mkdir(downloadDir, { recursive: true });
        await writeFile(path.join(downloadDir, name), body);
        return {
          finalUrl,
          name,
          contentType,
          bytes: body.byteLength,
          notes: ["installed Playwright's Chromium"],
        };
      },
      openBrowser: async () => {},
      restart: async () => {},
    },
    { name: "unused", extractToMarkdown: async () => "" },
  );
  const { documents } = await fetcher.fetch({ urls: [url], artifactDir });
  return { document: documents[0], artifactDir };
}

describe("createLocalFetcher", () => {
  it("addresses a downloaded file by its absolute path, with the worker's notes as facts", async () => {
    const { document, artifactDir } = await fetchFile(
      "https://example.com/report.pdf",
      "report.pdf",
      "application/pdf",
      Buffer.alloc(2048, 1),
    );

    expect(document?.bodies).toEqual([
      {
        name: "report.pdf",
        path: path.join(artifactDir, "example-com-report-pdf", "report.pdf"),
        lines: 0,
        bytes: 2048,
      },
    ]);
    expect(document?.facts).toEqual([
      "application/pdf",
      "2.0KB",
      "installed Playwright's Chromium",
    ]);
  });

  it("names an image download for the type its bytes show, not the browser's label", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const { document, artifactDir } = await fetchFile(
      "https://cdn.example/3ff011af",
      "3ff011af",
      "application/octet-stream",
      jpeg,
    );

    const dir = path.join(artifactDir, "cdn-example-3ff011af");
    expect(await readdir(dir)).toEqual(["3ff011af.jpg"]);
    expect(document?.bodies[0]?.path).toBe(path.join(dir, "3ff011af.jpg"));
    expect(document?.facts[0]).toBe("image/jpeg");
  });

  it("keeps a .jpeg name as it is", async () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const { document } = await fetchFile(
      "https://cdn.example/photo.jpeg",
      "photo.jpeg",
      "application/octet-stream",
      jpeg,
    );

    expect(document?.bodies[0]?.name).toBe("photo.jpeg");
  });
});
