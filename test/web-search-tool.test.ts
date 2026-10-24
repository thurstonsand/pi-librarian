import type { ExtensionToolContext, Theme } from "@earendil-works/pi-coding-agent";
import { resetCapabilitiesCache, setCapabilities } from "@earendil-works/pi-tui";
import { Value } from "typebox/value";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ParallelClient } from "../extensions/librarian/web/parallel.ts";
import { createWebSearchTool } from "../extensions/librarian/web/search.ts";
import { stubFetch } from "./support/fetch-stub.ts";

function toolWithResponse(response: unknown, status = 200) {
  const requests = stubFetch([() => Response.json(response, { status })]);
  const tool = createWebSearchTool(
    new ParallelClient({ apiKey: "key-1", apiKeyCommand: undefined }),
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
      undefined,
      {} as ExtensionToolContext,
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

    await expect(
      tool.execute("call", { objective: "test" }, undefined, undefined, {} as ExtensionToolContext),
    ).rejects.toThrow(
      "Parallel search failed: Parallel search returned HTTP 422: Request validation error",
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

    const result = await tool.execute(
      "call",
      { objective: "test" },
      undefined,
      undefined,
      {} as ExtensionToolContext,
    );

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

    await expect(
      tool.execute("call", { objective: "test" }, undefined, undefined, {} as ExtensionToolContext),
    ).rejects.toThrow(
      "Parallel search failed: Parallel search response: /results/0 must have required properties excerpts",
    );
  });
});

describe("web_search result rows", () => {
  afterEach(() => {
    resetCapabilitiesCache();
  });

  const render = () =>
    createWebSearchTool(new ParallelClient({ apiKey: "key-1", apiKeyCommand: undefined }))
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
