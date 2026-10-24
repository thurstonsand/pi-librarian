import path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import {
  type Component,
  Container,
  getCapabilities,
  hyperlink,
  Markdown,
  Spacer,
  Text,
} from "@earendil-works/pi-tui";
import { formatArtifact, type ShownEntry } from "./delivery.ts";
import { formatLocation } from "./results.ts";
import type { LibrarianRunDetails, TraceCall } from "./run.ts";
import { isCodeSearchTool, isRepoSearchTool, LIBRARIAN_TOOL_NAMES } from "./tools/names.ts";
import { asRepoToolDetails, summarizeRepoToolDetails } from "./trace.ts";

const COLLAPSED_TRACE_CALLS = 3;
// Same frames and cadence as pi's Working... loader (pi-tui loader.ts defaults).
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export const SPINNER_INTERVAL_MS = 80;

interface LibrarianRenderContext {
  lastComponent: Component | undefined;
}

// Mirrors pi's own tool rows, whose formatter is not exported.
export function formatToolDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const totalSeconds = Math.floor(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainder = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${remainder}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ${remainder}s`;
}

// A finished call shows pi's recorded duration, which is monotonic and survives reloads. Calls pi
// never ran (blocked or invalid arguments) have none and fall back to the trace timestamps.
function formatTraceCallTiming(call: TraceCall): string {
  if (call.endedAt === undefined) {
    return `Elapsed ${formatToolDuration(Date.now() - call.startedAt)}`;
  }
  return `Took ${formatToolDuration(call.durationMs ?? call.endedAt - call.startedAt)}`;
}

export function shorten(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}…`;
}

