import { defineTool } from "@earendil-works/pi-coding-agent";
import { getCapabilities, hyperlink, Text } from "@earendil-works/pi-tui";
import { formatAttemptTrail, } from "../core/web/fetch.js";
import { normalizeSearchQueries } from "../core/web/parallel.js";
import { formatWarnings } from "../core/web/shared.js";
import { formatToolDuration } from "./view.js";
export function startToolTiming(state, executionStarted) {
    if (executionStarted)
        state.startedAt ??= Date.now();
}
// The render clock only drives the live counter; a final result shows pi's recorded durationMs.
export function updateToolTiming(state, isPartial, invalidate) {
    if (isPartial) {
        state.interval ??= setInterval(invalidate, 1000);
        return;
    }
    clearInterval(state.interval);
    delete state.interval;
}
export function formatElapsed(state) {
    if (state.startedAt === undefined)
        throw new Error("tool timing read before execution started");
    return `Elapsed ${formatToolDuration(Date.now() - state.startedAt)}`;
}
export function formatTook(durationMs) {
    return `Took ${formatToolDuration(durationMs)}`;
}
export function linkUrl(styledText, url) {
    return getCapabilities().hyperlinks ? hyperlink(styledText, url) : styledText;
}
export function withWebFetchRendering(tool) {
    return defineTool({
        ...tool,
        renderCall(args, theme, context) {
            const state = context.state;
            startToolTiming(state, context.executionStarted);
            let text = theme.fg("toolTitle", theme.bold("web_fetch"));
            if (!context.isPartial)
                return new Text(text, 0, 0);
            const urls = args.urls.map((url) => url.trim()).filter(Boolean);
            if (context.expanded) {
                for (const [index, url] of urls.entries()) {
                    text += `\n${theme.fg("dim", `${index + 1}.`)} ${linkUrl(theme.fg("accent", url), url)}`;
                }
            }
            else if (urls[0]) {
                text += `\n${theme.fg("dim", "1.")} ${linkUrl(theme.fg("accent", urls[0]), urls[0])}`;
                if (urls.length > 1)
                    text += theme.fg("dim", `  [+${urls.length - 1} more]`);
            }
            return new Text(text, 0, 0);
        },
        renderResult(result, { expanded, isPartial }, theme, context) {
            const state = context.state;
            updateToolTiming(state, isPartial, context.invalidate);
            const renderedResult = result;
            if (isPartial) {
                return new Text(`${theme.fg("warning", "Extracting...")} ${theme.fg("dim", formatElapsed(state))}`, 0, 0);
            }
            const timing = context.durationMs === undefined
                ? ""
                : `\n${theme.fg("dim", formatTook(context.durationMs))}`;
            if (context.isError) {
                const error = renderedResult.content[0]?.type === "text"
                    ? (renderedResult.content[0].text ?? "Fetch failed")
                    : "Fetch failed";
                return new Text(`${theme.fg("error", error)}${timing}`, 0, 0);
            }
            const details = (renderedResult.details ?? {});
            const count = details.count ?? details.resolved?.length ?? 0;
            const failedCount = details.failed?.length ?? 0;
            let text = theme.fg("success", `${count} document${count === 1 ? "" : "s"}`);
            if (failedCount > 0) {
                text += theme.fg("toolOutput", ", ");
                text += theme.fg("error", `${failedCount} failed`);
            }
            const outcomes = details.outcomes ?? [...(details.resolved ?? []), ...(details.failed ?? [])];
            for (const [index, outcome] of outcomes.entries()) {
                const document = outcome.document;
                if (document) {
                    text += `\n${theme.fg("dim", `${index + 1}. [${document.kind}]`)} ${linkUrl(theme.fg("accent", outcome.url), outcome.url)}`;
                    if (expanded) {
                        text += `\n${theme.fg("muted", `   ${document.title}`)}`;
                        for (const body of document.bodies) {
                            text += `\n${theme.fg("dim", `   ${body.path}`)}`;
                        }
                    }
                    continue;
                }
                text += `\n${theme.fg("dim", `${index + 1}.`)} ${theme.fg("error", "[failed]")} ${linkUrl(theme.fg("accent", outcome.url), outcome.url)}`;
                if (expanded)
                    text += `\n${theme.fg("error", `   ${formatAttemptTrail(outcome)}`)}`;
            }
            const warningLines = formatWarnings(details.warnings);
            if (warningLines.length > 0) {
                text += `\n${theme.fg("warning", expanded ? "Warnings:" : `Warnings: ${warningLines.length}`)}`;
                if (expanded) {
                    for (const warning of warningLines)
                        text += `\n${theme.fg("warning", `- ${warning}`)}`;
                }
            }
            text += timing;
            return new Text(text, 0, 0);
        },
    });
}
export function withWebSearchRendering(tool) {
    return defineTool({
        ...tool,
        renderCall(args, theme, context) {
            const state = context.state;
            startToolTiming(state, context.executionStarted);
            let text = theme.fg("toolTitle", theme.bold("web_search"));
            const objective = args.objective?.trim() ?? "";
            if (objective)
                text += `\n${theme.fg("muted", objective)}`;
            if (!context.isPartial || (!objective && !args.search_queries?.length)) {
                return new Text(text, 0, 0);
            }
            const queries = normalizeSearchQueries(args.search_queries, objective);
            const label = queries.length === 1 ? "query:" : "queries:";
            if (queries.length === 1) {
                text += `\n${theme.fg("dim", label)} ${theme.fg("muted", queries[0] ?? "")}`;
            }
            else if (context.expanded) {
                text += `\n${theme.fg("dim", label)}`;
                for (const query of queries)
                    text += `\n${theme.fg("muted", `  ${query}`)}`;
            }
            else if (queries[0]) {
                text += `\n${theme.fg("dim", label)} ${theme.fg("muted", queries[0])}`;
                text += theme.fg("dim", `  [+${queries.length - 1} more]`);
            }
            return new Text(text, 0, 0);
        },
        renderResult(result, { expanded, isPartial }, theme, context) {
            const state = context.state;
            updateToolTiming(state, isPartial, context.invalidate);
            const renderedResult = result;
            if (isPartial) {
                return new Text(`${theme.fg("warning", "Scanning...")} ${theme.fg("dim", formatElapsed(state))}`, 0, 0);
            }
            const timing = context.durationMs === undefined
                ? ""
                : `\n${theme.fg("dim", formatTook(context.durationMs))}`;
            if (context.isError) {
                const error = renderedResult.content[0]?.type === "text"
                    ? (renderedResult.content[0].text ?? "Search failed")
                    : "Search failed";
                return new Text(`${theme.fg("error", error)}${timing}`, 0, 0);
            }
            const details = (renderedResult.details ?? {});
            const count = details.count ?? details.results?.length ?? 0;
            const warningLines = formatWarnings(details.warnings);
            let text = theme.fg("success", `${count} result${count === 1 ? "" : "s"}`);
            if (warningLines.length > 0) {
                text += theme.fg("toolOutput", ", ");
                text += theme.fg("warning", `${warningLines.length} warning${warningLines.length === 1 ? "" : "s"}`);
            }
            for (const [index, item] of details.results?.entries() ?? []) {
                const title = item.title?.trim() || item.url;
                text += `\n${linkUrl(theme.fg("accent", `${index + 1}. ${title}`), item.url)}`;
                if (expanded)
                    text += `\n${theme.fg("dim", `   ${item.url}`)}`;
            }
            if (expanded && warningLines.length > 0) {
                text += "\n";
                for (const warning of warningLines)
                    text += `\n${theme.fg("warning", `- ${warning}`)}`;
            }
            text += timing;
            return new Text(text, 0, 0);
        },
    });
}
