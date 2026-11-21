import { readFile } from "node:fs/promises";
import path from "node:path";
import { convertToPng, defineTool, type Theme } from "@earendil-works/pi-coding-agent";
import {
  Box,
  type Component,
  Container,
  getCapabilities,
  hyperlink,
  Image,
  Text,
  TruncatedText,
} from "@earendil-works/pi-tui";
import type { LibrarianTool } from "../core/tool.ts";
import { formatSize } from "../core/truncate.ts";
import {
  type fetchParameters,
  formatAttemptTrail,
  type WebFetchDetails,
} from "../core/web/fetch.ts";
import type { ImageFile } from "../core/web/images.ts";
import { normalizeSearchQueries } from "../core/web/parallel.ts";
import type { ImageSearchDetails, searchParameters, WebSearchDetails } from "../core/web/search.ts";
import { formatWarnings } from "../core/web/shared.ts";
import { formatToolDuration, shortenUrl } from "./view.ts";
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
      if (args.raw) text += theme.fg("accent", " raw");
      if (!context.isPartial) return new Text(text, 0, 0);

      const urls = args.urls.map((url: string) => url.trim()).filter(Boolean);
      if (context.expanded) {
        for (const [index, url] of urls.entries()) {
          text += `\n${theme.fg("dim", `${index + 1}.`)} ${linkUrl(theme.fg("accent", shortenUrl(url)), url)}`;
        }
      } else if (urls[0]) {
        text += `\n${theme.fg("dim", "1.")} ${linkUrl(theme.fg("accent", shortenUrl(urls[0])), urls[0])}`;
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
          text += `\n${theme.fg("dim", `${index + 1}. [${document.kind}]`)} ${linkUrl(theme.fg("accent", shortenUrl(outcome.url)), outcome.url)}`;
          if (expanded) {
            text += `\n${theme.fg("muted", `   ${document.title}`)}`;
            for (const body of document.bodies) {
              text += `\n${theme.fg("dim", `   ${body.path}`)}`;
            }
          }
          continue;
        }

        text += `\n${theme.fg("dim", `${index + 1}.`)} ${theme.fg("error", "[failed]")} ${linkUrl(theme.fg("accent", shortenUrl(outcome.url)), outcome.url)}`;
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
      if (args.images) text += theme.fg("accent", " images");
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
      const warningLines = formatWarnings(details.warnings);
      const warningSummary =
        warningLines.length > 0
          ? `${theme.fg("toolOutput", ", ")}${theme.fg("warning", `${warningLines.length} warning${warningLines.length === 1 ? "" : "s"}`)}`
          : "";
      const warningList =
        expanded && warningLines.length > 0
          ? `\n\n${warningLines.map((warning) => theme.fg("warning", `- ${warning}`)).join("\n")}`
          : "";

      if (details.target === "images") {
        return renderImageResults(details, expanded, theme, context, {
          warningSummary,
          footer: `${warningList}${timing}`,
        });
      }

      const count = details.count ?? details.results?.length ?? 0;
      let text = `${theme.fg("success", `${count} result${count === 1 ? "" : "s"}`)}${warningSummary}`;
      for (const [index, item] of details.results?.entries() ?? []) {
        const title = item.title?.trim() || shortenUrl(item.url);
        text += `\n${linkUrl(theme.fg("accent", `${index + 1}. ${title}`), item.url)}`;
        if (expanded) text += `\n${theme.fg("dim", `   ${shortenUrl(item.url)}`)}`;
      }
      text += `${warningList}${timing}`;
      return new Text(text, 0, 0);
    },
  });
}

interface ThumbnailState {
  thumbnails?: Map<string, Image>;
}

const THUMBNAIL_SIZE = { maxWidthCells: 32, maxHeightCells: 8 };

// Read once per tool row and kept in its state, so a redraw reuses each Image and, on Kitty, its
// image id. Kitty accepts only PNG, so every other type is converted first; an image that cannot be
// read or converted keeps its text row and gets no thumbnail.
function loadThumbnails(
  state: ThumbnailState,
  files: ImageFile[],
  theme: Theme,
  invalidate: () => void,
): Map<string, Image> {
  if (state.thumbnails) return state.thumbnails;
  const thumbnails = new Map<string, Image>();
  state.thumbnails = thumbnails;
  void Promise.all(
    files.map(async (file) => {
      const data = (await readFile(file.path).catch(() => undefined))?.toString("base64");
      if (!data) return;
      const png =
        file.contentType === "image/png"
          ? { data, mimeType: "image/png" }
          : await convertToPng(data, file.contentType).catch(() => null);
      if (!png) return;
      thumbnails.set(
        file.path,
        new Image(
          png.data,
          png.mimeType,
          { fallbackColor: (text) => theme.fg("dim", text) },
          {
            ...THUMBNAIL_SIZE,
            filename: path.basename(file.path),
          },
        ),
      );
    }),
  ).then(invalidate);
  return thumbnails;
}

function renderImageResults(
  details: ImageSearchDetails,
  expanded: boolean,
  theme: Theme,
  context: { state: unknown; showImages: boolean; invalidate: () => void },
  { warningSummary, footer }: { warningSummary: string; footer: string },
): Component {
  const failed = details.images.filter((image) => "error" in image.download).length;
  let summary = theme.fg("success", `${details.count} image${details.count === 1 ? "" : "s"}`);
  if (failed > 0) {
    summary += `${theme.fg("toolOutput", ", ")}${theme.fg("error", `${failed} failed`)}`;
  }

  // Thumbnails only where the terminal draws images and the user has not turned them off, so
  // every other terminal shows the same text rows instead of image placeholders.
  const files = details.images.flatMap(({ download }) => ("error" in download ? [] : [download]));
  const thumbnails =
    expanded && context.showImages && getCapabilities().images
      ? loadThumbnails(context.state as ThumbnailState, files, theme, context.invalidate)
      : undefined;

  // Titles and errors wrap; paths and URLs are cut to one line, their links still whole, so a long
  // URL never breaks away from its label.
  const container = new Container();
  const wrapped = (line: string) => container.addChild(new Text(line, 0, 0));
  const truncated = (line: string) => container.addChild(new TruncatedText(line, 0, 0));
  const url = (label: string, href: string) =>
    truncated(
      `${theme.fg("dim", `   ${label} `)}${linkUrl(theme.fg("dim", shortenUrl(href)), href)}`,
    );

  wrapped(`${summary}${warningSummary}`);
  for (const [index, image] of details.images.entries()) {
    const { download } = image;
    wrapped(linkUrl(theme.fg("accent", `${index + 1}. ${image.title}`), image.image_url));
    if ("error" in download) {
      wrapped(theme.fg("error", `   download failed: ${download.error}`));
      if (expanded) url("image", image.image_url);
    } else if (expanded) {
      const facts = [
        ...(image.width && image.height ? [`${image.width}×${image.height}`] : []),
        download.contentType,
        formatSize(download.bytes),
      ];
      wrapped(theme.fg("muted", `   ${facts.join(" · ")}`));
      truncated(theme.fg("dim", `   ${download.path}`));
    }
    if (expanded) url("from", image.source_page_url);
    const thumbnail = "error" in download ? undefined : thumbnails?.get(download.path);
    if (thumbnail) {
      const box = new Box(3, 0);
      box.addChild(thumbnail);
      container.addChild(box);
    }
  }
  const tail = footer.replace(/^\n/, "");
  if (tail) wrapped(tail);
  return container;
}
