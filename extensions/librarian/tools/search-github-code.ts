import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { GitHubClientProvider, GitHubCodeSearchResult, GitHubRepoSlug } from "../github.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";

export interface SearchGitHubCodeDetails {
  kind: "search_github_code";
  pattern: string;
  matchCount: number;
  repoCount: number;
}

const GitHubRepoScopeParams = Type.Object({
  owner: Type.String({ description: "Repository owner or organization." }),
  repo: Type.String({ description: "Repository name." }),
});

const SearchGitHubCodeParams = Type.Object({
  pattern: Type.String({
    description: "GitHub REST code search pattern.",
  }),
  repos: Type.Optional(
    Type.Array(GitHubRepoScopeParams, {
      description: "Restrict to these repositories.",
      maxItems: 20,
    }),
  ),
  owners: Type.Optional(
    Type.Array(Type.String(), {
      description: "Restrict to these owners/orgs.",
      maxItems: 20,
    }),
  ),
  language: Type.Optional(Type.String({ description: "Restrict to a language, e.g. typescript." })),
  path: Type.Optional(
    Type.String({
      description: "Restrict to file paths matching this pattern.",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 100,
      description: "Max results. Default: 30.",
    }),
  ),
});

export function buildGitHubCodeQuery(params: {
  pattern: string;
  repos?: GitHubRepoSlug[];
  owners?: string[];
  language?: string;
  path?: string;
}): string {
  const parts: string[] = [params.pattern.replace(/^\/|\/$/g, "")];

  for (const repo of params.repos ?? []) {
    parts.push(`repo:${repo.owner}/${repo.repo}`);
  }
  for (const owner of params.owners ?? []) {
    parts.push(`user:${owner}`);
  }
  if (params.language) {
    parts.push(`language:${params.language}`);
  }
  if (params.path) {
    parts.push(`path:${params.path}`);
  }

  return parts.join(" ");
}

function formatGitHubMatches(result: GitHubCodeSearchResult): string {
  return result.hits
    .map((hit) => {
      const fragments = hit.fragments
        .slice(0, 2)
        .map((fragment) => `    ${fragment.split("\n").slice(0, 3).join("\n    ")}`)
        .join("\n");
      return `  ${hit.repo}:${hit.path}${fragments ? `\n${fragments}` : ""}`;
    })
    .join("\n");
}

export function createSearchGitHubCodeTool(githubClient: GitHubClientProvider) {
  return defineTool<typeof SearchGitHubCodeParams, SearchGitHubCodeDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchGitHubCode,
    label: "Search GitHub code",
    description:
      "GitHub REST code search over public code and private repositories your configured GitHub auth can access.",
    promptSnippet: "Search GitHub code",
    promptGuidelines: [
      "Results are CANDIDATES to verify via checkout_repo/read_github_file — never cite them directly.",
      "GitHub REST code search is literal/tokenized and does not support regex; use search_code for public regex/global code search.",
    ],
    parameters: SearchGitHubCodeParams,

    async execute(_toolCallId, params) {
      const limit = params.limit ?? 30;
      const github = await githubClient();
      const result = await github.searchCode({
        pattern: params.pattern,
        ...(params.repos ? { repos: params.repos } : {}),
        ...(params.owners ? { owners: params.owners } : {}),
        ...(params.language ? { language: params.language } : {}),
        ...(params.path ? { path: params.path } : {}),
        limit,
      });
      const repoCount = new Set(result.hits.map((hit) => hit.repo)).size;
      const body = result.hits.length === 0 ? "No matches." : formatGitHubMatches(result);
      const header = `${result.hits.length} of ${result.totalCount} matches across ${repoCount} repos (github).`;

      return {
        content: [{ type: "text", text: `${header}\n\n${body}` }],
        details: {
          kind: "search_github_code",
          pattern: params.pattern,
          matchCount: result.hits.length,
          repoCount,
        },
      };
    },
  });
}
