import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeSearchWindow } from "../extensions/librarian/gitlab.ts";
import { stubFetch } from "./support/fetch-stub.ts";
import { call, repoTools, temporaryCacheDir, text, withoutArtifact } from "./support/tools.ts";

const ENV = { GITLAB_ACCESS_TOKEN: "gl-token" };
let cacheDir: string;

beforeEach(async () => {
  cacheDir = await temporaryCacheDir();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function settings(advancedSearch = false) {
  return {
    cacheDir,
    sources: [
      {
        name: "example-gl",
        url: "https://gitlab.example.com",
        kind: "gitlab" as const,
        advancedSearch,
      },
    ],
  };
}

const PROJECT = {
  id: 42,
  path_with_namespace: "platform/widget-sdk",
  default_branch: "main",
  repository_access_level: "enabled",
};

function blob(path: string, startline: number, data: string, pathMatch = false) {
  return { id: pathMatch ? "abc" : null, path, data, ref: "main", startline, project_id: 42 };
}

function json(body: unknown, headers: Record<string, string> = {}): Response {
  return Response.json(body, { headers });
}

describe("search_code_gitlab", () => {
  it("resolves the project to its id, then numbers the matching lines inside each chunk", async () => {
    const requests = stubFetch([
      (request) =>
        request.url.pathname === "/api/v4/projects/Platform%2FWidget-SDK"
          ? json(PROJECT)
          : undefined,
      (request) => (request.url.pathname === "/api/v4/projects/42" ? json(PROJECT) : undefined),
      (request) =>
        request.url.pathname === "/api/v4/projects/42/search"
          ? json(
              [
                blob("internal/git/worktree.go", 1, "package git\n", true),
                blob("internal/git/files.go", 10, "a\nb\nfunc copyWorktree() {\nc\nd"),
              ],
              { "x-total": "2", "x-next-page": "" },
            )
          : undefined,
    ]);

    const result = await call(repoTools(settings(), ENV), "search_code_gitlab", {
      pattern: "Worktree",
      project: "Platform/Widget-SDK",
      extension: ".go",
    });

    const search = requests.find((request) => request.url.pathname.endsWith("/search"));
    expect(Object.fromEntries(search?.url.searchParams.entries() ?? [])).toEqual({
      scope: "blobs",
      search: "Worktree extension:go",
      page: "1",
      per_page: "50",
    });
    expect(search?.headers.get("private-token")).toBe("gl-token");
    expect(withoutArtifact(text(result))).toBe(`2 files across 1 repo, unranked (example-gl).
Fetched 2; showing all 2. Full results: <artifact>

 1. platform/widget-sdk — internal/git/worktree.go
    (the path matches)
 2. platform/widget-sdk — internal/git/files.go
    12: func copyWorktree() {`);
  });

  it("requires project without advanced search, and translates the refusal when the flag is wrong", async () => {
    const tool = repoTools(settings(), ENV).get("search_code_gitlab");
    expect((tool?.parameters as { required: string[] } | undefined)?.required).toEqual([
      "pattern",
      "project",
    ]);

    stubFetch([
      () =>
        Response.json(
          { message: "Scope supported only with advanced search or exact code search" },
          { status: 400 },
        ),
    ]);
    await expect(
      call(repoTools(settings(true), ENV), "search_code_gitlab", { pattern: "worktree" }),
    ).rejects.toThrow(
      "example-gl searches one project at a time; name one with project. If it does have advanced search, advancedSearch is set wrongly for this source.",
    );
  });

  it("refuses a missing ref, which GitLab would answer with an empty result", async () => {
    const requests = stubFetch([
      (request) =>
        request.url.pathname.endsWith("/commits/no-such-branch")
          ? Response.json({ message: "404 Commit Not Found" }, { status: 404 })
          : undefined,
      () => json(PROJECT),
    ]);
    await expect(
      call(repoTools(settings(), ENV), "search_code_gitlab", {
        pattern: "worktree",
        project: "platform/widget-sdk",
        ref: "no-such-branch",
      }),
    ).rejects.toThrow(
      "Ref no-such-branch does not exist in platform/widget-sdk; there is nothing to search.",
    );
    expect(requests.some((request) => request.url.pathname.endsWith("/search"))).toBe(false);
  });

  it("refuses patterns GitLab answers with a silent zero", async () => {
    const requests = stubFetch([]);
    const tools = repoTools(settings(), ENV);
    await expect(
      call(tools, "search_code_gitlab", { pattern: "x", project: "a/b" }),
    ).rejects.toThrow("at least two characters");
    await expect(
      call(tools, "search_code_gitlab", { pattern: "foo extension:go", project: "a/b" }),
    ).rejects.toThrow("use the filename, path, and extension arguments");
    expect(requests).toEqual([]);
  });
});

describe("CodeSearchWindow", () => {
  it("allows 30 searches in a fixed minute and reports the real wait", () => {
    let now = 1_000_000;
    const window = new CodeSearchWindow(() => now);
    for (let index = 0; index < 30; index += 1) {
      window.take();
    }
    now += 42_000;
    expect(() => window.take()).toThrow(
      "GitLab allows 30 code searches a minute; the next one is possible in 18s.",
    );
    now += 18_000;
    expect(() => window.take()).not.toThrow();
  });
});

describe("search_repos_gitlab", () => {
  it("sends explicit ordering and archived=false, and group-path matching only for a group path", async () => {
    const requests = stubFetch([
      () =>
        json(
          [
            {
              path_with_namespace: "platform/widget-sdk",
              web_url: "https://gitlab.example.com/platform/widget-sdk",
              star_count: 3,
              last_activity_at: "2026-10-01T00:00:00Z",
              description: "Widgets",
            },
          ],
          { "x-total": "1" },
        ),
    ]);
    const tools = repoTools(settings(), ENV);

    const result = await call(tools, "search_repos_gitlab", {
      name: "platform/widget",
      topics: ["go"],
      changed_after: "2026-01-01",
      sort: "name",
    });
    await call(tools, "search_repos_gitlab", { name: "wt" });

    expect(
      requests.map((request) => Object.fromEntries(request.url.searchParams.entries())),
    ).toEqual([
      {
        search: "platform/widget",
        search_namespaces: "true",
        simple: "true",
        archived: "false",
        topic: "go",
        last_activity_after: "2026-01-01T00:00:00Z",
        order_by: "path",
        sort: "asc",
        per_page: "10",
      },
      {
        search: "wt",
        simple: "true",
        archived: "false",
        order_by: "last_activity_at",
        sort: "desc",
        per_page: "10",
      },
    ]);
    expect(withoutArtifact(text(result))).toBe(`1 project match (example-gl).
Fetched 1; showing all 1. Full results: <artifact>

 1. platform/widget-sdk — ★3 · last active 2026-10-01
    Widgets`);
  });
});

describe("read_file on GitLab", () => {
  const tree = (entries: Array<{ name: string; type: string; mode: string }>) => json(entries);

  it("learns what an entry is from its parent's tree before reading raw", async () => {
    const requests = stubFetch([
      (request) =>
        request.url.pathname === "/api/v4/projects/platform%2Fwidget-sdk"
          ? json(PROJECT)
          : undefined,
      (request) =>
        request.url.pathname === "/api/v4/projects/42/repository/tree"
          ? tree([
              { name: "proto", type: "commit", mode: "160000" },
              { name: "latest", type: "blob", mode: "120000" },
              { name: "retry.ts", type: "blob", mode: "100644" },
            ])
          : undefined,
      (request) =>
        request.url.pathname.endsWith("latest/raw")
          ? new Response(request.method === "HEAD" ? null : "v2\n", {
              headers: { "x-gitlab-size": "3" },
            })
          : request.url.pathname.endsWith("retry.ts/raw")
            ? new Response(request.method === "HEAD" ? null : "export const a = 1;", {
                headers: { "x-gitlab-size": "19" },
              })
            : undefined,
    ]);
    const tools = repoTools(settings(), ENV);
    const read = (path: string) =>
      call(tools, "read_file", { source: "example-gl", repo: "platform/widget-sdk", path });

    expect(text(await read("src/proto"))).toBe(
      "platform/widget-sdk/src/proto is a submodule — read it from that repository.",
    );
    expect(text(await read("src/latest"))).toBe(
      "platform/widget-sdk/src/latest is a symlink to v2 — read that path instead.",
    );
    expect(text(await read("src/retry.ts"))).toBe("export const a = 1;");
    expect(
      requests
        .filter((request) => request.url.pathname.endsWith("/raw"))
        .map((request) => request.method),
    ).toEqual(["HEAD", "GET", "HEAD", "GET"]);
  });
});
