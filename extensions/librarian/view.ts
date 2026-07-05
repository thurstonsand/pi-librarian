import path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme, keyHint } from "@earendil-works/pi-coding-agent";
import { type Component, Container, Markdown, Spacer, Text } from "@earendil-works/pi-tui";
import type { LibrarianRunDetails, TraceCall } from "./run.ts";
import { LIBRARIAN_TOOL_NAMES } from "./tools/names.ts";

const COLLAPSED_TRACE_CALLS = 3;
// Same frames and cadence as pi's Working... loader (pi-tui loader.ts defaults).
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
export const SPINNER_INTERVAL_MS = 80;

interface LibrarianRenderContext {
  lastComponent: Component | undefined;
}

export function formatDuration(milliseconds: number): string {
  if (milliseconds < 0) {
    return "0.0s";
  }
  const seconds = milliseconds / 1000;
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${Math.round(seconds - minutes * 60)}s`;
  }
  return `${seconds.toFixed(1)}s`;
}

export function shorten(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length <= max ? normalized : `${normalized.slice(0, max)}…`;
}

export function relativizeCachePath(rawPath: string, cacheDir: string): string {
  const reposRoot = path.join(cacheDir, "repos") + path.sep;
  if (!rawPath.startsWith(reposRoot)) {
    return rawPath;
  }

  const underRepos = rawPath.slice(reposRoot.length);
  const segments = underRepos.split(path.sep);
  // repos/<owner>/<repo>/<file...> — drop the owner so the trace reads repo/file.
  return segments.length > 1 ? segments.slice(1).join(path.sep) : underRepos;
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

export function formatTraceLine(call: TraceCall, cacheDir: string): TraceLine {
  const args = (call.args && typeof call.args === "object" ? call.args : {}) as Record<
    string,
    unknown
  >;

  switch (call.name) {
    case "read": {
      const rawPath = typeof args.path === "string" ? args.path : "";
      const offset = typeof args.offset === "number" ? args.offset : undefined;
      const limit = typeof args.limit === "number" ? args.limit : undefined;
      const range =
        offset !== undefined || limit !== undefined
          ? `:${offset ?? 1}${limit !== undefined ? `-${(offset ?? 1) + limit - 1}` : ""}`
          : "";
      return { verb: "read", subject: `${relativizeCachePath(rawPath, cacheDir)}${range}` };
    }
    case "bash": {
      const command = typeof args.command === "string" ? args.command : "";
      return { verb: "bash", subject: shorten(command, 120) };
    }
    case "grep": {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      const searchPath = typeof args.path === "string" ? args.path : "";
      const scope = searchPath ? ` ${relativizeCachePath(searchPath, cacheDir)}` : "";
      return { verb: "grep", subject: `"${shorten(pattern, 60)}"${scope}` };
    }
    case "find": {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      return { verb: "find", subject: shorten(pattern, 80) };
    }
    case "ls": {
      const rawPath = typeof args.path === "string" ? args.path : ".";
      return { verb: "ls", subject: relativizeCachePath(rawPath, cacheDir) };
    }
    case LIBRARIAN_TOOL_NAMES.searchRepos: {
      const query = typeof args.query === "string" ? args.query : "";
      return { verb: "search", subject: `repos ${shorten(query, 80)}` };
    }
    case LIBRARIAN_TOOL_NAMES.searchCode: {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      const repo = typeof args.repo === "string" ? ` in ${shorten(args.repo, 40)}` : "";
      return { verb: "search", subject: `code ${shorten(pattern, 60)}${repo}` };
    }
    case LIBRARIAN_TOOL_NAMES.searchGitHubCode: {
      const pattern = typeof args.pattern === "string" ? args.pattern : "";
      const repos = Array.isArray(args.repos)
        ? args.repos
            .map((repo) => {
              if (!repo || typeof repo !== "object") {
                return undefined;
              }
              const record = repo as Record<string, unknown>;
              return typeof record.owner === "string" && typeof record.repo === "string"
                ? `${record.owner}/${record.repo}`
                : undefined;
            })
            .filter((repo): repo is string => repo !== undefined)
        : [];
      const owners = Array.isArray(args.owners) ? (args.owners as string[]) : [];
      const scopeParts = [...repos, ...owners.map((owner) => `${owner}/*`)];
      const scope = scopeParts.length > 0 ? ` in ${shorten(scopeParts.join(","), 40)}` : "";
      return { verb: "search.gh", subject: `code ${shorten(pattern, 60)}${scope}` };
    }
    case LIBRARIAN_TOOL_NAMES.checkoutRepo: {
      const repo = typeof args.repo === "string" ? args.repo : "";
      const ref = typeof args.ref === "string" ? `@${args.ref}` : "";
      return { verb: "checkout", subject: `${repo}${ref}` };
    }
    case LIBRARIAN_TOOL_NAMES.readGitHubFile: {
      const owner = typeof args.owner === "string" ? args.owner : "";
      const repo = typeof args.repo === "string" ? args.repo : "";
      const filePath = typeof args.path === "string" ? args.path : "";
      return { verb: "read.gh", subject: `${owner}/${repo}/${filePath}` };
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

function renderTraceCallText(call: TraceCall, cacheDir: string, theme: Theme): string {
  const { verb, subject } = formatTraceLine(call, cacheDir);
  const running = call.endedAt === undefined;
  const icon = call.isError
    ? theme.fg("error", "✗")
    : running
      ? theme.fg("accent", currentSpinnerFrame())
      : theme.fg("success", "✓");
  const duration = formatDuration((call.endedAt ?? Date.now()) - call.startedAt);
  const summary = call.resultSummary
    ? theme.fg(call.isError ? "error" : "muted", ` (${shorten(call.resultSummary, 60)})`)
    : "";

  const subjectText = subject ? ` ${theme.fg("toolOutput", subject)}` : "";
  return `  ${icon} ${theme.fg("dim", verb)}${subjectText}${summary} ${theme.fg("dim", `· ${duration}`)}`;
}

function renderQuestion(details: LibrarianRunDetails, expanded: boolean, theme: Theme): string {
  return theme.fg("dim", expanded ? details.query : shorten(details.query, 120));
}

function renderFooter(details: LibrarianRunDetails, theme: Theme): string {
  const callCount = details.trace.length;
  const elapsed = formatDuration((details.endedAt ?? Date.now()) - details.startedAt);
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
  cacheDir: string,
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
    lines.push(renderTraceCallText(call, cacheDir, theme));
  }
  return lines;
}

export function renderLibrarianResult(
  result: AgentToolResult<LibrarianRunDetails>,
  options: { expanded: boolean; isPartial: boolean },
  theme: Theme,
  cacheDir: string,
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
    for (const line of renderTrace(details, options.expanded, cacheDir, theme)) {
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
    const bullets = findings.locations.map((location) => {
      const lineSuffix = location.lines ? `:${location.lines}` : "";
      return `- \`${location.repo}/${location.file}${lineSuffix}\` — ${location.note}`;
    });
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
