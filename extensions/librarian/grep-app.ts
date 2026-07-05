import { Type } from "typebox";
import { safeParseTypeBoxValue } from "../shared/typebox.ts";

const GREP_MCP_URL = "https://mcp.grep.app";
// Escalating per-attempt budgets: the upstream gateway kills stalled requests at ~15s, so
// early attempts abort fast (p90 success is ~500ms) instead of waiting out the full timeout.
const GREP_ATTEMPT_TIMEOUTS_MS = [3_000, 5_000, 7_000];
const GREP_RETRY_DELAY_MS = 300;

export class GrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GrepError";
  }
}

export interface GrepCodeSearchParams {
  query: string;
  matchCase?: boolean;
  matchWholeWords?: boolean;
  useRegexp?: boolean;
  repo?: string;
  path?: string;
  language?: string[];
}

export interface GrepSnippet {
  lineNumber: number;
  content: string;
}

export interface GrepCodeMatch {
  repo: string;
  path: string;
  url: string | undefined;
  license: string | undefined;
  snippets: GrepSnippet[];
}

export interface GrepCodeSearchResult {
  matches: GrepCodeMatch[];
}

const MCP_TEXT_CONTENT_SCHEMA = Type.Object({
  type: Type.Literal("text"),
  text: Type.String(),
});

const MCP_CALL_RESULT_SCHEMA = Type.Object({
  content: Type.Optional(Type.Array(Type.Unknown())),
  isError: Type.Optional(Type.Boolean()),
});

const MCP_ERROR_SCHEMA = Type.Object({
  message: Type.String(),
});

const MCP_RESPONSE_SCHEMA = Type.Object({
  result: Type.Optional(Type.Unknown()),
  error: Type.Optional(Type.Unknown()),
});

function parseHeader(line: string, name: string): string | undefined {
  const prefix = `${name}: `;
  return line.startsWith(prefix) ? line.slice(prefix.length).trim() : undefined;
}

export function parseGrepSearchText(text: string): GrepCodeMatch | undefined {
  if (text.trim() === "No results found for your query.") {
    return undefined;
  }

  let repo: string | undefined;
  let path: string | undefined;
  let url: string | undefined;
  let license: string | undefined;
  const snippets: GrepSnippet[] = [];
  let currentSnippet: { lineNumber: number; lines: string[] } | undefined;

  function finishSnippet(): void {
    if (!currentSnippet) {
      return;
    }

    snippets.push({
      lineNumber: currentSnippet.lineNumber,
      content: currentSnippet.lines.join("\n").trimEnd(),
    });
    currentSnippet = undefined;
  }

  for (const line of text.split("\n")) {
    const parsedRepo = parseHeader(line, "Repository");
    if (parsedRepo) {
      repo = parsedRepo;
      continue;
    }

    const parsedPath = parseHeader(line, "Path");
    if (parsedPath) {
      path = parsedPath;
      continue;
    }

    const parsedUrl = parseHeader(line, "URL");
    if (parsedUrl) {
      url = parsedUrl;
      continue;
    }

    const parsedLicense = parseHeader(line, "License");
    if (parsedLicense) {
      license = parsedLicense === "Unknown" ? undefined : parsedLicense;
      continue;
    }

    const snippetStart = /^--- Snippet \d+ \(Line (\d+)\) ---$/.exec(line);
    if (snippetStart) {
      finishSnippet();
      currentSnippet = { lineNumber: Number(snippetStart[1]), lines: [] };
      continue;
    }

    if (currentSnippet) {
      currentSnippet.lines.push(line.startsWith("> ") ? line.slice(2) : line);
    }
  }

  finishSnippet();

  if (!repo || !path) {
    return undefined;
  }

  return { repo, path, url, license, snippets };
}

