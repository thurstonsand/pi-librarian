import { type Static, Type } from "typebox";
import { defineTool } from "../tool.ts";
import type { FetchWarning } from "./contract.ts";
import {
  buildSearchSummary,
  clampMaxResults,
  DEFAULT_MAX_RESULTS,
  DEFAULT_SEARCH_MODE,
  normalizeSearchQueries,
  type ParallelClient,
  type ParallelSearchHit,
  parseParallelSearchResponse,
  validateAfterDate,
} from "./parallel.ts";
import { getErrorMessage } from "./shared.ts";

export interface WebSearchDetails {
  kind: "web_search";
  objective: string;
  count: number;
  results: ParallelSearchHit[];
  warnings: FetchWarning[];
}

export const searchParameters = Type.Object({
  objective: Type.String({
    description: "What you want to learn from the web search.",
  }),
  search_queries: Type.Optional(
    Type.Array(Type.String({ description: "A search query string." }), {
      description:
        "Specific search queries to run. If omitted, the objective is used as a single query.",
      minItems: 1,
      maxItems: 8,
    }),
  ),
  max_results: Type.Optional(
    Type.Integer({
      description: `Upper bound on results to return. Defaults to ${DEFAULT_MAX_RESULTS}; capped at 8.`,
      minimum: 1,
      maximum: 8,
    }),
  ),
  after_date: Type.Optional(
    Type.String({
      description:
        "Only include results published on or after this RFC 3339 date (YYYY-MM-DD). Set it when recent results matter.",
    }),
  ),
});

const webSearchOutput = Type.Object({
  results: Type.Array(
    Type.Object({
      url: Type.String(),
      title: Type.Optional(Type.String()),
      publish_date: Type.Optional(Type.String()),
      excerpts: Type.Array(Type.String()),
    }),
  ),
  warnings: Type.Array(Type.Object({ message: Type.String(), type: Type.Optional(Type.String()) })),
});

export function createWebSearchTool(client: ParallelClient) {
  return defineTool<typeof searchParameters, WebSearchDetails | undefined>({
    name: "web_search",
    label: "Search Web",
    description: "Search the web and return relevant results with excerpts.",
    promptSnippet: "Search the web for sources and current information",
    promptGuidelines: ["Prefer a focused objective and 1-5 specific queries for web_search."],
    parameters: searchParameters,
    outputSchema: webSearchOutput,
    annotations: { readOnlyHint: true, destructiveHint: false },
    execute: async (_toolCallId, params, signal, onUpdate) => {
      const searchQueries = normalizeSearchQueries(params.search_queries, params.objective);

      onUpdate?.({
        content: [{ type: "text", text: `Searching the web for: ${params.objective}` }],
        details: undefined,
      });

      try {
        const afterDate = validateAfterDate(params.after_date);
        const response = await client.search(
          {
            objective: params.objective,
            search_queries: searchQueries,
            mode: DEFAULT_SEARCH_MODE,
            advanced_settings: {
              max_results: clampMaxResults(params.max_results),
              ...(afterDate ? { source_policy: { after_date: afterDate } } : {}),
            },
          },
          signal,
        );

        const { results, warnings } = parseParallelSearchResponse(response);
        const structuredContent: Static<typeof webSearchOutput> = { results, warnings };
        return {
          content: [{ type: "text", text: buildSearchSummary(results, warnings) }],
          details: {
            kind: "web_search",
            objective: params.objective,
            count: results.length,
            results,
            warnings,
          } satisfies WebSearchDetails,
          structuredContent,
        };
      } catch (error) {
        throw new Error(`Parallel search failed: ${getErrorMessage(error)}`);
      }
    },
  });
}
