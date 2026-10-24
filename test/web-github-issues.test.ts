import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubClientProvider } from "../extensions/librarian/github.ts";
import type { FetcherResult } from "../extensions/librarian/web/contract.ts";
import { createGitHubFetcher } from "../extensions/librarian/web/fetchers/github/index.ts";
import { type Route, stubFetch } from "./support/fetch-stub.ts";

let artifactDir: string;

beforeEach(async () => {
  artifactDir = await mkdtemp(path.join(os.tmpdir(), "web-github-"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function fetchUrl(url: string): Promise<FetcherResult> {
  const fetcher = createGitHubFetcher([
    {
      source: "github",
      webUrl: "https://github.com",
      client: createGitHubClientProvider(async () => "token", "https://github.com"),
    },
  ]);
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

const RIPGREP_ISSUE = {
  title: "Inconsistent behavior with negation pattern in `.gitignore`",
  html_url: "https://github.com/BurntSushi/ripgrep/issues/2731",
  state: "closed",
  state_reason: "completed",
  user: { login: "Nadrieril" },
  created_at: "2024-02-07T17:35:45Z",
  updated_at: "2025-09-20T01:08:22Z",
  body: "A negated pattern in a subdirectory .gitignore is ignored.",
  comments: 2,
  labels: [{ name: "bug" }, { name: "rollup" }],
};

const RIPGREP_COMMENTS = [
  {
    user: { login: "BurntSushi" },
    body: "This is a duplicate of #2284.",
    created_at: "2024-02-07T22:08:40Z",
  },
  { user: null, body: "Still happens on 14.1.", created_at: "2024-05-01T10:00:00Z" },
];

// Noise kinds carry fields of their own shape, and none of them may surface.
const RIPGREP_TIMELINE = [
  {
    event: "commented",
    user: { login: "BurntSushi" },
    body: "This is a duplicate of #2284.",
    created_at: "2024-02-07T22:08:40Z",
  },
  {
    event: "closed",
    actor: { login: "Nadrieril" },
    commit_id: null,
    commit_url: null,
    created_at: "2024-02-07T22:08:45Z",
    state_reason: "not_planned",
  },
  { event: "reopened", actor: { login: "Nadrieril" }, created_at: "2024-02-07T22:13:11Z" },
  { event: "subscribed", actor: { login: "lurker" }, created_at: "2024-03-01T00:00:00Z" },
  {
    event: "cross-referenced",
    actor: { login: "nnethercote" },
    created_at: "2024-05-28T09:34:14Z",
    updated_at: "2024-05-28T09:34:14Z",
    source: {
      type: "issue",
      issue: {
        number: 125637,
        title: "rustfmt fixes",
        state: "closed",
        state_reason: null,
        repository_url: "https://api.github.com/repos/rust-lang/rust",
        pull_request: { merged_at: "2024-05-28T20:30:00Z" },
      },
    },
  },
  { event: "mentioned", actor: { login: "lurker" }, created_at: "2024-06-01T00:00:00Z" },
  { event: "labeled", label: { name: "rollup" }, created_at: "2025-09-19T00:00:00Z" },
  {
    event: "closed",
    actor: { login: "BurntSushi" },
    commit_id: "14f4957b3d605f14ad58bc67e54197a3084fef5a",
    commit_url:
      "https://api.github.com/repos/BurntSushi/ripgrep/commits/14f4957b3d605f14ad58bc67e54197a3084fef5a",
    created_at: "2025-09-20T01:08:22Z",
    state_reason: null,
  },
  {
    event: "referenced",
    actor: { login: "netbsd-srcmastr" },
    commit_id: "d4d1cf619ba823d58b34b35a8d17017c4d4319aa",
    commit_url:
      "https://api.github.com/repos/NetBSD/pkgsrc/commits/d4d1cf619ba823d58b34b35a8d17017c4d4319aa",
    created_at: "2025-10-17T11:58:02Z",
  },
  {
    event: "cross-referenced",
    actor: { login: "WalterScottYoung" },
    created_at: "2025-10-20T12:29:06Z",
    source: {
      type: "issue",
      issue: {
        number: 3144,
        title: "Gitignore rules not behaving correctly when inside a subdirectory",
        state: "closed",
        state_reason: "duplicate",
        repository_url: "https://api.github.com/repos/BurntSushi/ripgrep",
      },
    },
  },
];

function ripgrepRoutes(timeline: unknown[]): Route[] {
  return [
    json("/repos/BurntSushi/ripgrep/issues/2731", RIPGREP_ISSUE),
    json("/repos/BurntSushi/ripgrep/issues/2731/comments", RIPGREP_COMMENTS),
    json("/repos/BurntSushi/ripgrep/issues/2731/timeline", timeline),
  ];
}

describe("GitHub issue fetch", () => {
  it("keeps only resolution events from the timeline and names the closing commit", async () => {
    stubFetch(ripgrepRoutes(RIPGREP_TIMELINE));

    const result = await fetchUrl("https://github.com/BurntSushi/ripgrep/issues/2731");

    expect(result.failures).toEqual([]);
    expect(result.documents[0]?.facts).toEqual([
      "closed (completed)",
      "closed by commit 14f4957",
      "by Nadrieril",
      "2 comments",
      "labels bug, rollup",
    ]);
    expect(
      await body(result, "conversation.md"),
    ).toBe(`# BurntSushi/ripgrep#2731: Inconsistent behavior with negation pattern in \`.gitignore\`

- State: closed (completed)
- Author: Nadrieril
- Created: 2024-02-07T17:35:45Z
- Updated: 2025-09-20T01:08:22Z
- URL: https://github.com/BurntSushi/ripgrep/issues/2731

## Body

A negated pattern in a subdirectory .gitignore is ignored.

## Timeline

- 2024-02-07 Nadrieril closed (not_planned)
- 2024-02-07 Nadrieril reopened
- 2024-05-28 nnethercote cross-referenced from PR rust-lang/rust#125637 [closed/merged] rustfmt fixes
- 2025-09-20 BurntSushi closed by commit 14f4957
- 2025-10-17 netbsd-srcmastr referenced from commit d4d1cf6 in NetBSD/pkgsrc
- 2025-10-20 WalterScottYoung cross-referenced from issue BurntSushi/ripgrep#3144 [closed/duplicate] Gitignore rules not behaving correctly when inside a subdirectory

## Comments

### BurntSushi at 2024-02-07T22:08:40Z

This is a duplicate of #2284.

### unknown at 2024-05-01T10:00:00Z

Still happens on 14.1.`);
  });

  it("claims no closing commit when the issue was closed without one", async () => {
    stubFetch([
      json("/repos/drizzle-team/drizzle-orm/issues/675", {
        ...RIPGREP_ISSUE,
        title: "onConflictDoUpdate does not quote camelCase columns",
        html_url: "https://github.com/drizzle-team/drizzle-orm/issues/675",
        comments: 0,
        labels: [],
      }),
      json("/repos/drizzle-team/drizzle-orm/issues/675/comments", []),
      json("/repos/drizzle-team/drizzle-orm/issues/675/timeline", [
        {
          event: "closed",
          actor: { login: "dankochetov" },
          commit_id: null,
          commit_url: null,
          created_at: "2023-06-01T08:00:00Z",
          state_reason: "completed",
        },
      ]),
    ]);

    const result = await fetchUrl("https://github.com/drizzle-team/drizzle-orm/issues/675");

    expect(result.documents[0]?.facts).toEqual([
      "closed (completed)",
      "by Nadrieril",
      "0 comments",
    ]);
    expect(await body(result, "conversation.md")).toContain(
      "## Timeline\n\n- 2023-06-01 dankochetov closed (completed)\n\n## Comments",
    );
  });

  it("fails the URL when a kept timeline event is malformed", async () => {
    stubFetch(
      ripgrepRoutes([
        { event: "subscribed" },
        { event: "closed", actor: { login: "BurntSushi" }, commit_id: null, commit_url: null },
      ]),
    );

    const result = await fetchUrl("https://github.com/BurntSushi/ripgrep/issues/2731");

    expect(result).toEqual({
      documents: [],
      failures: [
        {
          url: "https://github.com/BurntSushi/ripgrep/issues/2731",
          reason:
            "GitHub timeline of BurntSushi/ripgrep#2731: closed event: / must have required properties created_at",
        },
      ],
      warnings: [],
    });
  });

  it("fails the URL when the issue itself is malformed", async () => {
    stubFetch(
      ripgrepRoutes([]).map((route, index) =>
        index === 0
          ? json("/repos/BurntSushi/ripgrep/issues/2731", { ...RIPGREP_ISSUE, labels: ["bug"] })
          : route,
      ),
    );

    const result = await fetchUrl("https://github.com/BurntSushi/ripgrep/issues/2731");

    expect(result.failures).toEqual([
      {
        url: "https://github.com/BurntSushi/ripgrep/issues/2731",
        reason: "GitHub issue BurntSushi/ripgrep#2731: /labels/0 must be object",
      },
    ]);
  });
});

describe("GitHub issue and pull request listings", () => {
  it("shows each match's resolution in the excerpt", async () => {
    const requests = stubFetch([
      json("/search/issues", {
        total_count: 240,
        items: [
          searchItem(675, "onConflictDoUpdate camelCase", "closed", "completed", 6),
          searchItem(1001, "onConflictDoUpdate with composite key", "open", null, 1),
          {
            ...searchItem(2040, "fix: quote onConflictDoUpdate targets", "closed", null, 3),
            pull_request: { merged_at: "2024-03-01T00:00:00Z" },
          },
          {
            ...searchItem(2050, "wip: onConflictDoUpdate where", "open", null, 0),
            draft: true,
            pull_request: { merged_at: null },
          },
          {
            ...searchItem(2060, "onConflictDoUpdate alt", "closed", null, 2),
            draft: false,
            pull_request: { merged_at: null },
          },
        ],
      }),
    ]);

    const result = await fetchUrl(
      "https://github.com/drizzle-team/drizzle-orm/issues?q=onConflictDoUpdate",
    );

    expect(requests.map((request) => request.url.searchParams.get("q"))).toEqual([
      "repo:drizzle-team/drizzle-orm is:issue onConflictDoUpdate",
    ]);
    expect(result.documents[0]?.facts).toEqual([
      "240 matches, showing first 5",
      "query: repo:drizzle-team/drizzle-orm is:issue onConflictDoUpdate",
    ]);
    expect(result.documents[0]?.excerpt).toBe(
      [
        "#675 [closed/completed] onConflictDoUpdate camelCase (6 comments)",
        "#1001 [open] onConflictDoUpdate with composite key (1 comment)",
        "#2040 [closed/merged] fix: quote onConflictDoUpdate targets (3 comments)",
        "#2050 [open/draft] wip: onConflictDoUpdate where (0 comments)",
        "#2060 [closed] onConflictDoUpdate alt (2 comments)",
      ].join("\n"),
    );
  });

  it.each([
    ["https://github.com/owner/repo/issues", "repo:owner/repo is:issue state:open"],
    ["https://github.com/owner/repo/pulls", "repo:owner/repo is:pr state:open"],
    ["https://github.com/owner/repo/issues?q=label%3Abug", "repo:owner/repo is:issue label:bug"],
    [
      "https://github.com/owner/repo/issues?q=is%3Aclosed+extraction",
      "repo:owner/repo is:issue is:closed extraction",
    ],
    [
      "https://github.com/owner/repo/issues?q=is%3Apr+is%3Amerged",
      "repo:owner/repo is:pr is:merged",
    ],
    [
      "https://github.com/owner/repo/pulls?q=type%3Aissue+crash",
      "repo:owner/repo type:issue crash",
    ],
    // GitHub no longer reads is:merged as PR-only, so the type qualifier is still added.
    [
      "https://github.com/owner/repo/pulls?q=is%3Amerged+sort%3Acreated-asc",
      "repo:owner/repo is:pr is:merged sort:created-asc",
    ],
  ])("searches %s as %s", async (url, query) => {
    const requests = stubFetch([json("/search/issues", { total_count: 0, items: [] })]);

    const result = await fetchUrl(url);

    expect(requests.map((request) => request.url.searchParams.get("q"))).toEqual([query]);
    expect(result.documents[0]?.excerpt).toBeUndefined();
  });
});

function searchItem(
  number: number,
  title: string,
  state: string,
  stateReason: string | null,
  comments: number,
) {
  return {
    number,
    title,
    state,
    state_reason: stateReason,
    user: { login: "someone" },
    labels: [],
    comments,
    updated_at: "2024-03-01T00:00:00Z",
    html_url: `https://github.com/drizzle-team/drizzle-orm/issues/${number}`,
  };
}
