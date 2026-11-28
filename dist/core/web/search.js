import path from "node:path";
import { Type } from "typebox";
import { defineTool } from "../tool.js";
import { buildImageSearchSummary, saveImages, } from "./images.js";
import { buildSearchSummary, clampMaxResults, DEFAULT_MAX_RESULTS, DEFAULT_SEARCH_MODE, normalizeSearchQueries, parseParallelImageSearchResponse, parseParallelSearchResponse, validateAfterDate, } from "./parallel.js";
import { getErrorMessage } from "./shared.js";
export const searchParameters = Type.Object({
    objective: Type.String({
        description: "What you want to learn from the web search.",
    }),
    search_queries: Type.Optional(Type.Array(Type.String({ description: "A search query string." }), {
        description: "Specific search queries to run. If omitted, the objective is used as a single query. Image searches use the first 3.",
        minItems: 1,
        maxItems: 8,
    })),
    max_results: Type.Optional(Type.Integer({
        description: `Upper bound on results to return. Defaults to ${DEFAULT_MAX_RESULTS}; capped at 8.`,
        minimum: 1,
        maximum: 8,
    })),
    after_date: Type.Optional(Type.String({
        description: "Only include results published on or after this RFC 3339 date (YYYY-MM-DD). Set it when recent results matter.",
    })),
    images: Type.Optional(Type.Boolean({
        description: "Returns images for results instead of pages. Cannot be combined with after_date.",
    })),
});
const warningsOutput = Type.Array(Type.Object({ message: Type.String(), type: Type.Optional(Type.String()) }));
const webSearchOutput = Type.Union([
    Type.Object({
        results: Type.Array(Type.Object({
            url: Type.String(),
            title: Type.Optional(Type.String()),
            publish_date: Type.Optional(Type.String()),
            excerpts: Type.Array(Type.String()),
        })),
        warnings: warningsOutput,
    }),
    Type.Object({
        images: Type.Array(Type.Object({
            title: Type.String(),
            image_url: Type.String(),
            source_page_url: Type.String(),
            width: Type.Optional(Type.Integer()),
            height: Type.Optional(Type.Integer()),
            path: Type.Optional(Type.String({ description: "Absolute path of the downloaded image." })),
            content_type: Type.Optional(Type.String()),
            bytes: Type.Optional(Type.Integer()),
            error: Type.Optional(Type.String({ description: "Why the image was not downloaded." })),
        })),
        warnings: warningsOutput,
    }),
]);
function toImageOutput({ download, ...image }) {
    return "error" in download
        ? { ...image, error: download.error }
        : { ...image, path: download.path, content_type: download.contentType, bytes: download.bytes };
}
export function createWebSearchTool(client, downloadImage, cacheDir) {
    return defineTool({
        name: "web_search",
        label: "Search Web",
        description: "Search the web and return relevant results with excerpts.",
        promptSnippet: "Search the web for sources and current information",
        promptGuidelines: ["Prefer a focused objective and 1-5 specific queries for web_search."],
        parameters: searchParameters,
        outputSchema: webSearchOutput,
        annotations: { readOnlyHint: true, destructiveHint: false },
        execute: async (toolCallId, params, signal, onUpdate) => {
            const searchQueries = normalizeSearchQueries(params.search_queries, params.objective);
            onUpdate?.({
                content: [
                    {
                        type: "text",
                        text: `Searching the web for${params.images ? " images" : ""}: ${params.objective}`,
                    },
                ],
                details: undefined,
            });
            try {
                const maxResults = clampMaxResults(params.max_results);
                if (params.images) {
                    if (params.after_date)
                        throw new Error("images cannot be combined with after_date");
                    const response = await client.imageSearch({
                        objective: params.objective,
                        search_queries: searchQueries,
                        mode: DEFAULT_SEARCH_MODE,
                        advanced_settings: { max_results: maxResults },
                    }, signal);
                    const { results, warnings } = parseParallelImageSearchResponse(response);
                    const dir = path.join(cacheDir, "images", toolCallId.replace(/[^\w.-]/g, "_"));
                    const images = await saveImages(downloadImage, results, dir, signal);
                    return {
                        content: [{ type: "text", text: buildImageSearchSummary(images, dir, warnings) }],
                        details: {
                            kind: "web_search",
                            target: "images",
                            objective: params.objective,
                            count: images.length,
                            images,
                            warnings,
                        },
                        structuredContent: { images: images.map(toImageOutput), warnings },
                    };
                }
                const afterDate = validateAfterDate(params.after_date);
                const response = await client.search({
                    objective: params.objective,
                    search_queries: searchQueries,
                    mode: DEFAULT_SEARCH_MODE,
                    advanced_settings: {
                        max_results: maxResults,
                        ...(afterDate ? { source_policy: { after_date: afterDate } } : {}),
                    },
                }, signal);
                const { results, warnings } = parseParallelSearchResponse(response);
                const structuredContent = { results, warnings };
                return {
                    content: [{ type: "text", text: buildSearchSummary(results, warnings) }],
                    details: {
                        kind: "web_search",
                        target: "pages",
                        objective: params.objective,
                        count: results.length,
                        results,
                        warnings,
                    },
                    structuredContent,
                };
            }
            catch (error) {
                throw new Error(`Parallel search failed: ${getErrorMessage(error)}`);
            }
        },
    });
}
