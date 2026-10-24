import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "./support/fetch-stub.ts";
import {
  artifactRecords,
  call,
  repoTools,
  temporaryCacheDir,
  text,
  withoutArtifact,
} from "./support/tools.ts";

const ENV = { SRC_ACCESS_TOKEN: "sg-token" };
let cacheDir: string;

beforeEach(async () => {
  cacheDir = await temporaryCacheDir();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function settings(extra: Record<string, unknown> = {}) {
  return {
    cacheDir,
    sources: [
      { name: "example-sg", url: "https://search.example.com", kind: "sourcegraph" as const },
      { name: "example-bb", url: "https://git.example.com", kind: "bitbucket-server" as const },
    ],
    ...extra,
  };
}

function sse(events: Array<[string, unknown]>): Response {
  return new Response(
    events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join(""),
    { headers: { "content-type": "text/event-stream" } },
  );
}

function progress(
  matchCount: number,
  repositoriesCount: number,
  durationMs: number,
  skipped: unknown[] = [],
) {
  return {
    done: true,
    matchCount,
    repositoriesCount,
    durationMs,
    skipped,
    trace: "https://internal.example/trace/1",
  };
}

function content(repository: string, path: string, lines: Array<[number, string]> = []) {
  return {
    type: "content",
    repository,
    path,
    commit: "9f8e7d6c5b4a39281706f5e4d3c2b1a098765432",
    lineMatches: lines.map(([lineNumber, line]) => ({
      line,
      lineNumber,
      offsetAndLengths: [[0, 1]],
    })),
  };
}

describe("search_code_sourcegraph", () => {
  it("encodes a literal pattern atomically and groups results under the source each clones from", async () => {
    const requests = stubFetch([
      () =>
        sse([
          [
            "matches",
            [
              content("git.example.com/PROJ/service-a", "src/retry.go"),
              content("github.com/acme/retry-kit", "retry.go"),
              content("git.example.com/CORE/search-lib", "client/backoff.go"),
              content("mirror.example.org/x/y", "z.go"),
            ],
          ],
          ["progress", progress(412, 63, 640, [{ reason: "repository-fork", title: "46 forked" }])],
          ["done", {}],
        ]),
    ]);

    const result = await call(repoTools(settings(), ENV), "search_code_sourcegraph", {
      pattern: 'say "and" \\ then',
      repos: ["^git\\.example\\.com/PROJ/", "^git\\.example\\.com/CORE/"],
      path: "\\.go$",
      limit: 4,
    });

    expect(requests[0]?.url.searchParams.get("q")).toBe(
      'type:file count:1000 select:file repo:(?:^git\\.example\\.com/PROJ/)|(?:^git\\.example\\.com/CORE/) file:\\.go$ content:"say \\"and\\" \\\\ then" timeout:15s',
    );
    expect(requests[0]?.url.searchParams.get("t")).toBe("standard");
    expect(requests[0]?.headers.get("authorization")).toBe("token sg-token");
    expect(withoutArtifact(text(result))).toBe(`412 files across 63 repos (example-sg). Complete.
Fetched 4; showing all 4. Full results: <artifact>

example-bb — clone with source: example-bb
 1. PROJ/service-a — src/retry.go (9f8e7d6)
 2. CORE/search-lib — client/backoff.go (9f8e7d6)
github — clone with source: github
 3. acme/retry-kit — retry.go (9f8e7d6)
not a declared source
 4. mirror.example.org/x/y — z.go (9f8e7d6)`);
    expect(JSON.stringify(await artifactRecords(result))).not.toContain("internal.example");
  });

  it("shows matched lines 1-based at detail matches, and reads keyword patterns as keyword", async () => {
    const requests = stubFetch([
      () =>
        sse([
          [
            "matches",
            [
              content("git.example.com/PROJ/widget-sdk", "src/retry.ts", [
                [29, "export function computeBackoff("],
              ]),
            ],
          ],
          ["progress", progress(3, 1, 200)],
          ["done", {}],
        ]),
    ]);

    const result = await call(repoTools(settings(), ENV), "search_code_sourcegraph", {
      pattern: "computeBackoff NOT test",
      pattern_type: "keyword",
      detail: "matches",
    });

    expect(requests[0]?.url.searchParams.get("q")).toBe(
      "type:file count:2000 computeBackoff NOT test timeout:15s",
    );
    expect(requests[0]?.url.searchParams.get("t")).toBe("keyword");
    expect(withoutArtifact(text(result)).split("\n").slice(3)).toEqual([
      "example-bb — clone with source: example-bb",
      " 1. PROJ/widget-sdk — src/retry.ts (9f8e7d6)",
      "    30: export function computeBackoff(",
    ]);
  });

  it("reports a result limit as incomplete, and keeps an alert that came with results", async () => {
    stubFetch([
      () =>
        sse([
          ["matches", [content("git.example.com/PROJ/a", "x.go")]],
          [
            "alert",
            { title: "Some revisions could not be searched", description: "empty repository" },
          ],
          [
            "progress",
            progress(1000, 87, 900, [{ reason: "shard-match-limit", title: "result limit hit" }]),
          ],
          ["done", {}],
        ]),
    ]);

    const result = await call(repoTools(settings(), ENV), "search_code_sourcegraph", {
      pattern: "retry policy",
    });

    expect(withoutArtifact(text(result)).split("\n")[0]).toBe(
      "1,000 files across 87 repos (example-sg). Incomplete: reached the result limit for one search.",
    );
    expect(
      text(result).endsWith("Warning: Some revisions could not be searched: empty repository"),
    ).toBe(true);
    expect(result.details).toMatchObject({ complete: false, matchCount: 1000, repoCount: 87 });
  });

  it("treats a search the server stopped at its timeout as an error that keeps the counts", async () => {
    stubFetch([
      () =>
        sse([
          ["matches", [content("git.example.com/PROJ/a", "x.go")]],
          ["progress", progress(212, 40, 15_118)],
          ["done", {}],
        ]),
    ]);

    await expect(
      call(repoTools(settings(), ENV), "search_code_sourcegraph", { pattern: "retry" }),
    ).rejects.toThrow(
      "15s limit hit; 212 files across 40 repos found.\nNarrow it before retrying: restrict repos, add a path or language, or ask for detail repos.",
    );
  });

  it("raises on an alert with no results, an error event, and a rejected token", async () => {
    stubFetch([
      (request) =>
        request.url.searchParams.get("q")?.includes("nothing")
          ? sse([
              [
                "alert",
                { title: "No repositories found", description: "Try a different repo: filter" },
              ],
              ["progress", progress(0, 0, 50)],
              ["done", {}],
            ])
          : request.url.searchParams.get("q")?.includes("broken")
            ? sse([["error", { message: "invalid time ref" }]])
            : new Response("Invalid access token.", { status: 401 }),
    ]);
    const tools = repoTools(settings(), ENV);

    await expect(call(tools, "search_code_sourcegraph", { pattern: "nothing" })).rejects.toThrow(
      "No repositories found: Try a different repo: filter",
    );
    await expect(call(tools, "search_code_sourcegraph", { pattern: "broken" })).rejects.toThrow(
      "Sourcegraph: invalid time ref",
    );
    await expect(call(tools, "search_code_sourcegraph", { pattern: "anything" })).rejects.toThrow(
      "Sourcegraph rejected the token (401): Invalid access token.",
    );
  });

  it("refuses what the engine would answer with a silent zero, before sending anything", async () => {
    const requests = stubFetch([]);
    const tools = repoTools(settings(), ENV);

    await expect(
      call(tools, "search_code_sourcegraph", { pattern: "x", repos: ["foo("] }),
    ).rejects.toThrow("repos is not a valid regular expression");
    await expect(
      call(tools, "search_code_sourcegraph", { pattern: "x", path: "src lib" }),
    ).rejects.toThrow("path cannot contain spaces");
    await expect(
      call(tools, "search_code_sourcegraph", { pattern: "lnag:go retry", pattern_type: "keyword" }),
    ).rejects.toThrow('pattern contains a filter "lnag:"');
    expect(requests).toEqual([]);
  });

  it("is not registered without a Sourcegraph token", () => {
    const tools = repoTools(settings(), {});
    expect(tools.has("search_code_sourcegraph")).toBe(false);
    expect(tools.has("find_definition")).toBe(false);
    expect(tools.has("search_repos_sourcegraph")).toBe(false);
  });
});

describe("search_repos_sourcegraph", () => {
  it("builds predicates from typed filters and lists every repository", async () => {
    const requests = stubFetch([
      () =>
        sse([
          [
            "matches",
            [
              {
                type: "repo",
                repository: "git.example.com/CORE/deploy-cli",
                description: "Deployment CLI",
              },
              { type: "repo", repository: "git.example.com/CORE/deploy-agent", fork: true },
            ],
          ],
          ["progress", progress(2, 2, 300)],
          ["done", {}],
        ]),
    ]);

    const result = await call(repoTools(settings(), ENV), "search_repos_sourcegraph", {
      name: "deploy",
      topics: ["go"],
      contains_path: "^go\\.mod$",
      include_forks: true,
    });

    expect(requests[0]?.url.searchParams.get("q")).toBe(
      "type:repo count:5000 repo:deploy repo:has.topic(go) repo:has.path(^go\\.mod$) fork:yes timeout:15s",
    );
    expect(withoutArtifact(text(result))).toBe(`2 repositories match (example-sg). Complete.
Fetched 2; showing all 2. Full results: <artifact>

example-bb — clone with source: example-bb
 1. CORE/deploy-cli
    Deployment CLI
 2. CORE/deploy-agent — fork`);
  });

  it("counts the scope before walking history, and refuses a scope over 1,000 repositories", async () => {
    const many = Array.from({ length: 1001 }, (_, index) => ({
      type: "repo",
      repository: `git.example.com/PROJ/r${index}`,
    }));
    const requests = stubFetch([
      () =>
        sse([
          ["matches", many],
          ["progress", progress(1001, 1001, 400)],
          ["done", {}],
        ]),
    ]);

    await expect(
      call(repoTools(settings(), ENV), "search_repos_sourcegraph", { changed_after: "2026-01-01" }),
    ).rejects.toThrow("changed_after covers more than 1,000 repositories");
    expect(requests.map((request) => request.url.searchParams.get("q"))).toEqual([
      "type:repo count:1001 timeout:15s",
    ]);
  });
});

describe("find_definition", () => {
  it("searches the exact name, leaving vendored copies out by default", async () => {
    const requests = stubFetch([
      () =>
        sse([
          [
            "matches",
            [
              {
                type: "symbol",
                repository: "git.example.com/PROJ/widget-sdk",
                path: "src/retry.ts",
                commit: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0",
                symbols: [
                  { name: "computeBackoff", containerName: "retry", kind: "FUNCTION", line: 30 },
                ],
              },
            ],
          ],
          ["progress", progress(1, 1, 300)],
          ["done", {}],
        ]),
    ]);

    const result = await call(repoTools(settings(), ENV), "find_definition", {
      symbol: "compute.Backoff",
      kind: "function",
    });

    expect(requests[0]?.url.searchParams.get("q")).toBe(
      "type:symbol count:1000 select:symbol.function -file:(^|/)vendor/ /^compute\\.Backoff$/ timeout:15s",
    );
    expect(withoutArtifact(text(result)).split("\n").slice(3)).toEqual([
      "example-bb — clone with source: example-bb",
      " 1. PROJ/widget-sdk — src/retry.ts:30 (a1b2c3d) — function in retry",
    ]);
  });
});
