import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubClientProvider } from "../extensions/librarian/github.ts";
import type { FetcherResult, WebFetcher } from "../extensions/librarian/web/contract.ts";
import {
  createGitHubFetcher,
  type GitHubFetchHost,
} from "../extensions/librarian/web/fetchers/github/index.ts";
import { type Route, stubFetch } from "./support/fetch-stub.ts";

let artifactDir: string;

beforeEach(async () => {
  artifactDir = await mkdtemp(path.join(os.tmpdir(), "web-github-"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const GITHUB: GitHubFetchHost = {
  source: "github",
  webUrl: "https://github.com",
  client: createGitHubClientProvider(async () => "token", "https://github.com"),
};

const GHE: GitHubFetchHost = {
  source: "ghe",
  webUrl: "https://ghe.example.com",
  client: createGitHubClientProvider(async () => "ghe-token", "https://ghe.example.com"),
};

function fetchUrl(fetcher: WebFetcher, url: string): Promise<FetcherResult> {
  return fetcher.fetch({ urls: [url], artifactDir, ctx: {} as ExtensionContext });
}

function json(pathname: string, body: unknown): Route {
  return (request) => (request.url.pathname === pathname ? Response.json(body) : undefined);
}

async function body(result: FetcherResult, name: string): Promise<string> {
  const found = result.documents[0]?.bodies.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no ${name} body in ${JSON.stringify(result)}`);
  return readFile(found.path, "utf8");
}

describe("GitHub fetcher hosts", () => {
  it("claims each configured host's web URLs, and the raw and API hosts only for github.com", () => {
    const fetcher = createGitHubFetcher([GITHUB, GHE]);

    expect(
      [
        "https://github.com/owner/repo",
        "https://raw.githubusercontent.com/owner/repo/main/README.md",
        "https://api.github.com/repos/owner/repo/contents/README.md",
        "https://ghe.example.com/platform/tools",
        "https://raw.ghe.example.com/platform/tools/main/README.md",
        "https://gist.github.com/owner/abc",
        "https://example.com/owner/repo",
        "not a url",
      ].map((url) => [url, fetcher.canFetch(url)]),
    ).toEqual([
      ["https://github.com/owner/repo", true],
      ["https://raw.githubusercontent.com/owner/repo/main/README.md", true],
      ["https://api.github.com/repos/owner/repo/contents/README.md", true],
      ["https://ghe.example.com/platform/tools", true],
      ["https://raw.ghe.example.com/platform/tools/main/README.md", false],
      ["https://gist.github.com/owner/abc", false],
      ["https://example.com/owner/repo", false],
      ["not a url", false],
    ]);
  });

  it("does not claim github.com without a github.com host", () => {
    const fetcher = createGitHubFetcher([GHE]);

    expect(fetcher.canFetch("https://github.com/owner/repo")).toBe(false);
    expect(fetcher.canFetch("https://raw.githubusercontent.com/owner/repo/main/x")).toBe(false);
  });

  it("reads an Enterprise URL through that host's API and names its source", async () => {
    const requests = stubFetch([
      json("/api/v3/repos/platform/tools/readme", {
        type: "file",
        name: "README.md",
        path: "README.md",
        size: 8,
        encoding: "base64",
        content: Buffer.from("# tools\n").toString("base64"),
        html_url: "https://ghe.example.com/platform/tools/blob/main/README.md",
      }),
    ]);

    const result = await fetchUrl(
      createGitHubFetcher([GITHUB, GHE]),
      "https://ghe.example.com/platform/tools",
    );

    expect(
      requests.map((request) => [
        `${request.url.host}${request.url.pathname}`,
        request.headers.get("authorization"),
      ]),
    ).toEqual([["ghe.example.com/api/v3/repos/platform/tools/readme", "token ghe-token"]]);
    expect(
      result.documents.map((document) => [document.source, document.title, document.facts]),
    ).toEqual([
      [
        "ghe",
        "platform/tools README",
        [
          "repo platform/tools",
          "path README.md",
          "whole repository: git clone https://ghe.example.com/platform/tools.git",
        ],
      ],
    ]);
    expect(await body(result, "README.md")).toBe("# tools\n");
  });

  it("resolves the token on the first fetch, not at construction", async () => {
    const tokenResolver = vi.fn(async () => "token");
    const fetcher = createGitHubFetcher([
      {
        source: "github",
        webUrl: "https://github.com",
        client: createGitHubClientProvider(tokenResolver, "https://github.com"),
      },
    ]);
    fetcher.canFetch("https://github.com/owner/repo");

    expect(tokenResolver).not.toHaveBeenCalled();
  });

  it("reports an unauthenticated Discussion as a failure for later fetchers to retry", async () => {
    stubFetch([
      (request) =>
        request.url.pathname === "/graphql"
          ? Response.json(
              { message: "This endpoint requires you to be authenticated." },
              { status: 401 },
            )
          : undefined,
    ]);
    const fetcher = createGitHubFetcher([
      {
        source: "github",
        webUrl: "https://github.com",
        client: createGitHubClientProvider(async () => undefined, "https://github.com"),
      },
    ]);

    const result = await fetchUrl(fetcher, "https://github.com/vercel/next.js/discussions/41745");

    expect(result).toEqual({
      documents: [],
      failures: [
        {
          url: "https://github.com/vercel/next.js/discussions/41745",
          reason:
            "GitHub API 401 during discussion vercel/next.js#41745: This endpoint requires you to be authenticated.",
        },
      ],
      warnings: [],
    });
  });
});

describe("GitHub pull request fetch", () => {
  const PATCH_LIMIT = 400_000;

  function pullRequestRoutes(files: unknown[]): Route[] {
    return [
      json("/repos/BurntSushi/ripgrep/pulls/2933", {
        title: "ignore: fix filtering searching subdir or .ignore in parent dir",
        html_url: "https://github.com/BurntSushi/ripgrep/pull/2933",
        state: "closed",
        user: { login: "WalterScottYoung" },
        draft: false,
        merged: true,
        base: { label: "BurntSushi:master" },
        head: { label: "WalterScottYoung:fix-subdir" },
        additions: 12,
        deletions: 3,
        changed_files: 2,
        commits: 1,
        body: "Fixes #2731.",
      }),
      json("/repos/BurntSushi/ripgrep/issues/2933/timeline", [
        { event: "subscribed", actor: { login: "lurker" }, created_at: "2024-11-15T12:30:00Z" },
        {
          event: "connected",
          actor: { login: "WalterScottYoung" },
          created_at: "2024-11-15T12:31:00Z",
        },
        {
          event: "merged",
          actor: { login: "BurntSushi" },
          commit_id: "14f4957b3d2e1e6ad7ce1ac0b8b9bd2c0ba2c00b",
          commit_url:
            "https://api.github.com/repos/BurntSushi/ripgrep/commits/14f4957b3d2e1e6ad7ce1ac0b8b9bd2c0ba2c00b",
          created_at: "2025-09-20T01:08:21Z",
        },
        {
          event: "closed",
          actor: { login: "BurntSushi" },
          commit_id: null,
          commit_url: null,
          created_at: "2025-09-20T01:08:22Z",
        },
      ]),
      json("/repos/BurntSushi/ripgrep/issues/2933/comments", [
        { user: { login: "BurntSushi" }, body: "Thanks!", created_at: "2025-09-20T01:00:00Z" },
      ]),
      json("/repos/BurntSushi/ripgrep/pulls/2933/reviews", [
        { user: { login: "BurntSushi" }, body: "", state: "APPROVED" },
      ]),
      json("/repos/BurntSushi/ripgrep/pulls/2933/comments", [
        {
          user: { login: "BurntSushi" },
          body: "Use a slice here.",
          path: "crates/ignore/src/dir.rs",
          diff_hunk: "@@ -1 +1 @@\n-old\n+new",
        },
      ]),
      json("/repos/BurntSushi/ripgrep/pulls/2933/files", files),
    ];
  }

  it("renders the conversation with its timeline", async () => {
    stubFetch(
      pullRequestRoutes([
        {
          filename: "crates/ignore/src/dir.rs",
          status: "modified",
          additions: 12,
          deletions: 3,
          patch: "@@ -1 +1 @@\n-old\n+new",
        },
      ]),
    );

    const result = await fetchUrl(
      createGitHubFetcher([GITHUB]),
      "https://github.com/BurntSushi/ripgrep/pull/2933",
    );

    expect(result.documents[0]?.facts).toEqual([
      "closed merged",
      "by WalterScottYoung",
      "+12 -3",
      "2 files",
      "1 issue comment",
      "1 review",
    ]);
    expect(
      await body(result, "conversation.md"),
    ).toBe(`# BurntSushi/ripgrep#2933: ignore: fix filtering searching subdir or .ignore in parent dir

- State: closed (merged)
- Author: WalterScottYoung
- Base: BurntSushi:master
- Head: WalterScottYoung:fix-subdir
- Changes: +12 -3 across 2 file(s)
- Commits: 1
- URL: https://github.com/BurntSushi/ripgrep/pull/2933

## Body

Fixes #2731.

## Timeline

- 2024-11-15 WalterScottYoung connected
- 2025-09-20 BurntSushi merged as commit 14f4957
- 2025-09-20 BurntSushi closed

## Issue comments

### BurntSushi at 2025-09-20T01:00:00Z

Thanks!

## Reviews

### APPROVED by BurntSushi



## Review comments

### crates/ignore/src/dir.rs by BurntSushi

\`\`\`diff
@@ -1 +1 @@
-old
+new
\`\`\`

Use a slice here.

## Files

| Status | File | + | - |
| --- | --- | ---: | ---: |
| modified | crates/ignore/src/dir.rs | 12 | 3 |`);
  });

  it("caps the patch text on a code point boundary and drops patches past the cap", async () => {
    // The emoji's four bytes straddle the cap, so the cut lands before it, not inside it.
    stubFetch(
      pullRequestRoutes([
        {
          filename: "big.txt",
          status: "added",
          additions: 1,
          deletions: 0,
          patch: `${"a".repeat(PATCH_LIMIT - 2)}💥after`,
        },
        { filename: "late.txt", status: "added", additions: 1, deletions: 0, patch: "+late" },
      ]),
    );

    const result = await fetchUrl(
      createGitHubFetcher([GITHUB]),
      "https://github.com/BurntSushi/ripgrep/pull/2933",
    );

    expect(await body(result, "diff.patch")).toBe(
      `diff --git a/big.txt b/big.txt\n--- a/big.txt\n+++ b/big.txt\n${"a".repeat(PATCH_LIMIT - 2)}\n[patch truncated]`,
    );
  });
});

