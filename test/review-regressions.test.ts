import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "./support/fetch-stub.ts";
import { artifactRecords, call, repoTools, temporaryCacheDir, text } from "./support/tools.ts";

// Regressions for the defects an adversarial review reproduced; each goes through a tool's execute.
let cacheDir: string;

beforeEach(async () => {
  cacheDir = await temporaryCacheDir();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function sse(events: Array<[string, unknown]>): Response {
  return new Response(
    events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(""),
  );
}

const done = (matchCount: number) =>
  [
    ["progress", { done: true, matchCount, repositoriesCount: 1, durationMs: 100, skipped: [] }],
    ["done", {}],
  ] as Array<[string, unknown]>;

describe("Sourcegraph query encoding", () => {
  const sourcegraph = () =>
    repoTools(
      {
        cacheDir,
        sources: [{ name: "example-sg", url: "https://search.example.com", kind: "sourcegraph" }],
      },
      { SRC_ACCESS_TOKEN: "sg-token" },
    );

  it.each([
    [
      "search_code_sourcegraph",
      { pattern: "(fork:yes) retry", pattern_type: "keyword" },
      'pattern contains a filter "fork:"',
    ],
    [
      "search_code_sourcegraph",
      { pattern: "x", repos: ['"safe"fork:yes'] },
      "repos cannot contain spaces or quotes",
    ],
    [
      "search_repos_sourcegraph",
      { topics: ["go)repo:has.commit.after(2026-01-01"] },
      "topics cannot contain spaces, quotes, or parentheses",
    ],
    ["search_code_sourcegraph", { pattern: "x", repos: ["(?=a)b"] }, "repos uses lookaround"],
  ])("refuses an injected filter in %s %j", async (tool, params, message) => {
    const requests = stubFetch([]);
    await expect(call(sourcegraph(), tool, params)).rejects.toThrow(message);
    expect(requests).toEqual([]);
  });

  // Measured on 7.7: \\( must reach the engine as written, and a pre-escaped \/ must not become \\/.
  it("passes a regexp's escapes through, escapes only bare slashes, and accepts RE2's inline flags", async () => {
    const requests = stubFetch([() => sse(done(0))]);
    const tools = sourcegraph();

    await call(tools, "search_code_sourcegraph", {
      pattern: "\\bNewClient\\(",
      pattern_type: "regexp",
    });
    await call(tools, "search_code_sourcegraph", { pattern: "a\\/b/c", pattern_type: "regexp" });
    await call(tools, "search_code_sourcegraph", { pattern: "x", repos: ["(?i)widget"] });

    expect(requests.map((request) => request.url.searchParams.get("q"))).toEqual([
      "type:file count:1000 select:file /\\bNewClient\\(/ timeout:15s",
      "type:file count:1000 select:file /a\\/b\\/c/ timeout:15s",
      'type:file count:1000 select:file repo:(?i)widget content:"x" timeout:15s',
    ]);
  });

  it("raises on a malformed progress event instead of reporting a complete search", async () => {
    stubFetch([
      () =>
        sse([
          ["matches", []],
          ["progress", { done: true }],
          ["done", {}],
        ]),
    ]);
    await expect(call(sourcegraph(), "search_code_sourcegraph", { pattern: "x" })).rejects.toThrow(
      "Sourcegraph progress",
    );
  });
});

describe("GitHub repository search", () => {
  it("raises when GitHub stopped before finding anything", async () => {
    stubFetch([() => Response.json({ total_count: 0, incomplete_results: true, items: [] })]);
    await expect(
      call(repoTools({ cacheDir }, {}), "search_repos_github", { text: "orm" }),
    ).rejects.toThrow(
      "GitHub could not finish this repository search and found nothing before it stopped. This is not an empty result",
    );
  });
});

describe("GitLab", () => {
  const gitlab = (timeoutSeconds = 15) =>
    repoTools(
      {
        cacheDir,
        search: { timeoutSeconds },
        sources: [{ name: "example-gl", url: "https://gitlab.example.com", kind: "gitlab" }],
      },
      { GITLAB_ACCESS_TOKEN: "gl-token" },
    );
  const project = {
    id: 42,
    path_with_namespace: "platform/widget-sdk",
    repository_access_level: "enabled",
  };

  it("holds the project lookups a digest needs to the search budget", async () => {
    stubFetch([
      (request) =>
        request.url.pathname === "/api/v4/projects/7"
          ? new Promise<Response>(() => {})
          : request.url.pathname.endsWith("/search")
            ? Response.json(
                [
                  {
                    id: null,
                    path: "a.go",
                    data: "needle",
                    ref: "main",
                    startline: 1,
                    project_id: 7,
                  },
                ],
                { headers: { "x-next-page": "" } },
              )
            : Response.json(project),
    ]);
    await expect(
      call(gitlab(0.1), "search_code_gitlab", {
        pattern: "needle",
        project: "platform/widget-sdk",
      }),
    ).rejects.toThrow("0.1s limit hit");
  });

  it("finds an entry listed on the second page of its directory", async () => {
    stubFetch([
      (request) =>
        request.url.pathname === "/api/v4/projects/platform%2Fwidget-sdk"
          ? Response.json(project)
          : undefined,
      (request) =>
        request.url.pathname.endsWith("/repository/tree") && !request.url.searchParams.has("path")
          ? Response.json([{ name: "src", type: "tree", mode: "040000" }], {
              headers: { "x-next-page": "" },
            })
          : undefined,
      (request) =>
        request.url.pathname.endsWith("/repository/tree")
          ? request.url.searchParams.get("page") === "1"
            ? Response.json([{ name: "a.ts", type: "blob", mode: "100644" }], {
                headers: { "x-next-page": "2" },
              })
            : Response.json([{ name: "z.ts", type: "blob", mode: "100644" }], {
                headers: { "x-next-page": "" },
              })
          : undefined,
      (request) =>
        request.url.pathname.endsWith("z.ts/raw")
          ? new Response(request.method === "HEAD" ? null : "last", {
              headers: { "x-gitlab-size": "4" },
            })
          : undefined,
    ]);
    const tools = gitlab();
    expect(
      text(
        await call(tools, "read_file", {
          source: "example-gl",
          repo: "platform/widget-sdk",
          path: "src/z.ts",
        }),
      ),
    ).toBe("last");
    expect(
      text(
        await call(tools, "read_file", {
          source: "example-gl",
          repo: "platform/widget-sdk",
          path: "src",
        }),
      ),
    ).toBe("src/a.ts\nsrc/z.ts");
  });
});

describe("grep.app", () => {
  it("keeps every fetched result in the artifact and the counts, showing only limit", async () => {
    const block = (repo: string) =>
      `Repository: ${repo}\nPath: src/index.ts\nURL: https://github.com/${repo}/blob/main/src/index.ts\nLicense: MIT\n\nSnippets:\n--- Snippet 1 (Line 3) ---\n> useState(\n`;
    stubFetch([
      () =>
        new Response(
          `event: message\ndata: ${JSON.stringify({
            result: {
              content: ["a/one", "b/two", "c/three"].map((repo) => ({
                type: "text",
                text: block(repo),
              })),
            },
          })}\n`,
          { headers: { "content-type": "text/event-stream" } },
        ),
    ]);
    const result = await call(repoTools({ cacheDir }, {}), "search_code_grepapp", {
      pattern: "useState(",
      limit: 1,
    });

    expect(text(result).split("\n").slice(0, 2)).toEqual([
      "3 files across 3 repos (grep.app).",
      expect.stringMatching(/^Fetched 3; showing 1\. Full results: /),
    ]);
    expect(await artifactRecords(result)).toHaveLength(3);
  });
});
