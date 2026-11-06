import { describe, expect, it } from "vitest";
import { createLocalFetcher } from "../src/core/web/fetchers/local/local.ts";

describe("createLocalFetcher", () => {
  it("addresses a downloaded file by its absolute path, with the worker's notes as facts", async () => {
    const fetcher = createLocalFetcher(
      {
        fetch: async () => ({
          finalUrl: "https://example.com/report.pdf",
          name: "report.pdf",
          contentType: "application/pdf",
          bytes: 2048,
          notes: ["installed Playwright's Chromium"],
        }),
        openBrowser: async () => {},
        restart: async () => {},
      },
      { name: "unused", extractToMarkdown: async () => "" },
    );

    const { documents } = await fetcher.fetch({
      urls: ["https://example.com/report.pdf"],
      artifactDir: "/tmp/pi-fetch/run",
    });

    expect(documents[0]?.bodies).toEqual([
      {
        name: "report.pdf",
        path: "/tmp/pi-fetch/run/example-com-report-pdf/report.pdf",
        lines: 0,
        bytes: 2048,
      },
    ]);
    expect(documents[0]?.facts).toEqual([
      "application/pdf",
      "2.0KB",
      "installed Playwright's Chromium",
    ]);
  });
});
