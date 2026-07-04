import { Type } from "typebox";
import { safeParseTypeBoxValue } from "../shared/typebox.ts";

const GREP_MCP_URL = "https://mcp.grep.app";
const GREP_SEARCH_TIMEOUT_MS = 30_000;

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
      throw new GrepError("Grep MCP returned an error result.");
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

export async function searchCodeGrep(
  params: GrepCodeSearchParams,
  signal: AbortSignal | undefined,
): Promise<GrepCodeSearchResult> {
  const timeoutSignal = AbortSignal.timeout(GREP_SEARCH_TIMEOUT_MS);
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
    throw new GrepError(`Grep MCP returned ${response.status}: ${body.slice(0, 200)}`);
  }

  return parseGrepMcpEvents(body);
}
