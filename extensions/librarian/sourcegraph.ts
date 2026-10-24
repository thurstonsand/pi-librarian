import { Type } from "typebox";
import { parseTypeBoxValue, safeParseTypeBoxValue } from "../shared/typebox.ts";

export class SourcegraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcegraphError";
  }
}

const SKIPPED_SCHEMA = Type.Object({
  reason: Type.String(),
  title: Type.String(),
});

const PROGRESS_SCHEMA = Type.Object({
  done: Type.Boolean(),
  matchCount: Type.Number(),
  repositoriesCount: Type.Optional(Type.Number()),
  durationMs: Type.Number(),
  skipped: Type.Optional(Type.Array(SKIPPED_SCHEMA)),
});

const ALERT_SCHEMA = Type.Object({
  title: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const ERROR_SCHEMA = Type.Object({ message: Type.String() });

const LINE_MATCH_SCHEMA = Type.Object({
  line: Type.String(),
  lineNumber: Type.Number(),
});

const SYMBOL_SCHEMA = Type.Object({
  name: Type.String(),
  containerName: Type.Optional(Type.String()),
  kind: Type.String(),
  line: Type.Number(),
});

const MATCH_SCHEMA = Type.Object({
  type: Type.String(),
  repository: Type.String(),
  path: Type.Optional(Type.String()),
  commit: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fork: Type.Optional(Type.Boolean()),
  archived: Type.Optional(Type.Boolean()),
  lineMatches: Type.Optional(Type.Union([Type.Array(LINE_MATCH_SCHEMA), Type.Null()])),
  symbols: Type.Optional(Type.Array(SYMBOL_SCHEMA)),
});

export interface SourcegraphLine {
  // 1-based, normalized from the stream's 0-based content line numbers.
  lineNumber: number;
  text: string;
}

export interface SourcegraphSymbol {
  name: string;
  containerName: string | undefined;
  kind: string;
  // 1-based, as the stream already reports symbol lines.
  line: number;
}

export interface SourcegraphMatch {
  type: string;
  repository: string;
  path: string | undefined;
  commit: string | undefined;
  description: string | undefined;
  fork: boolean;
  archived: boolean;
  lines: SourcegraphLine[];
  symbols: SourcegraphSymbol[];
}

export interface SourcegraphProgress {
  matchCount: number;
  repositoriesCount: number;
  durationMs: number;
  skipped: { reason: string; title: string }[];
}

export interface StreamResult {
  matches: SourcegraphMatch[];
  progress: SourcegraphProgress;
  done: boolean;
  alerts: { title: string; description: string | undefined }[];
}

export interface StreamSearchParams {
  query: string;
  patternType: "standard" | "keyword";
  signal: AbortSignal;
  // Receives the partial result when the stream breaks off, so a timeout can still report counts.
  onPartial: (partial: StreamResult) => void;
}

function toMatch(value: unknown): SourcegraphMatch {
  const parsed = parseTypeBoxValue(MATCH_SCHEMA, value, "Sourcegraph match");
  return {
    type: parsed.type,
    repository: parsed.repository,
    path: parsed.path,
    commit: parsed.commit,
    description: parsed.description,
    fork: parsed.fork ?? false,
    archived: parsed.archived ?? false,
    lines: (parsed.lineMatches ?? []).map((line) => ({
      lineNumber: line.lineNumber + 1,
      text: line.line,
    })),
    symbols: (parsed.symbols ?? []).map((symbol) => ({
      name: symbol.name,
      containerName: symbol.containerName || undefined,
      kind: symbol.kind,
      line: symbol.line,
    })),
  };
}

export class SourcegraphClient {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async streamSearch(params: StreamSearchParams): Promise<StreamResult> {
    const url = new URL("/.api/search/stream", this.url);
    url.searchParams.set("q", params.query);
    url.searchParams.set("v", "V3");
    url.searchParams.set("t", params.patternType);

    const response = await fetch(url, {
      headers: {
        authorization: `token ${this.token}`,
        accept: "text/event-stream",
        "user-agent": "pi-librarian",
      },
      signal: params.signal,
    });
    if (response.status === 401 || response.status === 403) {
      throw new SourcegraphError(
        `Sourcegraph rejected the token (${response.status}): ${(await response.text()).trim().slice(0, 200)}`,
      );
    }
    if (!response.ok || !response.body) {
      throw new SourcegraphError(
        `Sourcegraph search returned ${response.status}: ${(await response.text()).slice(0, 200)}`,
      );
    }

    const result: StreamResult = {
      matches: [],
      progress: { matchCount: 0, repositoriesCount: 0, durationMs: 0, skipped: [] },
      done: false,
      alerts: [],
    };
    const handle = (event: string, data: string) => {
      const payload: unknown = JSON.parse(data);
      switch (event) {
        case "matches":
          if (!Array.isArray(payload)) {
            throw new SourcegraphError("Sourcegraph matches event was not a list.");
          }
          for (const value of payload) {
            result.matches.push(toMatch(value));
          }
          break;
        case "progress": {
          const progress = parseTypeBoxValue(PROGRESS_SCHEMA, payload, "Sourcegraph progress");
          // Each progress event also carries an internal trace URL; it is never copied out.
          result.progress = {
            matchCount: progress.matchCount,
            repositoriesCount: progress.repositoriesCount ?? 0,
            durationMs: progress.durationMs,
            skipped: (progress.skipped ?? []).map((skipped) => ({
              reason: skipped.reason,
              title: skipped.title,
            })),
          };
          break;
        }
        case "alert": {
          const alert = parseTypeBoxValue(ALERT_SCHEMA, payload, "Sourcegraph alert");
          result.alerts.push({ title: alert.title, description: alert.description ?? undefined });
          break;
        }
        case "error": {
          const error = safeParseTypeBoxValue(ERROR_SCHEMA, payload);
          throw new SourcegraphError(`Sourcegraph: ${error?.message ?? data.slice(0, 200)}`);
        }
        case "done":
          result.done = true;
          break;
      }
    };

    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          let event = "message";
          const data: string[] = [];
          for (const line of block.split("\n")) {
            if (line.startsWith("event:")) {
              event = line.slice("event:".length).trim();
            } else if (line.startsWith("data:")) {
              data.push(line.slice("data:".length).trimStart());
            }
          }
          if (data.length > 0) {
            handle(event, data.join("\n"));
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      params.onPartial(result);
      throw error;
    }
    return result;
  }
}