export function relativizeCachePath(rawPath: string, cacheDir: string): string {
  const searchesRoot = path.join(cacheDir, "searches") + path.sep;
  if (rawPath.startsWith(searchesRoot)) {
    return path.join("searches", rawPath.slice(searchesRoot.length));
  }
  const reposRoot = path.join(cacheDir, "repos") + path.sep;
  if (!rawPath.startsWith(reposRoot)) {
    return rawPath;
  }

  const underRepos = rawPath.slice(reposRoot.length);
  const segments = underRepos.split(path.sep);
  // repos/<host>/<owner>/<repo>/<file...> — drop host and owner so the trace reads repo/file.
  return segments.length > 2 ? segments.slice(2).join(path.sep) : underRepos;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  for (const value of Object.values(record)) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

export interface TraceLine {
  verb: string;
  subject: string;
}

// A tool over a single instance takes no source argument, but its row must still say which engine
// answered; this maps each such tool to its implied source.
export type ImpliedSources = ReadonlyMap<string, string>;

export interface TraceContext {
  cacheDir: string;
  impliedSources: ImpliedSources;
}

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function stringArrayArg(args: Record<string, unknown>, key: string): string[] {
  const value = args[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function sourceOf(call: TraceCall, args: Record<string, unknown>, context: TraceContext): string {
  return stringArg(args, "source") ?? context.impliedSources.get(call.name) ?? "";
}

function codeSearchScope(name: string, args: Record<string, unknown>): string | undefined {
  switch (name) {
    case LIBRARIAN_TOOL_NAMES.searchCodeGitHub: {
      const owner = stringArg(args, "owner");
      const repos = stringArrayArg(args, "repos");
      if (!owner) {
        return undefined;
      }
      return repos.length > 0 ? repos.map((repo) => `${owner}/${repo}`).join(",") : owner;
    }
    case LIBRARIAN_TOOL_NAMES.searchCodeGrepApp:
      return stringArg(args, "repo");
    case LIBRARIAN_TOOL_NAMES.searchCodeGitLab:
      return stringArg(args, "project");
    case LIBRARIAN_TOOL_NAMES.searchCodeBitbucket: {
      const project = stringArg(args, "project");
      const repo = stringArg(args, "repo");
      return project && repo ? `${project}/${repo}` : project;
    }
    default: {
      const repos = stringArrayArg(args, "repos");
      return repos.length > 0 ? repos.join(",") : undefined;
    }
  }
}

const UNSHOWN_FILTERS = new Set(["source", "limit", "text"]);

function repoSearchFilters(args: Record<string, unknown>): string {
  const parts: string[] = [];
  const text = stringArg(args, "text");
  if (text) {
    parts.push(text);
  }
  for (const [key, value] of Object.entries(args)) {
    if (UNSHOWN_FILTERS.has(key) || value === undefined) {
      continue;
    }
    parts.push(`${key}:${Array.isArray(value) ? value.join(",") : String(value)}`);
  }
  return parts.join(" ");
}

function lineRange(args: Record<string, unknown>): string {
  const offset = typeof args.offset === "number" ? args.offset : undefined;
  const limit = typeof args.limit === "number" ? args.limit : undefined;
  return offset !== undefined || limit !== undefined
    ? `:${offset ?? 1}${limit !== undefined ? `-${(offset ?? 1) + limit - 1}` : ""}`
    : "";
}

export function formatTraceLine(call: TraceCall, context: TraceContext): TraceLine {
  const args = (call.args && typeof call.args === "object" ? call.args : {}) as Record<
    string,
    unknown
  >;
  const { cacheDir } = context;

  if (isCodeSearchTool(call.name)) {
    const pattern = stringArg(args, "pattern") ?? "";
    const scope = codeSearchScope(call.name, args);
    const where = `${sourceOf(call, args, context)}${scope ? `:${shorten(scope, 40)}` : ""}`;
    return { verb: "search", subject: `code ${shorten(pattern, 60)} in ${where}` };
  }
  if (isRepoSearchTool(call.name)) {
    return {
      verb: "search",
      subject: `repos ${shorten(repoSearchFilters(args), 80)} in ${sourceOf(call, args, context)}`,
    };
  }

  switch (call.name) {
    case "read": {
      const rawPath = stringArg(args, "path") ?? "";
      return {
        verb: "read",
        subject: `${relativizeCachePath(rawPath, cacheDir)}${lineRange(args)}`,
      };
    }
    case "bash": {
      const command = stringArg(args, "command") ?? "";
      return { verb: "bash", subject: shorten(command, 120) };
    }
    case "grep": {
      const pattern = stringArg(args, "pattern") ?? "";
      const searchPath = stringArg(args, "path");
      const scope = searchPath ? ` ${relativizeCachePath(searchPath, cacheDir)}` : "";
      return { verb: "grep", subject: `"${shorten(pattern, 60)}"${scope}` };
    }
    case "find": {
      return { verb: "find", subject: shorten(stringArg(args, "pattern") ?? "", 80) };
    }
    case "ls": {
      return { verb: "ls", subject: relativizeCachePath(stringArg(args, "path") ?? ".", cacheDir) };
    }
    case LIBRARIAN_TOOL_NAMES.findDefinition: {
      const kind = stringArg(args, "kind");
      const symbol = stringArg(args, "symbol") ?? "";
      return {
        verb: "definition",
        subject: `${kind ? `${kind} ` : ""}${symbol} in ${sourceOf(call, args, context)}`,
      };
    }
    case LIBRARIAN_TOOL_NAMES.readFile: {
      const repo = stringArg(args, "repo") ?? "";
      const filePath = stringArg(args, "path") ?? "";
      const ref = stringArg(args, "ref");
      return {
        verb: "read",
        subject: `${sourceOf(call, args, context)}:${repo}/${filePath}${ref ? `@${ref}` : ""}${lineRange(args)}`,
      };
    }
    case LIBRARIAN_TOOL_NAMES.checkoutRepo: {
      const repo = stringArg(args, "repo") ?? "";
      const source = stringArg(args, "source");
      const ref = stringArg(args, "ref");
      return {
        verb: "checkout",
        subject: `${source ? `${source}:` : ""}${repo}${ref ? `@${ref}` : ""}`,
      };
    }
    case LIBRARIAN_TOOL_NAMES.provideResults:
      return { verb: "results", subject: "" };
    default: {
      const subject = firstString(args, ["query", "url", "prompt", "objective"]);
      return { verb: call.name, subject: subject ? shorten(subject, 80) : "" };
    }
  }
}

function currentSpinnerFrame(): string {
  return SPINNER_FRAMES[Math.floor(Date.now() / SPINNER_INTERVAL_MS) % SPINNER_FRAMES.length] ?? "";
}

function renderTraceCallText(call: TraceCall, context: TraceContext, theme: Theme): string {
  const { verb, subject } = formatTraceLine(call, context);
  const running = call.endedAt === undefined;
  const icon = call.isError
    ? theme.fg("error", "✗")
    : running
      ? theme.fg("accent", currentSpinnerFrame())
      : theme.fg("success", "✓");
  const timing = formatTraceCallTiming(call);
  const summary = call.resultSummary
    ? theme.fg(call.isError ? "error" : "muted", ` (${shorten(call.resultSummary, 60)})`)
    : "";

  const subjectText = subject ? ` ${theme.fg("toolOutput", subject)}` : "";
  return `  ${icon} ${theme.fg("dim", verb)}${subjectText}${summary} ${theme.fg("dim", `· ${timing}`)}`;
}

function renderQuestion(details: LibrarianRunDetails, expanded: boolean, theme: Theme): string {
  return theme.fg("dim", expanded ? details.query : shorten(details.query, 120));
}

function renderFooter(details: LibrarianRunDetails, theme: Theme): string {
  const callCount = details.trace.length;
  const elapsed = formatToolDuration((details.endedAt ?? Date.now()) - details.startedAt);
  const model = theme.fg("dim", `${details.modelLabel} (${details.thinkingLevel})`);
  return theme.fg(
    "muted",
    `${callCount} tool call${callCount === 1 ? "" : "s"} · ${elapsed} · ${model}`,
  );
}

function collapsedFindingsHiddenText(details: LibrarianRunDetails): string | undefined {
  const findings = details.findings;
  if (!findings) {
    return undefined;
  }

  const hiddenParts: string[] = [];
  if (findings.locations.length > 0) {
    hiddenParts.push(
      `${findings.locations.length} location${findings.locations.length === 1 ? "" : "s"}`,
    );
  }
  if (findings.description?.trim()) {
    hiddenParts.push("details");
  }

  return hiddenParts.length > 0 ? `${hiddenParts.join(" and ")} hidden` : undefined;
}

function isLibrarianRunDetails(value: unknown): value is LibrarianRunDetails {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { status?: unknown }).status === "string" &&
    typeof (value as { query?: unknown }).query === "string" &&
    typeof (value as { modelLabel?: unknown }).modelLabel === "string" &&
    Array.isArray((value as { trace?: unknown }).trace)
  );
}

function renderTrace(
  details: LibrarianRunDetails,
  expanded: boolean,
  context: TraceContext,
  theme: Theme,
): string[] {
  const lines: string[] = [];
  const calls = expanded ? details.trace : details.trace.slice(-COLLAPSED_TRACE_CALLS);
  const hiddenCount = details.trace.length - calls.length;
  if (hiddenCount > 0) {
    lines.push(
      theme.fg("muted", `  … ${hiddenCount} earlier call${hiddenCount === 1 ? "" : "s"} (`) +
        keyHint("app.tools.expand", "to expand") +
        theme.fg("muted", ")"),
    );
  }
  for (const call of calls) {
    lines.push(renderTraceCallText(call, context, theme));
  }
  return lines;
}

export function renderLibrarianResult(
  result: AgentToolResult<LibrarianRunDetails>,
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme,
  traceContext: TraceContext,
  context?: LibrarianRenderContext,
): Container {
  const container =
    context?.lastComponent instanceof Container ? context.lastComponent : new Container();
  container.clear();
  const details = result.details;

  if (!isLibrarianRunDetails(details)) {
    const firstText = result.content.find((part) => part.type === "text");
    container.addChild(
      new Text(firstText && "text" in firstText ? firstText.text : "(no output)", 0, 0),
    );
    container.invalidate();
    return container;
  }

  const running = options.isPartial || details.status === "running";
  container.addChild(new Text(renderQuestion(details, options.expanded, theme), 0, 0));
  container.addChild(new Spacer(1));

  if (running || !details.findings) {
    for (const line of renderTrace(details, options.expanded, traceContext, theme)) {
      container.addChild(new Text(line, 0, 0));
    }
  }

  if (!running) {
    if (details.findings) {
      const hiddenText = options.expanded ? undefined : collapsedFindingsHiddenText(details);
      if (hiddenText) {
        container.addChild(
          new Text(
            theme.fg("muted", `(${hiddenText}, `) +
              keyHint("app.tools.expand", "to expand") +
              theme.fg("muted", ")"),
            0,
            0,
          ),
        );
      }
      const markdown = buildFindingsMarkdown(details, options.expanded);
      container.addChild(new Markdown(markdown, 0, 0, getMarkdownTheme()));
    } else if (details.error) {
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg("error", `  ${details.error}`), 0, 0));
    }
  }

  container.addChild(new Spacer(1));
  if (!running && details.runId) {
    container.addChild(new Text(theme.fg("muted", `run ${details.runId}`), 0, 0));
  }
  container.addChild(new Text(renderFooter(details, theme), 0, 0));
  container.invalidate();
  return container;
}

