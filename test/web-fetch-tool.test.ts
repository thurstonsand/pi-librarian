import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Value } from "typebox/value";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebFetcher } from "../src/core/web/contract.ts";
import { createWebFetchTool } from "../src/core/web/fetch.ts";
import { createDirectFetcher } from "../src/core/web/fetchers/direct.ts";
import { createLocalFetcher } from "../src/core/web/fetchers/local/local.ts";
import { createImageFetcher } from "../src/core/web/images.ts";
import { fakeWorker } from "./support/fake-worker.ts";
import { stubFetch } from "./support/fetch-stub.ts";

const fetcher: WebFetcher = {
  source: "test",
  promptGuidelines: ["Fetcher-specific guidance."],
  canFetch: () => false,
  async fetch() {
    return { documents: [], failures: [], warnings: [] };
  },
};

describe("web_fetch prompt guidance", () => {
  it("assembles fetcher guidance with its own general guidance", () => {
    const tool = createWebFetchTool([fetcher], [], "/tmp/cache");

    expect(tool.promptGuidelines).toEqual([
      "Fetcher-specific guidance.",
      "Use web_fetch when you already have a specific URL and need more than search snippets.",
    ]);
  });
});

describe("web_fetch structured content", () => {
  it("matches the output schema and addresses bodies absolutely", async () => {
    const artifactDirs: string[] = [];
    const tool = createWebFetchTool(
      [
        {
          source: "test",
          promptGuidelines: [],
          canFetch: (url) => url.startsWith("https://ok."),
          async fetch({ urls, artifactDir }) {
            artifactDirs.push(artifactDir);
            return {
              documents: urls.map((url) => ({
                kind: "page",
                source: "test",
                url,
                link: undefined,
                title: "OK",
                facts: ["1 body"],
                excerpt: undefined,
                bodies: [
                  { name: "page.md", path: "/tmp/pi-fetch/run/ok/page.md", lines: 3, bytes: 42 },
                ],
              })),
              failures: [],
              warnings: [{ message: "slow" }],
            };
          },
        },
      ],
      [],
      "/tmp/cache",
    );

    const result = await tool.execute(
      "call:1",
      { urls: ["https://ok.example", "https://nope.example"] },
      undefined,
    );

    if (!tool.outputSchema) throw new Error("web_fetch declares no outputSchema");
    expect(Value.Check(tool.outputSchema, result.structuredContent)).toBe(true);
    expect(result.structuredContent).toEqual({
      documents: [
        {
          url: "https://ok.example",
          kind: "page",
          source: "test",
          title: "OK",
          facts: ["1 body"],
          bodies: [
            {
              name: "page.md",
              path: "/tmp/pi-fetch/run/ok/page.md",
              lines: 3,
              bytes: 42,
            },
          ],
        },
      ],
      failed: [{ url: "https://nope.example", attempts: [] }],
      warnings: [{ message: "slow" }],
    });
    expect(artifactDirs).toEqual(["/tmp/cache/fetches/call_1"]);
  });
});

describe("web_fetch image URLs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves what its bytes say is an image, and passes everything else down the chain", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "librarian-fetch-"));
    // Longer than the 1445 bytes sniffing reads, so the rest of the body must still be kept.
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(4000, 7),
    ]);
    stubFetch([
      (request) =>
        request.url.pathname === "/repository-image"
          ? new Response(png, { headers: { "content-type": "binary/data" } })
          : undefined,
      (request) =>
        request.url.pathname === "/hotlinked.jpg"
          ? new Response("refused", { status: 403, headers: { "content-type": "text/html" } })
          : undefined,
      () => new Response("<html>a page</html>", { headers: { "content-type": "text/html" } }),
    ]);
    const fallback: WebFetcher = {
      source: "fallback",
      promptGuidelines: [],
      canFetch: () => true,
      async fetch({ urls }) {
        return {
          documents: urls.map((url) => ({
            kind: "page",
            source: "fallback",
            url,
            title: "Page",
            facts: [],
            bodies: [],
          })),
          failures: [],
          warnings: [],
        };
      },
    };
    const tool = createWebFetchTool([createImageFetcher(), fallback], [], cacheDir);

    const result = await tool.execute(
      "call",
      {
        urls: [
          "https://cdn.example/repository-image",
          "https://cdn.example/hotlinked.jpg",
          "https://docs.example/diagram.png",
        ],
      },
      undefined,
    );

    const [image, hotlinked, page] = result.details?.outcomes ?? [];
    expect(image?.document?.facts[0]).toBe("image/png");
    const body = image?.document?.bodies[0];
    expect(body?.name).toBe("image.png");
    expect(await readFile(body?.path ?? "")).toEqual(png);
    expect(hotlinked?.document?.source).toBe("fallback");
    expect(hotlinked?.attempts).toEqual([
      { source: "image", url: "https://cdn.example/hotlinked.jpg", reason: "HTTP 403" },
    ]);
    expect(page?.document?.source).toBe("fallback");
    expect(page?.attempts).toEqual([]);
  });
});

describe("web_fetch raw", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps each URL as served, from plain HTTP or else the browser, never extracted", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "librarian-raw-"));
    const served = "<html><body><h1>Served</h1></body></html>";
    const rendered = "<html><body><h1>Rendered</h1></body></html>";
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    stubFetch([
      (request) =>
        request.url.pathname === "/docs/guide"
          ? new Response(served, { headers: { "content-type": "text/html; charset=utf-8" } })
          : undefined,
      () => new Response("refused", { status: 403, headers: { "content-type": "text/html" } }),
    ]);
    const described: string[] = [];
    const describer: WebFetcher = {
      source: "describer",
      promptGuidelines: [],
      canFetch: () => true,
      async fetch({ urls }) {
        described.push(...urls);
        return { documents: [], failures: [], warnings: [] };
      },
    };
    const worker = fakeWorker({
      "https://walled.example/page": {
        name: "page.html",
        contentType: "text/html",
        body: rendered,
      },
      "https://cdn.example/hotlinked": {
        name: "hotlinked",
        contentType: "application/octet-stream",
        body: jpeg,
      },
    });
    const tool = createWebFetchTool(
      [describer],
      [createDirectFetcher(), createLocalFetcher(worker, null)],
      cacheDir,
    );

    const result = await tool.execute(
      "call",
      {
        urls: [
          "https://docs.example/docs/guide",
          "https://walled.example/page",
          "https://cdn.example/hotlinked",
        ],
        raw: true,
      },
      undefined,
    );

    expect(described).toEqual([]);
    const [page, walled, image] = result.details?.outcomes ?? [];
    expect(page?.document?.source).toBe("direct");
    expect(await readFile(page?.document?.bodies[0]?.path ?? "", "utf8")).toBe(served);
    expect(walled?.document?.source).toBe("local");
    expect(await readFile(walled?.document?.bodies[0]?.path ?? "", "utf8")).toBe(rendered);
    expect(image?.document?.bodies[0]?.name).toBe("hotlinked.jpg");
    expect(image?.document?.facts[0]).toBe("image/jpeg");
    expect(image?.attempts).toEqual([
      { source: "direct", url: "https://cdn.example/hotlinked", reason: "HTTP 403" },
    ]);
  });
});
