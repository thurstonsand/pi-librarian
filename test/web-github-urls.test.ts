import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createGitHubClientProvider } from "../extensions/librarian/github.ts";
import type { FetcherResult } from "../extensions/librarian/web/contract.ts";
import { createGitHubFetcher } from "../extensions/librarian/web/fetchers/github/index.ts";
import { type RecordedRequest, stubFetch } from "./support/fetch-stub.ts";

let artifactDir: string;

beforeEach(async () => {
  artifactDir = await mkdtemp(path.join(os.tmpdir(), "web-github-"));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// No route answers, so each fetch stops at its first API request; that request is what a URL
// resolves to.
async function fetchUnanswered(
  url: string,
): Promise<{ requests: RecordedRequest[]; result: FetcherResult }> {
  const requests = stubFetch([]);
  const fetcher = createGitHubFetcher([
    {
      source: "github",
      webUrl: "https://github.com",
      client: createGitHubClientProvider(async () => "token", "https://github.com"),
    },
  ]);
  const result = await fetcher.fetch({ urls: [url], artifactDir, ctx: {} as ExtensionContext });
  return { requests, result };
}

async function firstRequest(url: string): Promise<string> {
  const { requests } = await fetchUnanswered(url);
  const first = requests[0];
  if (!first) throw new Error(`${url} made no request`);
  return `${first.method} ${first.url.host}${first.url.pathname}${first.url.search}`;
}

describe("GitHub URL resolution", () => {
  it.each([
    ["https://github.com/owner/repo", "GET api.github.com/repos/owner/repo/readme"],
    ["https://github.com/owner/repo/issues/456", "GET api.github.com/repos/owner/repo/issues/456"],
    [
      "https://github.com/owner/repo/issues/456/comments",
      "GET api.github.com/repos/owner/repo/issues/456",
    ],
    ["https://github.com/owner/repo/pull/123", "GET api.github.com/repos/owner/repo/pulls/123"],
    [
      "https://github.com/owner/repo/pull/123/files",
      "GET api.github.com/repos/owner/repo/pulls/123",
    ],
    ["https://github.com/owner/repo/pulls/123", "GET api.github.com/repos/owner/repo/pulls/123"],
    ["https://github.com/owner/repo/pull/12.patch", "GET api.github.com/repos/owner/repo/pulls/12"],
    [
      "https://github.com/handy-computer/transcribe.cpp/releases/tag/v0.1.3",
      "GET api.github.com/repos/handy-computer/transcribe.cpp/releases/tags/v0.1.3",
    ],
    [
      "https://github.com/owner/repo/releases/tag/release%2Fv1",
      "GET api.github.com/repos/owner/repo/releases/tags/release%2Fv1",
    ],
    [
      "https://github.com/owner/repo/releases/latest",
      "GET api.github.com/repos/owner/repo/releases/latest",
    ],
    [
      "https://github.com/owner/repo/releases",
      "GET api.github.com/repos/owner/repo/releases?page=1&per_page=100",
    ],
    [
      "https://github.com/owner/repo/tags",
      "GET api.github.com/repos/owner/repo/tags?page=1&per_page=100",
    ],
    [
      "https://github.com/owner/repo/branches",
      "GET api.github.com/repos/owner/repo/branches?page=1&per_page=100",
    ],
    [
      "https://github.com/owner/repo/commit/deadbeef",
      "GET api.github.com/repos/owner/repo/commits/deadbeef?per_page=1",
    ],
    [
      "https://github.com/owner/repo/commit/deadbeef.patch",
      "GET api.github.com/repos/owner/repo/commits/deadbeef?per_page=1",
    ],
    [
      "https://github.com/owner/repo/commit/deadbeef.diff",
      "GET api.github.com/repos/owner/repo/commits/deadbeef?per_page=1",
    ],
    [
      "https://github.com/owner/repo/commits",
      "GET api.github.com/repos/owner/repo/commits?page=1&per_page=100",
    ],
    [
      "https://github.com/owner/repo/commits/main",
      "GET api.github.com/repos/owner/repo/commits?sha=main&page=1&per_page=100",
    ],
    // The ref/path split is probed one candidate at a time, shortest ref first.
    [
      "https://github.com/owner/repo/commits/main/packages/app/CHANGELOG.md",
      "GET api.github.com/repos/owner/repo/commits?sha=main&path=packages%2Fapp%2FCHANGELOG.md&page=1&per_page=1",
    ],
    [
      "https://github.com/owner/repo/actions",
      "GET api.github.com/repos/owner/repo/actions/runs?per_page=100",
    ],
    [
      "https://github.com/owner/repo/actions/runs",
      "GET api.github.com/repos/owner/repo/actions/runs?per_page=100",
    ],
    [
      "https://github.com/owner/repo/actions/runs/123456",
      "GET api.github.com/repos/owner/repo/actions/runs/123456",
    ],
    [
      "https://github.com/owner/repo/actions/runs/123456/job/789",
      "GET api.github.com/repos/owner/repo/actions/runs/123456",
    ],
    [
      "https://github.com/owner/repo/blob/main/src/index.ts",
      "GET api.github.com/repos/owner/repo/contents/src%2Findex.ts?ref=main",
    ],
    [
      "https://github.com/owner/repo/tree/main/src",
      "GET api.github.com/repos/owner/repo/contents/src?ref=main",
    ],
    [
      "https://raw.githubusercontent.com/owner/repo/main/README.md",
      "GET api.github.com/repos/owner/repo/contents/README.md?ref=main",
    ],
    [
      "https://api.github.com/repos/owner/repo/contents/docs/guide.md?ref=v2",
      "GET api.github.com/repos/owner/repo/contents/docs%2Fguide.md?ref=v2",
    ],
  ])("resolves %s to %s", async (url, request) => {
    expect(await firstRequest(url)).toBe(request);
  });

  it("asks GraphQL for a discussion", async () => {
    const { requests } = await fetchUnanswered("https://github.com/owner/repo/discussions/42");

    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "POST https://api.github.com/graphql",
    ]);
    expect(JSON.parse(requests[0]?.body ?? "").variables).toEqual({
      owner: "owner",
      repo: "repo",
      number: 42,
    });
  });

  it.each([
    "https://github.com/owner/repo/issues/new",
    "https://github.com/owner/repo/releases/tag",
    "https://github.com/owner/repo/commit/deadbeef/files",
    "https://github.com/owner/repo/actions/runs/123abc",
    "https://github.com/owner/repo/discussions/42abc",
    "https://github.com/owner",
  ])("leaves %s to later fetchers without a request", async (url) => {
    const { requests, result } = await fetchUnanswered(url);

    expect(requests).toEqual([]);
    expect(result).toEqual({ documents: [], failures: [], warnings: [] });
  });
});
