import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { resetCapabilitiesCache, setCapabilities } from "@earendil-works/pi-tui";
import { Value } from "typebox/value";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createImageDownloader, type ImageDownloader } from "../src/core/web/images.ts";
import { ParallelClient } from "../src/core/web/parallel.ts";
import { createWebSearchTool } from "../src/core/web/search.ts";
import { withWebSearchRendering } from "../src/pi/web-render.ts";
import { fakeWorker } from "./support/fake-worker.ts";
import { stubFetch } from "./support/fetch-stub.ts";

const noDownloads: ImageDownloader = async () => {
  throw new Error("this test downloads no images");
};

function toolWithResponse(response: unknown, status = 200) {
  const requests = stubFetch([() => Response.json(response, { status })]);
  const tool = createWebSearchTool(
    new ParallelClient({ apiKey: "key-1", apiKeyCommand: undefined }),
    noDownloads,
    "/tmp/librarian-cache",
  );
  return { tool, requests };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("web_search request", () => {
  it("posts the search to Parallel with the key in its header", async () => {
    const { tool, requests } = toolWithResponse({ results: [], warnings: null });

    await tool.execute(
      "call",
      {
        objective: "drizzle releases",
        search_queries: ["drizzle 1.0"],
        max_results: 3,
        after_date: "2026-01-01",
      },
      undefined,
    );

    expect(requests.map((request) => [request.method, request.url.href])).toEqual([
      ["POST", "https://api.parallel.ai/v1/search"],
    ]);
    expect(requests[0]?.headers.get("x-api-key")).toBe("key-1");
    expect(JSON.parse(requests[0]?.body ?? "")).toEqual({
      objective: "drizzle releases",
      search_queries: ["drizzle 1.0"],
      mode: "advanced",
      advanced_settings: { max_results: 3, source_policy: { after_date: "2026-01-01" } },
    });
  });

  it("reports Parallel's own error message", async () => {
    const { tool } = toolWithResponse(
      { type: "error", error: { ref_id: "search_1", message: "Request validation error" } },
      422,
    );

    await expect(tool.execute("call", { objective: "test" }, undefined)).rejects.toThrow(
      "Parallel search failed: Parallel search returned HTTP 422: Request validation error",
    );
  });

  it("reports the gateway's message when it refuses the key", async () => {
    const { tool } = toolWithResponse({ code: 16, message: "Invalid API key (C.1)" }, 401);

    await expect(tool.execute("call", { objective: "test" }, undefined)).rejects.toThrow(
      "Parallel search failed: Parallel search returned HTTP 401: Invalid API key (C.1)",
    );
  });
});

describe("web_search structured content", () => {
  it("omits fields Parallel returns as null", async () => {
    const { tool } = toolWithResponse({
      results: [
        { url: "https://a.example", title: "A", publish_date: "2026-09-01", excerpts: ["a"] },
        { url: "https://b.example", title: null, publish_date: null, excerpts: [] },
      ],
      warnings: [{ message: "partial", type: "warning" }],
    });

    const result = await tool.execute("call", { objective: "test" }, undefined);

    if (!tool.outputSchema) throw new Error("web_search declares no outputSchema");
    expect(Value.Check(tool.outputSchema, result.structuredContent)).toBe(true);
    expect(result.structuredContent).toEqual({
      results: [
        { url: "https://a.example", title: "A", publish_date: "2026-09-01", excerpts: ["a"] },
        { url: "https://b.example", excerpts: [] },
      ],
      warnings: [{ message: "partial", type: "warning" }],
    });
  });

  it("rejects a response that does not match Parallel's contract", async () => {
    const { tool } = toolWithResponse({ results: [{ url: "https://a.example" }] });

    await expect(tool.execute("call", { objective: "test" }, undefined)).rejects.toThrow(
      "Parallel search failed: Parallel search response: /results/0 must have required properties excerpts",
    );
  });
});

describe("web_search result rows", () => {
  afterEach(() => {
    resetCapabilitiesCache();
  });

  const render = () =>
    withWebSearchRendering(
      createWebSearchTool(
        new ParallelClient({ apiKey: "key-1", apiKeyCommand: undefined }),
        noDownloads,
        "/tmp/librarian-cache",
      ),
    )
      .renderResult?.(
        {
          content: [],
          details: { count: 1, results: [{ url: "https://a.example/page", title: "A page" }] },
        },
        { expanded: false, isPartial: false },
        { fg: (_color: string, text: string) => text } as unknown as Theme,
        { state: {}, isError: false, invalidate: vi.fn() } as never,
      )
      .render(80)
      .join("\n");

  it("links each title to its result when the terminal supports hyperlinks", () => {
    setCapabilities({ images: null, trueColor: true, hyperlinks: true });
    expect(render()).toContain("\x1b]8;;https://a.example/page\x1b\\1. A page\x1b]8;;\x1b\\");
  });

  it("leaves titles as plain text when the terminal does not support hyperlinks", () => {
    setCapabilities({ images: null, trueColor: true, hyperlinks: false });
    expect(render()).toContain("1. A page");
    expect(render()).not.toContain("\x1b]8;;");
  });
});

describe("web_search images", () => {
  const webp = Buffer.from("RIFF....WEBPVP8 fake");
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

  it("downloads each image, through the fetch browser when plain HTTP is refused", async () => {
    const cacheDir = await mkdtemp(path.join(tmpdir(), "librarian-images-"));
    const hit = (title: string, image_url: string) => ({
      title,
      image_url,
      source_page_url: "https://docs.example/page",
      width: null,
      height: null,
    });
    const requests = stubFetch([
      (request) =>
        request.url.pathname === "/v1/images/search"
          ? Response.json({
              search_id: "search_1",
              session_id: "session_1",
              results: [
                { ...hit("Table", "https://cdn.example/table.png"), width: 768, height: 454 },
                hit("Hotlinked", "https://cdn.example/hotlinked"),
                hit("Gone", "https://cdn.example/gone.jpg"),
              ],
              warnings: null,
            })
          : undefined,
      (request) =>
        request.url.href === "https://cdn.example/table.png"
          ? new Response(webp, { headers: { "content-type": "image/png" } })
          : undefined,
      () => new Response("refused", { status: 403, headers: { "content-type": "text/html" } }),
    ]);
    const worker = fakeWorker({
      "https://cdn.example/hotlinked": {
        name: "hotlinked",
        contentType: "application/octet-stream",
        body: jpeg,
      },
    });
    const tool = createWebSearchTool(
      new ParallelClient({ apiKey: "key-1", apiKeyCommand: undefined }),
      createImageDownloader(worker),
      cacheDir,
    );

    const result = await tool.execute(
      "call:1",
      { objective: "shadcn data table", search_queries: ["shadcn table"], images: true },
      undefined,
    );

    expect(JSON.parse(requests[0]?.body ?? "")).toEqual({
      objective: "shadcn data table",
      search_queries: ["shadcn table"],
      mode: "advanced",
      advanced_settings: { max_results: 5 },
    });
    const dir = path.join(cacheDir, "images", "call_1");
    expect(await readFile(path.join(dir, "1.webp"))).toEqual(webp);
    expect(await readFile(path.join(dir, "2.jpg"))).toEqual(jpeg);
    expect((await readdir(dir)).sort()).toEqual(["1.webp", "2.jpg"]);
    if (!tool.outputSchema) throw new Error("web_search declares no outputSchema");
    expect(Value.Check(tool.outputSchema, result.structuredContent)).toBe(true);
    expect(result.structuredContent).toMatchObject({
      images: [
        { title: "Table", width: 768, height: 454, content_type: "image/webp" },
        { title: "Hotlinked", path: path.join(dir, "2.jpg"), content_type: "image/jpeg" },
        { title: "Gone", error: "HTTP 403 → browser: navigation failed" },
      ],
    });
    expect(result.content[0]?.text).toContain(`Images (in ${dir}/):`);
    expect(result.content[0]?.text).toContain("1.webp · 768×454 · image/webp");
    expect(result.content[0]?.text).toContain(
      "download failed: HTTP 403 → browser: navigation failed",
    );
  });

  it("refuses after_date before calling Parallel", async () => {
    const { tool, requests } = toolWithResponse({ results: [] });

    await expect(
      tool.execute(
        "call",
        { objective: "test", images: true, after_date: "2026-01-01" },
        undefined,
      ),
    ).rejects.toThrow("images cannot be combined with after_date");
    expect(requests).toEqual([]);
  });
});
