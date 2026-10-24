import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubFetch } from "./support/fetch-stub.ts";
import { call, repoTools, temporaryCacheDir, text, withoutArtifact } from "./support/tools.ts";

let cacheDir: string;

beforeEach(async () => {
  cacheDir = await temporaryCacheDir();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function repoItem(name: string, overrides: Record<string, unknown>) {
  return {
    full_name: name,
    html_url: `https://github.com/${name}`,
    description: null,
    stargazers_count: 0,
    language: null,
    topics: [],
    pushed_at: null,
    archived: false,
    fork: false,
    ...overrides,
  };
}

describe("search_repos_github", () => {
  it("builds qualifiers from typed filters and shows only the metadata a repository has", async () => {
    const requests = stubFetch([
      () =>
        Response.json({
          total_count: 1284,
          incomplete_results: false,
          items: [
            repoItem("drizzle-team/drizzle-orm", {
              description: "Headless TypeScript ORM with a head",
              stargazers_count: 27104,
              language: "TypeScript",
              topics: ["orm", "sql"],
              pushed_at: "2026-08-19T10:00:00Z",
            }),
            repoItem("someone/orm-fork", { fork: true }),
          ],
        }),
    ]);

    const result = await call(repoTools({ cacheDir }, {}), "search_repos_github", {
      text: "orm",
      language: "Jupyter Notebook",
      topics: ["orm", "sql"],
      min_stars: 100,
      pushed_after: "2026-01-01",
      include_archived: false,
      sort: "stars",
      limit: 2,
    });

    expect(
      requests.map((request) => Object.fromEntries(request.url.searchParams.entries())),
    ).toEqual([
      {
        q: "orm language:jupyter-notebook topic:orm topic:sql stars:>=100 pushed:>2026-01-01 archived:false",
        per_page: "2",
        sort: "stars",
        order: "desc",
      },
    ]);
    expect(withoutArtifact(text(result))).toBe(`1,284 repositories match (github).
Fetched 2 (limit); showing all 2. Full results: <artifact>

 1. drizzle-team/drizzle-orm — ★27104 · TypeScript · last modified 2026-08-19
    Headless TypeScript ORM with a head
    topics: orm, sql
 2. someone/orm-fork — ★0 · fork`);
  });

  it("defaults to best match and leaves archived repositories in", async () => {
    const requests = stubFetch([
      () => Response.json({ total_count: 0, incomplete_results: false, items: [] }),
    ]);
    await call(repoTools({ cacheDir }, {}), "search_repos_github", { min_stars: 50000 });
    expect(Object.fromEntries(requests[0]?.url.searchParams.entries() ?? [])).toEqual({
      q: "stars:>=50000",
      per_page: "10",
    });
  });

  it.each([
    [{}, /an empty query asks for all of GitHub/],
    [{ language: "typescrypt" }, /does not know the language "typescrypt"/],
    [{ pushed_after: "2026-01-01 stars:>5" }, /YYYY-MM-DD/],
    [{ pushed_after: "01/02/2026" }, /YYYY-MM-DD/],
    [{ topics: ["orm sql"] }, /cannot contain spaces or quotes/],
    [{ text: "orm language:go" }, /qualifier "language:"/],
  ])("refuses %j before sending anything", async (params, message) => {
    const requests = stubFetch([]);
    await expect(call(repoTools({ cacheDir }, {}), "search_repos_github", params)).rejects.toThrow(
      message,
    );
    expect(requests).toEqual([]);
  });
});
