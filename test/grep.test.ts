import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GrepError,
  parseGrepMcpEvents,
  parseGrepSearchText,
  searchCodeGrep,
} from "../extensions/librarian/grep-app.ts";

function sse(payload: unknown): string {
  return `event: message\ndata: ${JSON.stringify(payload)}\n`;
}

describe("parseGrepSearchText", () => {
  it("parses Grep MCP text blocks into structured matches", () => {
    const match = parseGrepSearchText(`Repository: microsoft/rushstack
Path: apps/rush-mcp-server/src/tools/base.tool.ts
URL: https://github.com/microsoft/rushstack/blob/main/apps/rush-mcp-server/src/tools/base.tool.ts
License: MIT

Snippets:
--- Snippet 1 (Line 39) ---
> public register(server: McpServer): void {
    try {
      return result;
    } catch (error) {

--- Snippet 2 (Line 52) ---
      return { isError: true };
`);

    expect(match).toEqual({
      repo: "microsoft/rushstack",
      path: "apps/rush-mcp-server/src/tools/base.tool.ts",
      url: "https://github.com/microsoft/rushstack/blob/main/apps/rush-mcp-server/src/tools/base.tool.ts",
      license: "MIT",
      snippets: [
        {
          lineNumber: 39,
          content:
            "public register(server: McpServer): void {\n    try {\n      return result;\n    } catch (error) {",
        },
        { lineNumber: 52, content: "      return { isError: true };" },
      ],
    });
  });

  it("ignores no-results text", () => {
    expect(parseGrepSearchText("No results found for your query.")).toBeUndefined();
  });
});

describe("parseGrepMcpEvents", () => {
  it("parses text content from MCP SSE events", () => {
    const result = parseGrepMcpEvents(
      sse({
        result: {
          content: [
            {
              type: "text",
              text: `Repository: drizzle-team/drizzle-orm
Path: drizzle-orm/src/pg-core/session.ts
URL: https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/pg-core/session.ts
License: Apache-2.0

Snippets:
--- Snippet 1 (Line 172) ---
	abstract prepareQuery<T extends PreparedQueryConfig = PreparedQueryConfig>(
`,
            },
          ],
        },
      }),
    );

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.repo).toBe("drizzle-team/drizzle-orm");
    expect(result.matches[0]?.snippets[0]?.lineNumber).toBe(172);
  });

  it("throws on JSON-RPC errors", () => {
    expect(() => parseGrepMcpEvents(sse({ error: { message: "search failed" } }))).toThrow(
      GrepError,
    );
  });
});

describe("searchCodeGrep", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls the official Grep MCP searchGitHub tool", async () => {
    let requestBody: string | undefined;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = String(init?.body);
      return new Response(
        sse({
          result: {
            content: [
              {
                type: "text",
                text: `Repository: example/repo
Path: src/index.ts
URL: https://github.com/example/repo/blob/main/src/index.ts
License: Unknown

Snippets:
--- Snippet 1 (Line 10) ---
export function prepareQuery() {}
`,
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await searchCodeGrep(
      {
        query: "prepareQuery",
        repo: "example/repo",
        language: ["TypeScript"],
        useRegexp: false,
      },
      undefined,
    );

    expect(result.matches[0]?.license).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestBody).toBeDefined();
    const request = JSON.parse(requestBody ?? "") as {
      params: { name: string; arguments: Record<string, unknown> };
    };
    expect(request.params.name).toBe("searchGitHub");
    expect(request.params.arguments).toEqual({
      query: "prepareQuery",
      repo: "example/repo",
      language: ["TypeScript"],
    });
  });
});