function buildFindingsMarkdown(details: LibrarianRunDetails, expanded: boolean): string {
  const findings = details.findings;
  if (!findings) {
    return "";
  }

  const sections = [findings.summary];

  if (findings.locations.length > 0) {
    const bullets = findings.locations.map((location) => `- ${formatLocation(location)}`);
    sections.push(bullets.join("\n"));
  }

  if (findings.description) {
    sections.push(findings.description);
  }

  return expanded ? sections.join("\n\n") : findings.summary;
}

export function renderLibrarianCall(theme: Theme): Text {
  return new Text(theme.fg("toolTitle", theme.bold("Librarian")), 0, 0);
}

const COLLAPSED_ENTRIES = 5;
const COLLAPSED_READ_LINES = 5;
const ELAPSED_INTERVAL_MS = 100;

// The fields of pi's ToolRenderContext this renderer reads; pi does not export the type.
interface RepoToolRenderContext {
  state: unknown;
  executionStarted: boolean;
  isError: boolean;
  durationMs: number | undefined;
  invalidate: () => void;
}

interface RepoToolRenderState {
  startedAt: number | undefined;
  interval: NodeJS.Timeout | undefined;
}

function linkUrl(styledText: string, url: string | undefined): string {
  return url && getCapabilities().hyperlinks ? hyperlink(styledText, url) : styledText;
}