export function parseGrepMcpEvents(body: string): GrepCodeSearchResult {
  const matches: GrepCodeMatch[] = [];

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.startsWith("data: ")) {
      continue;
    }

    const response = safeParseTypeBoxValue(
      MCP_RESPONSE_SCHEMA,
      JSON.parse(line.slice("data: ".length)),
    );
    if (!response) {
      continue;
    }

    const error = safeParseTypeBoxValue(MCP_ERROR_SCHEMA, response.error);
    if (error) {
      throw new GrepError(error.message);
    }

    const result = safeParseTypeBoxValue(MCP_CALL_RESULT_SCHEMA, response.result);
    if (!result) {
      continue;
    }
    if (result.isError) {
      const message = (result.content ?? [])
        .map((rawContent) => safeParseTypeBoxValue(MCP_TEXT_CONTENT_SCHEMA, rawContent)?.text)
        .filter((text): text is string => text !== undefined)
        .join("\n")
        .trim();
      throw new GrepError(message || "Grep MCP returned an error result.");
    }

    for (const rawContent of result.content ?? []) {
      const content = safeParseTypeBoxValue(MCP_TEXT_CONTENT_SCHEMA, rawContent);
      if (!content) {
        continue;
      }

      const match = parseGrepSearchText(content.text);
      if (match) {
        matches.push(match);
      }
    }
  }

  return { matches };
}

function buildGrepArguments(params: GrepCodeSearchParams): Record<string, unknown> {
  const args: Record<string, unknown> = { query: params.query };

  if (params.matchCase) {
    args.matchCase = true;
  }
  if (params.matchWholeWords) {
    args.matchWholeWords = true;
  }
  if (params.useRegexp) {
    args.useRegexp = true;
  }
  if (params.repo) {
    args.repo = params.repo;
  }
  if (params.path) {
    args.path = params.path;
  }
  if (params.language && params.language.length > 0) {
    args.language = params.language;
  }

  return args;
}

function extractHtmlTitle(body: string): string | undefined {
  const match = /<title[^>]*>(.*?)<\/title>/is.exec(body);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function formatHttpError(status: number, body: string): string {
  return `Grep MCP returned ${status}: ${extractHtmlTitle(body) ?? body.slice(0, 200)}`;
}

function formatTransientError(error: unknown): string {
  const cause =
    error instanceof GrepTransientHttpError ? `returned ${error.status}` : "request failed";
  return `Grep MCP ${cause} after retry (transient backend error). Retry, or simplify the query.`;
}

function delay(milliseconds: number, signal: AbortSignal | undefined): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(signal.reason);
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

async function searchCodeGrepAttempt(
  params: GrepCodeSearchParams,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<GrepCodeSearchResult> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetch(GREP_MCP_URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "user-agent": "pi-librarian",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "searchGitHub",
        arguments: buildGrepArguments(params),
      },
    }),
    signal: requestSignal,
  });

  const body = await response.text();
  if (!response.ok) {
    if (response.status >= 500) {
      throw new GrepTransientHttpError(response.status, body);
    }
    throw new GrepError(formatHttpError(response.status, body));
  }

  return parseGrepMcpEvents(body);
}

// Do not extend GrepError: GrepError is the deterministic no-retry signal.
class GrepTransientHttpError extends Error {
  readonly status: number;

  constructor(status: number, body: string) {
    super(formatHttpError(status, body));
    this.name = "GrepTransientHttpError";
    this.status = status;
  }
}

export async function searchCodeGrep(
  params: GrepCodeSearchParams,
  signal: AbortSignal | undefined,
): Promise<GrepCodeSearchResult> {
  if (signal?.aborted) {
    throw signal.reason;
  }

  let transientError: unknown;
  for (const [attempt, timeoutMs] of GREP_ATTEMPT_TIMEOUTS_MS.entries()) {
    if (attempt > 0) {
      await delay(GREP_RETRY_DELAY_MS, signal);
    }

    try {
      return await searchCodeGrepAttempt(params, signal, timeoutMs);
    } catch (error) {
      if (error instanceof GrepError || signal?.aborted) {
        throw error;
      }
      transientError = error;
    }
  }

  throw new GrepError(formatTransientError(transientError));
}
