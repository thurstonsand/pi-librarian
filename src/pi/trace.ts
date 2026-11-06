import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { formatCount, plural } from "../core/delivery.ts";
import type { CheckoutRepoDetails } from "../core/tools/checkout-repo.ts";
import type { FindDefinitionDetails } from "../core/tools/find-definition.ts";
import { REPO_TOOL_NAMES } from "../core/tools/names.ts";
import type { ReadFileDetails } from "../core/tools/read-file.ts";
import type { SearchCodeBitbucketDetails } from "../core/tools/search-code-bitbucket.ts";
import type { SearchCodeGitHubDetails } from "../core/tools/search-code-github.ts";
import type { SearchCodeGitLabDetails } from "../core/tools/search-code-gitlab.ts";
import type { SearchCodeGrepAppDetails } from "../core/tools/search-code-grepapp.ts";
import type { SearchCodeSourcegraphDetails } from "../core/tools/search-code-sourcegraph.ts";
import type { SearchReposBitbucketDetails } from "../core/tools/search-repos-bitbucket.ts";
import type { SearchReposGitHubDetails } from "../core/tools/search-repos-github.ts";
import type { SearchReposGitLabDetails } from "../core/tools/search-repos-gitlab.ts";
import type { SearchReposSourcegraphDetails } from "../core/tools/search-repos-sourcegraph.ts";
import type { WebFetchDetails } from "../core/web/fetch.ts";
import type { WebSearchDetails } from "../core/web/search.ts";
import type { ProvideResultsDetails } from "./provide-results.ts";

export type RepoToolDetails =
  | SearchCodeGitHubDetails
  | SearchCodeGrepAppDetails
  | SearchCodeSourcegraphDetails
  | SearchCodeGitLabDetails
  | SearchCodeBitbucketDetails
  | SearchReposBitbucketDetails
  | SearchReposGitLabDetails
  | SearchReposGitHubDetails
  | SearchReposSourcegraphDetails
  | FindDefinitionDetails
  | ReadFileDetails
  | CheckoutRepoDetails
  | ProvideResultsDetails;

interface ToolResultShape {
  content?: { type: string; text?: string }[];
  details?: unknown;
}

export function asRepoToolDetails(details: unknown): RepoToolDetails | undefined {
  if (
    details &&
    typeof details === "object" &&
    "kind" in details &&
    typeof details.kind === "string" &&
    REPO_TOOL_NAMES.includes(details.kind)
  ) {
    return details as RepoToolDetails;
  }
  return undefined;
}

interface CodeSearchSummary {
  unit: "repos" | "files" | "matches";
  atLeast?: boolean;
  matchCount: number;
  repoCount: number | undefined;
  complete: boolean | undefined;
}

function summarizeCodeSearch(details: CodeSearchSummary, ranked: boolean): string {
  const repos =
    details.unit === "repos" || details.repoCount === undefined
      ? ""
      : ` · ${plural(details.repoCount, "repo")}`;
  const flags = [
    ...(details.complete === false ? ["incomplete"] : []),
    ...(ranked ? [] : ["unranked"]),
  ];
  const singular = { repos: "repo", files: "file", matches: "match" }[details.unit];
  const count = details.atLeast
    ? `${formatCount(details.matchCount)}+ ${details.unit}`
    : plural(details.matchCount, singular, details.unit);
  return `${count}${repos}${flags.length > 0 ? `, ${flags.join(", ")}` : ""}`;
}

interface RepoSearchSummary {
  matchCount: number;
  fetchedCount: number;
  complete: boolean | undefined;
}

function summarizeRepoSearch(details: RepoSearchSummary): string {
  const count =
    details.fetchedCount < details.matchCount
      ? `${formatCount(details.fetchedCount)} of ${formatCount(details.matchCount)} repos`
      : plural(details.matchCount, "repo");
  return details.complete === false ? `${count}, incomplete` : count;
}

export function summarizeRepoToolDetails(details: RepoToolDetails): string | undefined {
  switch (details.kind) {
    case "search_code_github":
    case "search_code_grepapp":
    case "search_code_sourcegraph":
    case "search_code_bitbucket":
      return summarizeCodeSearch(details, true);
    case "search_code_gitlab":
      return summarizeCodeSearch(details, details.ranked);
    case "search_repos_gitlab":
    case "search_repos_bitbucket":
    case "search_repos_github":
    case "search_repos_sourcegraph":
      return summarizeRepoSearch(details);
    case "find_definition": {
      const count = plural(details.matchCount, "definition");
      return details.complete ? count : `${count}, incomplete`;
    }
    case "read_file":
      return undefined;
    case "checkout_repo":
      return `${details.fileCount} files @ ${details.headSha.slice(0, 7)}`;
    case "provide_results":
      return plural(details.locationCount, "location");
  }
}

function summarizeWebDetails(details: unknown): string | undefined {
  if (!details || typeof details !== "object" || !("kind" in details)) {
    return undefined;
  }
  switch (details.kind) {
    case "web_fetch": {
      const fetched = details as WebFetchDetails;
      const documents = plural(fetched.count, "document");
      return fetched.failed.length > 0
        ? `${documents}, ${fetched.failed.length} failed`
        : documents;
    }
    case "web_search":
      return plural((details as WebSearchDetails).count, "result");
    default:
      return undefined;
  }
}

export function summarizeToolResult(
  result: AgentToolResult<unknown> | ToolResultShape | undefined,
  isError: boolean,
): string | undefined {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const firstText = result.content?.find(
    (part): part is { type: "text"; text: string } =>
      part.type === "text" && "text" in part && typeof part.text === "string",
  )?.text;
  if (isError) {
    return firstText?.split("\n")[0]?.slice(0, 120);
  }

  const details = asRepoToolDetails(result.details);
  if (details) {
    return summarizeRepoToolDetails(details);
  }
  const web = summarizeWebDetails(result.details);
  if (web !== undefined) {
    return web;
  }

  if (firstText !== undefined) {
    const lineCount = firstText.length === 0 ? 0 : firstText.split("\n").length;
    return `${lineCount} lines`;
  }

  return undefined;
}
