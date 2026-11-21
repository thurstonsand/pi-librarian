import path from "node:path";
import { Type } from "typebox";
import { defineTool } from "../tool.js";
import { deliverFetchResults } from "./delivery.js";
import { fetchDocuments } from "./router.js";
import { getErrorMessage } from "./shared.js";
export function formatAttemptTrail(outcome) {
    if (outcome.attempts.length === 0)
        return "no fetcher could handle this URL";
    return outcome.attempts.map((attempt) => `${attempt.source}: ${attempt.reason}`).join(" → ");
}
export const fetchParameters = Type.Object({
    urls: Type.Array(Type.String({ description: "A URL to extract." }), {
        description: "One or more URLs to extract.",
        minItems: 1,
        maxItems: 10,
    }),
    objective: Type.Optional(Type.String({
        description: "Optional extraction goal. Source-native fetchers ignore it.",
    })),
});
const webFetchOutput = Type.Object({
    documents: Type.Array(Type.Object({
        url: Type.String(),
        link: Type.Optional(Type.String()),
        kind: Type.String(),
        source: Type.String(),
        title: Type.String(),
        facts: Type.Array(Type.String()),
        excerpt: Type.Optional(Type.String()),
        highlights: Type.Optional(Type.Array(Type.String())),
        bodies: Type.Array(Type.Object({
            name: Type.String(),
            path: Type.String({ description: "Absolute path of the body file." }),
            lines: Type.Integer(),
            bytes: Type.Integer(),
        })),
    })),
    failed: Type.Array(Type.Object({
        url: Type.String(),
        attempts: Type.Array(Type.Object({ source: Type.String(), reason: Type.String() })),
    })),
    warnings: Type.Array(Type.Object({ message: Type.String(), type: Type.Optional(Type.String()) })),
});
function toStructuredContent(result) {
    return {
        documents: result.outcomes.flatMap(({ document }) => document
            ? [
                {
                    url: document.url,
                    ...(document.link ? { link: document.link } : {}),
                    kind: document.kind,
                    source: document.source,
                    title: document.title,
                    facts: document.facts,
                    ...(document.excerpt ? { excerpt: document.excerpt } : {}),
                    ...(document.highlights ? { highlights: document.highlights } : {}),
                    bodies: document.bodies,
                },
            ]
            : []),
        failed: result.outcomes
            .filter((outcome) => !outcome.document)
            .map((outcome) => ({
            url: outcome.url,
            attempts: outcome.attempts.map(({ source, reason }) => ({ source, reason })),
        })),
        warnings: result.warnings.map(({ message, type }) => (type ? { message, type } : { message })),
    };
}
export function createWebFetchTool(fetchers, cacheDir) {
    return defineTool({
        name: "web_fetch",
        label: "Fetch Web",
        description: "Fetch specific URLs. Every document's content is written as native files (markdown, patches, source files) under a per-call artifact directory; the tool result is a digest with per-document facts, file paths, and a short excerpt.",
        promptSnippet: "Fetch contents of URLs",
        promptGuidelines: [
            ...fetchers.flatMap((fetcher) => fetcher.promptGuidelines),
            "Use web_fetch when you already have a specific URL and need more than search snippets.",
        ],
        parameters: fetchParameters,
        outputSchema: webFetchOutput,
        annotations: { readOnlyHint: true, destructiveHint: false },
        execute: async (toolCallId, params, signal, onUpdate) => {
            onUpdate?.({
                content: [
                    {
                        type: "text",
                        text: `Fetching ${params.urls.length} URL(s) from the web...`,
                    },
                ],
                details: undefined,
            });
            try {
                const artifactRoot = path.join(cacheDir, "fetches", toolCallId.replace(/[^\w.-]/g, "_"));
                const result = await fetchDocuments(fetchers, params.urls, artifactRoot, params.objective, signal);
                const delivery = deliverFetchResults(result);
                return {
                    content: [{ type: "text", text: delivery.text }],
                    details: {
                        kind: "web_fetch",
                        count: delivery.resolved.length,
                        outcomes: result.outcomes,
                        resolved: delivery.resolved,
                        failed: delivery.failed,
                        warnings: result.warnings.length > 0 ? result.warnings : null,
                    },
                    structuredContent: toStructuredContent(result),
                };
            }
            catch (error) {
                throw new Error(`web_fetch failed: ${getErrorMessage(error)}`);
            }
        },
    });
}
