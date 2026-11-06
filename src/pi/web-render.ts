import { defineTool } from "@earendil-works/pi-coding-agent";
import { getCapabilities, hyperlink, Text } from "@earendil-works/pi-tui";
import type { LibrarianTool } from "../core/tool.ts";
import {
  type fetchParameters,
  formatAttemptTrail,
  type WebFetchDetails,
} from "../core/web/fetch.ts";
import { normalizeSearchQueries } from "../core/web/parallel.ts";
import type { searchParameters, WebSearchDetails } from "../core/web/search.ts";
import { formatWarnings } from "../core/web/shared.ts";
import { formatToolDuration } from "./view.ts";
export interface ToolTimingState {
  startedAt?: number;
  interval?: ReturnType<typeof setInterval>;
}

export function startToolTiming(state: ToolTimingState, executionStarted: boolean): void {
  if (executionStarted) state.startedAt ??= Date.now();
}

// The render clock only drives the live counter; a final result shows pi's recorded durationMs.
export function updateToolTiming(
  state: ToolTimingState,
  isPartial: boolean,
  invalidate: () => void,
): void {
  if (isPartial) {
    state.interval ??= setInterval(invalidate, 1000);
    return;
  }
  clearInterval(state.interval);
  delete state.interval;
}

export function formatElapsed(state: ToolTimingState): string {
  if (state.startedAt === undefined) throw new Error("tool timing read before execution started");
  return `Elapsed ${formatToolDuration(Date.now() - state.startedAt)}`;
}

export function formatTook(durationMs: number): string {
  return `Took ${formatToolDuration(durationMs)}`;
}

export function linkUrl(styledText: string, url: string): string {
  return getCapabilities().hyperlinks ? hyperlink(styledText, url) : styledText;
}

type RenderableToolResult<TDetails> = {
  content: Array<{ type: string; text?: string }>;
  details?: TDetails;
  isError?: boolean;
};

export function withWebFetchRendering(
  tool: LibrarianTool<typeof fetchParameters, WebFetchDetails | undefined>,
) {
  return defineTool({
    ...tool,
    renderCall(args, theme, context) {
      const state = context.state as ToolTimingState;
      startToolTiming(state, context.executionStarted);

      let text = theme.fg("toolTitle", theme.bold("web_fetch"));
      if (!context.isPartial) return new Text(text, 0, 0);

      const urls = args.urls.map((url: string) => url.trim()).filter(Boolean);
      if (context.expanded) {
        for (const [index, url] of urls.entries()) {
          text += `\n${theme.fg("dim", `${index + 1}.`)} ${linkUrl(theme.fg("accent", url), url)}`;
        }
      } else if (urls[0]) {
        text += `\n${theme.fg("dim", "1.")} ${linkUrl(theme.fg("accent", urls[0]), urls[0])}`;
        if (urls.length > 1) text += theme.fg("dim", `  [+${urls.length - 1} more]`);
      }

      return new Text(text, 0, 0);
    },
    renderResult(result, { expanded, isPartial }, theme, context) {
      const state = context.state as ToolTimingState;
      updateToolTiming(state, isPartial, context.invalidate);
      const renderedResult = result as RenderableToolResult<WebFetchDetails>;
      if (isPartial) {
        return new Text(
          `${theme.fg("warning", "Extracting...")} ${theme.fg("dim", formatElapsed(state))}`,
          0,
          0,
        );
      }
      const timing =
        context.durationMs === undefined
          ? ""
          : `\n${theme.fg("dim", formatTook(context.durationMs))}`;
      if (context.isError) {
        const error =
          renderedResult.content[0]?.type === "text"
            ? (renderedResult.content[0].text ?? "Fetch failed")
            : "Fetch failed";
        return new Text(`${theme.fg("error", error)}${timing}`, 0, 0);
      }

      const details = (renderedResult.details ?? {}) as WebFetchDetails;
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
        if (expanded) text += `\n${theme.fg("error", `   ${formatAttemptTrail(outcome)}`)}`;
      }

      const warningLines = formatWarnings(details.warnings);
      if (warningLines.length > 0) {
        text += `\n${theme.fg("warning", expanded ? "Warnings:" : `Warnings: ${warningLines.length}`)}`;
        if (expanded) {
          for (const warning of warningLines) text += `\n${theme.fg("warning", `- ${warning}`)}`;
        }
      }
      text += timing;

      return new Text(text, 0, 0);
    },
  });
}

export function withWebSearchRendering(
  tool: LibrarianTool<typeof searchParameters, WebSearchDetails | undefined>,
) {
  return defineTool({
    ...tool,
    renderCall(args, theme, context) {
      const state = context.state as ToolTimingState;
      startToolTiming(state, context.executionStarted);

      let text = theme.fg("toolTitle", theme.bold("web_search"));
      const objective = args.objective?.trim() ?? "";
      if (objective) text += `\n${theme.fg("muted", objective)}`;
      if (!context.isPartial || (!objective && !args.search_queries?.length)) {
        return new Text(text, 0, 0);
      }

      const queries = normalizeSearchQueries(args.search_queries, objective);
      const label = queries.length === 1 ? "query:" : "queries:";
      if (queries.length === 1) {
        text += `\n${theme.fg("dim", label)} ${theme.fg("muted", queries[0] ?? "")}`;
      } else if (context.expanded) {
        text += `\n${theme.fg("dim", label)}`;
        for (const query of queries) text += `\n${theme.fg("muted", `  ${query}`)}`;
      } else if (queries[0]) {
        text += `\n${theme.fg("dim", label)} ${theme.fg("muted", queries[0])}`;
        text += theme.fg("dim", `  [+${queries.length - 1} more]`);
      }
      return new Text(text, 0, 0);
    },
    renderResult(result, { expanded, isPartial }, theme, context) {
      const state = context.state as ToolTimingState;
      updateToolTiming(state, isPartial, context.invalidate);
      const renderedResult = result as RenderableToolResult<WebSearchDetails>;
      if (isPartial) {
        return new Text(
          `${theme.fg("warning", "Scanning...")} ${theme.fg("dim", formatElapsed(state))}`,
          0,
          0,
        );
      }
      const timing =
        context.durationMs === undefined
          ? ""
          : `\n${theme.fg("dim", formatTook(context.durationMs))}`;
      if (context.isError) {
        const error =
          renderedResult.content[0]?.type === "text"
            ? (renderedResult.content[0].text ?? "Search failed")
            : "Search failed";
        return new Text(`${theme.fg("error", error)}${timing}`, 0, 0);
      }

      const details = (renderedResult.details ?? {}) as WebSearchDetails;
      const count = details.count ?? details.results?.length ?? 0;
      const warningLines = formatWarnings(details.warnings);
      let text = theme.fg("success", `${count} result${count === 1 ? "" : "s"}`);
      if (warningLines.length > 0) {
        text += theme.fg("toolOutput", ", ");
        text += theme.fg(
          "warning",
          `${warningLines.length} warning${warningLines.length === 1 ? "" : "s"}`,
        );
      }

      for (const [index, item] of details.results?.entries() ?? []) {
        const title = item.title?.trim() || item.url;
        text += `\n${linkUrl(theme.fg("accent", `${index + 1}. ${title}`), item.url)}`;
        if (expanded) text += `\n${theme.fg("dim", `   ${item.url}`)}`;
      }

      if (expanded && warningLines.length > 0) {
        text += "\n";
        for (const warning of warningLines) text += `\n${theme.fg("warning", `- ${warning}`)}`;
      }
      text += timing;

      return new Text(text, 0, 0);
    },
  });
}
