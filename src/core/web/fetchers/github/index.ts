import type { GitHubClientProvider } from "../../../github.ts";
import type { FetchedDocument, FetcherResult, FetchFailure, WebFetcher } from "../../contract.ts";
import { getErrorMessage } from "../../shared.ts";
import { fetchActionRun, fetchActionRunList } from "./action-run.ts";
import { fetchCommit } from "./commit.ts";
import { fetchCommitList } from "./commit-list.ts";
import { fetchDirectory, fetchFile, fetchReadme, resolveRefPath } from "./content.ts";
import { fetchDiscussion } from "./discussion.ts";
import { fetchIssue } from "./issue.ts";
import { fetchListing } from "./listing.ts";
import { fetchPullRequest } from "./pull-request.ts";
import { fetchLatestRelease, fetchRelease } from "./release.ts";
import { fetchRepositoryCollection } from "./repository-collection.ts";
import type { GitHubFetchContext } from "./shared.ts";
import { type ParsedGitHubUrl, parseGitHubUrl, servesUrl } from "./urls.ts";

// One configured GitHub source: its name, its web origin, and its lazily authenticated client.
export interface GitHubFetchHost {
  source: string;
  webUrl: string;
  client: GitHubClientProvider;
}

type ResolverResult =
  | { status: "resolved"; document: FetchedDocument }
  | { status: "unsupported" }
  | { status: "failed"; reason: string };

export function createGitHubFetcher(hosts: GitHubFetchHost[]): WebFetcher {
  function hostFor(url: string): GitHubFetchHost | undefined {
    return hosts.find((host) => servesUrl(host.webUrl, url));
  }

  async function fetchOne(
    url: string,
    signal: AbortSignal | undefined,
    artifactDir: string,
  ): Promise<ResolverResult> {
    const host = hostFor(url);
    if (!host) return { status: "unsupported" };
    try {
      const parsed = parseGitHubUrl(url, host.webUrl);
      if (!parsed) return { status: "unsupported" };
      const context: GitHubFetchContext = {
        client: await host.client(),
        source: host.source,
        webUrl: host.webUrl,
        signal,
        artifactDir,
      };
      return { status: "resolved", document: await resolveGitHubUrl(context, parsed) };
    } catch (error) {
      return { status: "failed", reason: getErrorMessage(error) };
    }
  }

  return {
    source: "github",
    promptGuidelines: [
      "Use web_fetch directly on GitHub URLs for source-native API results: repos, files, and directories; issues, PRs, and Discussions with their conversations; commits and patches; commit history for a repo, branch, or file path; tagged and latest releases with asset metadata; Actions runs with jobs and artifacts; and issue, PR, release, tag, branch, and Actions-run listings.",
    ],
    canFetch: (url) => hostFor(url) !== undefined,
    async fetch({ urls, signal, artifactDir }): Promise<FetcherResult> {
      if (signal?.aborted) throw new Error("Fetch cancelled.");
      const results = await Promise.all(
        urls.map(async (url) => ({ url, result: await fetchOne(url, signal, artifactDir) })),
      );
      const documents: FetchedDocument[] = [];
      const failures: FetchFailure[] = [];

      for (const { url, result } of results) {
        if (result.status === "resolved") {
          documents.push(result.document);
        } else if (result.status === "failed") {
          failures.push({ url, reason: result.reason });
        }
      }

      return { documents, failures, warnings: [] };
    },
  };
}

async function resolveGitHubUrl(
  context: GitHubFetchContext,
  parsed: ParsedGitHubUrl,
): Promise<FetchedDocument> {
  switch (parsed.type) {
    case "file":
      return await fetchFile(context, parsed.target);
    case "readme":
      return await fetchReadme(context, parsed.target);
    case "issue":
      return await fetchIssue(context, parsed.target);
    case "pull_request":
      return await fetchPullRequest(context, parsed.target);
    case "release":
      return await fetchRelease(context, parsed.target);
    case "latest_release":
      return await fetchLatestRelease(context, parsed.target);
    case "commit":
      return await fetchCommit(context, parsed.target);
    case "commit_list":
      return await fetchCommitList(context, parsed.target);
    case "repository_collection":
      return await fetchRepositoryCollection(context, parsed.target);
    case "action_run":
      return await fetchActionRun(context, parsed.target);
    case "action_run_list":
      return await fetchActionRunList(context, parsed.target);
    case "discussion":
      return await fetchDiscussion(context, parsed.target);
    case "issue_list":
    case "pull_request_list":
      return await fetchListing(context, parsed.target);
    case "ambiguous_file": {
      const resolved = await resolveRefPath(context, parsed.target, "file");
      return await fetchFile(context, { ...resolved, url: parsed.target.url });
    }
    case "ambiguous_directory": {
      const resolved = await resolveRefPath(context, parsed.target, "directory");
      return await fetchDirectory(context, { ...resolved, url: parsed.target.url });
    }
  }
}