describe("capped lists", () => {
  // GitHub pages by offset, page × per_page, so the stub must too for a probe page to be honest.
  function commitsByOffset(count: number): Route {
    const commits = Array.from({ length: count }, (_, index) => ({
      sha: `${index}`.padStart(40, "0"),
      html_url: `https://github.com/o/r/commit/${index}`,
      author: { login: "dev" },
      commit: { message: `change ${index}`, author: { name: "Dev", date: "2026-01-01T00:00:00Z" } },
    }));
    return (request) => {
      if (request.url.pathname !== "/repos/o/r/commits") return undefined;
      const page = Number(request.url.searchParams.get("page"));
      const perPage = Number(request.url.searchParams.get("per_page"));
      return Response.json(commits.slice((page - 1) * perPage, page * perPage));
    };
  }

  it("does not call a list of exactly the cap capped", async () => {
    stubFetch([commitsByOffset(100)]);
    const result = await fetchUrl(createGitHubFetcher([GITHUB]), "https://github.com/o/r/commits");
    expect(result.documents[0]?.facts[0]).toBe("100 commits");
  });

  it("calls a list past the cap capped", async () => {
    stubFetch([commitsByOffset(101)]);
    const result = await fetchUrl(createGitHubFetcher([GITHUB]), "https://github.com/o/r/commits");
    expect(result.documents[0]?.facts[0]).toBe("100 commits shown (capped at 100)");
  });
});