function runningVerb(toolName: string): string {
  switch (toolName) {
    case LIBRARIAN_TOOL_NAMES.findDefinition:
      return "Locating…";
    case LIBRARIAN_TOOL_NAMES.readFile:
      return "Reading…";
    case LIBRARIAN_TOOL_NAMES.checkoutRepo:
      return "Cloning…";
    default:
      return "Searching…";
  }
}

function expandHint(theme: Theme, text: string): string {
  return `${theme.fg("muted", `${text} (`)}${keyHint("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;
}

function renderEntries(entries: ShownEntry[], expanded: boolean, theme: Theme): string[] {
  const shown = expanded ? entries : entries.slice(0, COLLAPSED_ENTRIES);
  const width = String(entries.length).length;
  const lines: string[] = [];
  let currentGroup: string | undefined;
  for (const [index, entry] of shown.entries()) {
    if (entry.group && entry.group.label !== currentGroup) {
      currentGroup = entry.group.label;
      lines.push(theme.fg("muted", entry.group.label));
    }
    const number = `${String(index + 1).padStart(width)}.`;
    const revision = expanded && entry.revision ? theme.fg("dim", ` (${entry.revision})`) : "";
    lines.push(` ${linkUrl(theme.fg("accent", `${number} ${entry.label}`), entry.url)}${revision}`);
    if (expanded) {
      const indent = " ".repeat(width + 3);
      for (const detailLine of [entry.meta, entry.detail].filter((line) => line !== undefined)) {
        for (const line of detailLine.split("\n")) {
          lines.push(theme.fg("dim", `${indent}${line}`));
        }
      }
    }
  }
  if (shown.length < entries.length) {
    lines.push(expandHint(theme, ` … ${entries.length - shown.length} more`));
  }
  return lines;
}

function resultText(result: AgentToolResult<unknown>): string {
  const first = result.content.find((part) => part.type === "text");
  return first && "text" in first ? first.text : "";
}

// One renderer for every attached repository tool: each returns a summary plus entries, the shape
// web_search renders, so they share it rather than carrying ten near-copies.
export function renderRepoToolResult(
  toolName: string,
  result: AgentToolResult<unknown>,
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme,
  context: RepoToolRenderContext,
): Component {
  const state = context.state as RepoToolRenderState;
  if (context.executionStarted) {
    state.startedAt ??= Date.now();
  }
  if (options.isPartial) {
    state.interval ??= setInterval(() => context.invalidate(), ELAPSED_INTERVAL_MS);
    const elapsed = `Elapsed ${formatToolDuration(Date.now() - (state.startedAt ?? Date.now()))}`;
    return new Text(
      `${theme.fg("warning", runningVerb(toolName))} ${theme.fg("dim", elapsed)}`,
      0,
      0,
    );
  }
  if (state.interval) {
    clearInterval(state.interval);
    state.interval = undefined;
  }

  const timing =
    context.durationMs === undefined
      ? []
      : [theme.fg("dim", `Took ${formatToolDuration(context.durationMs)}`)];
  if (context.isError) {
    return new Text([theme.fg("error", resultText(result)), ...timing].join("\n"), 0, 0);
  }

  const details = asRepoToolDetails(result.details);
  if (!details) {
    return new Text([theme.fg("toolOutput", resultText(result)), ...timing].join("\n"), 0, 0);
  }

  const lines: string[] = [];
  const summary = summarizeRepoToolDetails(details);
  if (summary) {
    const [count, ...flags] = summary.split(", ");
    lines.push(
      theme.fg("success", count ?? "") +
        (flags.length > 0 ? theme.fg("warning", `, ${flags.join(", ")}`) : ""),
    );
  }

  switch (details.kind) {
    case "read_file": {
      const contentLines = resultText(result).split("\n");
      const shown = options.expanded ? contentLines : contentLines.slice(0, COLLAPSED_READ_LINES);
      lines.push(...shown.map((line) => theme.fg("toolOutput", line)));
      if (shown.length < contentLines.length) {
        lines.push(expandHint(theme, `… ${contentLines.length - shown.length} more lines`));
      }
      break;
    }
    case "checkout_repo":
      lines.push(theme.fg("toolOutput", details.path));
      break;
    case "provide_results":
      break;
    default:
      lines.push(...renderEntries(details.entries, options.expanded, theme));
      if (options.expanded) {
        lines.push(theme.fg("dim", `Full results: ${formatArtifact(details.artifact)}`));
      }
  }

  lines.push(...timing);
  return new Text(lines.join("\n"), 0, 0);
}
