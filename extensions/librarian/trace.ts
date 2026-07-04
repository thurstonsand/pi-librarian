import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { CheckoutRepoDetails } from "./tools/checkout-repo.ts";
import { LIBRARIAN_RUN_TOOL_NAMES } from "./tools/names.ts";
import type { ProvideResultsDetails } from "./tools/provide-results.ts";
import type { ReadGitHubFileDetails } from "./tools/read-github-file.ts";
import type { SearchCodeDetails } from "./tools/search-code.ts";
import type { SearchGitHubCodeDetails } from "./tools/search-github-code.ts";
import type { SearchReposDetails } from "./tools/search-repos.ts";

type RepoToolDetails =
  | SearchReposDetails
  | SearchCodeDetails
  | SearchGitHubCodeDetails
  | CheckoutRepoDetails
  | ReadGitHubFileDetails
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
    LIBRARIAN_RUN_TOOL_NAMES.includes(details.kind as (typeof LIBRARIAN_RUN_TOOL_NAMES)[number])
  ) {
    return details as RepoToolDetails;
  }
  return undefined;
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
    switch (details.kind) {
      case "search_repos":
        return `${details.resultCount} of ${details.totalCount} repos`;
      case "search_code":
        return `${details.matchCount} hits · ${details.repoCount} repos · ${details.backend}`;
      case "search_github_code":
        return `${details.matchCount} hits · ${details.repoCount} repos · github`;
      case "checkout_repo":
        return `${details.reusedClone ? "cached" : "cloned"} · ${details.fileCount} files @ ${details.headSha.slice(0, 7)}`;
      case "read_github_file":
        return details.isDirectory ? `${details.lineCount} entries` : `${details.lineCount} lines`;
      case "provide_results":
        return `${details.locationCount} location${details.locationCount === 1 ? "" : "s"}`;
    }
  }

  if (firstText !== undefined) {
    const lineCount = firstText.length === 0 ? 0 : firstText.split("\n").length;
    return `${lineCount} lines`;
  }

  return undefined;
}
