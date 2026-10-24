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

const ENV = { GITHUB_TOKEN: "test-token" };
let cacheDir: string;

beforeEach(async () => {
  cacheDir = await temporaryCacheDir();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function codeItem(repo: string, path: string, commit: string, fragment: string) {
  return {
    path,
    html_url: `https://github.com/${repo}/blob/${commit}/${path}`,
    repository: { full_name: repo },
    text_matches: [{ fragment }],
  };
}

describe("search_code_github", () => {
  it("builds one query from typed arguments and returns a digest over the full results", async () => {
    const commit = "48e5406027103a9fca6eb66417187c4a8b5c6aa3";
    const requests = stubFetch([
      (request) =>
        request.url.pathname === "/search/code"
          ? Response.json({
              total_count: 2,
              incomplete_results: false,
              items: [
                codeItem(
                  "drizzle-team/drizzle-orm",
                  "drizzle-kit/src/index.ts",
                  commit,
                  "export function defineConfig(",
                ),
                codeItem(
                  "drizzle-team/drizzle-orm",
                  "drizzle-kit/src/cli.ts",
                  commit,
                  "defineConfig({",
                ),
              ],
            })
          : undefined,
    ]);
    const tools = repoTools({ cacheDir }, ENV);

    const result = await call(tools, "search_code_github", {
      pattern: "defineConfig",
      owner: "drizzle-team",
      repos: ["drizzle-orm"],
      path: "/drizzle-kit/src/",
      extension: ".ts",
      limit: 5,
    });

    expect(
      requests.map((request) => [
        request.url.searchParams.get("q"),
        request.url.searchParams.get("per_page"),
      ]),
    ).toEqual([
      ["defineConfig repo:drizzle-team/drizzle-orm path:drizzle-kit/src extension:ts", "5"],
    ]);
    expect(withoutArtifact(text(result))).toBe(`2 files across 1 repo (github).
Fetched 2; showing all 2. Full results: <artifact>

 1. drizzle-team/drizzle-orm — drizzle-kit/src/index.ts (48e5406)
    export function defineConfig(
 2. drizzle-team/drizzle-orm — drizzle-kit/src/cli.ts (48e5406)
    defineConfig({`);
    expect(await artifactRecords(result)).toEqual([
      {
        source: "github",
        repo: "drizzle-team/drizzle-orm",
        path: "drizzle-kit/src/index.ts",
        url: `https://github.com/drizzle-team/drizzle-orm/blob/${commit}/drizzle-kit/src/index.ts`,
        commit,
        fragments: ["export function defineConfig("],
      },
      {
        source: "github",
        repo: "drizzle-team/drizzle-orm",
        path: "drizzle-kit/src/cli.ts",
        url: `https://github.com/drizzle-team/drizzle-orm/blob/${commit}/drizzle-kit/src/cli.ts`,
        commit,
        fragments: ["defineConfig({"],
      },
    ]);
  });

  it("reports a limit, not an incompleteness, when more files match than were fetched", async () => {
    stubFetch([
      () =>
        Response.json({
          total_count: 13055,
          incomplete_results: false,
          items: [codeItem("a/b", "x.ts", "1".repeat(40), "useState(")],
        }),
    ]);
    const result = await call(repoTools({ cacheDir }, ENV), "search_code_github", {
      pattern: "useState",
      limit: 1,
    });

    expect(withoutArtifact(text(result)).split("\n").slice(0, 2)).toEqual([
      "13,055 files match (github).",
      "Fetched 1 (limit); showing all 1. Full results: <artifact>",
    ]);
  });

  it.each([
    ["defineConfig OR drizzleKit", /reads OR as AND/],
    ["(foo bar)", /cannot group with parentheses/],
    ['"unbalanced', /unbalanced quote/],
    ["foo repo:a/b", /qualifier "repo:"/],
  ])("refuses the pattern %s before sending anything", async (pattern, message) => {
    const requests = stubFetch([]);
    await expect(
      call(repoTools({ cacheDir }, ENV), "search_code_github", { pattern }),
    ).rejects.toThrow(message);
    expect(requests).toEqual([]);
  });

  it("keeps a quoted OR, and refuses scope it cannot express", async () => {
    const requests = stubFetch([
      () => Response.json({ total_count: 0, incomplete_results: false, items: [] }),
    ]);
    const tools = repoTools({ cacheDir }, ENV);

    await call(tools, "search_code_github", { pattern: '"this OR that"' });
    await expect(
      call(tools, "search_code_github", { pattern: "x", repos: ["drizzle-orm"] }),
    ).rejects.toThrow("repos requires owner");
    await expect(
      call(tools, "search_code_github", {
        pattern: "x",
        owner: "a",
        repos: ["drizzle-team/drizzle-orm"],
      }),
    ).rejects.toThrow('pass owner "drizzle-team" and repos ["drizzle-orm"]');
    await expect(
      call(tools, "search_code_github", { pattern: "x", path: "src lib" }),
    ).rejects.toThrow("cannot contain spaces or quotes");
    expect(requests.map((request) => request.url.searchParams.get("q"))).toEqual([
      '"this OR that"',
    ]);
  });

  it("raises on a scope GitHub could not search, naming a rename", async () => {
    stubFetch([
      (request) =>
        request.url.pathname === "/search/code"
          ? Response.json({ total_count: 0, incomplete_results: true, items: [] })
          : undefined,
      (request) =>
        request.url.pathname === "/repos/facebook/react"
          ? Response.json({ full_name: "react/react", default_branch: "main", private: false })
          : undefined,
    ]);

    await expect(
      call(repoTools({ cacheDir }, ENV), "search_code_github", {
        pattern: "useState",
        owner: "facebook",
        repos: ["react"],
      }),
    ).rejects.toThrow(
      "GitHub could not search this scope: facebook/react was renamed to react/react. This is not an empty result.",
    );
  });

  it("translates GitHub's own 408 into the narrowing error", async () => {
    stubFetch([() => Response.json({ message: "Request timed out" }, { status: 408 })]);
    await expect(
      call(repoTools({ cacheDir }, ENV), "search_code_github", { pattern: "useState" }),
    ).rejects.toThrow(
      "GitHub stopped the search at its own time limit, about 9s.\nNarrow it before retrying: set owner or repos, or add path, filename, or extension.",
    );
  });

  it("reports when the rate limit resets, on GitHub's clock", async () => {
    stubFetch([
      () =>
        Response.json(
          { message: "API rate limit exceeded" },
          {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
              "x-ratelimit-reset": String(Date.parse("2026-10-23T12:00:42Z") / 1000),
              date: "Fri, 23 Oct 2026 12:00:00 GMT",
            },
          },
        ),
    ]);
    await expect(
      call(repoTools({ cacheDir }, ENV), "search_code_github", { pattern: "useState" }),
    ).rejects.toThrow("GitHub code search rate limit reached; resets in 42s.");
  });

  it("cancels the request and raises the narrowing error when the budget runs out", async () => {
    let aborted = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_input: unknown, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              aborted = true;
              reject(new DOMException("aborted", "AbortError"));
            });
          }),
      ),
    );

    await expect(
      call(repoTools({ cacheDir, search: { timeoutSeconds: 0.05 } }, ENV), "search_code_github", {
        pattern: "useState",
      }),
    ).rejects.toThrow(
      "0.05s limit hit before any results arrived.\nNarrow it before retrying: set owner or repos, or add path, filename, or extension.",
    );
    expect(aborted).toBe(true);
  });
});
