import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { formatCount, plural } from "./delivery.ts";
import type { CheckoutRepoDetails } from "./tools/checkout-repo.ts";
import { REPO_TOOL_NAMES } from "./tools/names.ts";
import type { ProvideResultsDetails } from "./tools/provide-results.ts";
import type { ReadFileDetails } from "./tools/read-file.ts";
import type { SearchCodeGitHubDetails } from "./tools/search-code-github.ts";
import type { SearchCodeGrepAppDetails } from "./tools/search-code-grepapp.ts";
import type { SearchReposGitHubDetails } from "./tools/search-repos-github.ts";

export type RepoToolDetails =
  | SearchCodeGitHubDetails
  | SearchCodeGrepAppDetails
  | SearchReposGitHubDetails
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
  return `${formatCount(details.matchCount)} ${details.unit}${repos}${flags.length > 0 ? `, ${flags.join(", ")}` : ""}`;
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
      return summarizeCodeSearch(details, true);
    case "search_repos_github":
      return summarizeRepoSearch(details);
    case "read_file":
      return undefined;
    case "checkout_repo":
      return `${details.fileCount} files @ ${details.headSha.slice(0, 7)}`;
    case "provide_results":
      return plural(details.locationCount, "location");
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

  if (firstText !== undefined) {
    const lineCount = firstText.length === 0 ? 0 : firstText.split("\n").length;
    return `${lineCount} lines`;
  }

  return undefined;
}
