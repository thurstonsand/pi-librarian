import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { GitHubApiError, type GitHubClientProvider } from "../github.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";

export interface SearchReposDetails {
  kind: "search_repos";
  query: string;
  resultCount: number;
  totalCount: number;
}

const SearchReposParams = Type.Object({
  query: Type.String({
    description:
      "GitHub repository search query. Plain terms plus qualifiers like language:typescript, topic:orm, stars:>1000, org:vercel.",
  }),
  sort: Type.Optional(
    Type.Union([Type.Literal("stars"), Type.Literal("updated"), Type.Literal("best-match")], {
      description: "Result ordering. Default: stars.",
    }),
  ),
  limit: Type.Optional(
    Type.Number({
      minimum: 1,
      maximum: 50,
      description: "Max results. Default: 10.",
    }),
  ),
});

export function createSearchReposTool(githubClient: GitHubClientProvider) {
  return defineTool<typeof SearchReposParams, SearchReposDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchRepos,
    label: "Search repos metadata",
    description: "Discover GitHub repositories.",
    promptSnippet: "Search GitHub repos by metadata",
    promptGuidelines: ['Use search_repos for questions like "what are the popular X libraries".'],
    parameters: SearchReposParams,

    async execute(_toolCallId, params) {
      const limit = params.limit ?? 10;
      try {
        const github = await githubClient();
        const result = await github.searchRepositories({
          query: params.query,
          sort: params.sort ?? "stars",
          limit,
        });

        const lines = result.hits.map((hit) => {
          const meta: string[] = [`★${hit.stars}`];
          if (hit.language) {
            meta.push(hit.language);
          }
          if (hit.pushedAt) {
            meta.push(`pushed ${hit.pushedAt.slice(0, 10)}`);
          }
          if (hit.archived) {
            meta.push("ARCHIVED");
          }
          if (hit.fork) {
            meta.push("fork");
          }

          const topics = hit.topics.length > 0 ? `\n  topics: ${hit.topics.join(", ")}` : "";
          const description = hit.description ? `\n  ${hit.description}` : "";
          return `${hit.repo} (${meta.join(" · ")})${description}${topics}`;
        });

        const header = `${result.totalCount} repositories match; showing ${result.hits.length}.`;
        return {
          content: [{ type: "text", text: [header, ...lines].join("\n\n") }],
          details: {
            kind: "search_repos",
            query: params.query,
            resultCount: result.hits.length,
            totalCount: result.totalCount,
          },
        };
      } catch (error) {
        const message =
          error instanceof GitHubApiError && error.retryAfterSeconds !== undefined
            ? `${error.message} (retry after ~${error.retryAfterSeconds}s)`
            : error instanceof Error
              ? error.message
              : String(error);
        throw new Error(message);
      }
    },
  });
}
