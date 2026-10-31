import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Type } from "typebox";
import { parseTypeBoxValue, safeParseTypeBoxValue } from "../../shared/typebox.ts";
import type { ParallelSettings } from "../settings.ts";
import type { FetchedDocument, FetchWarning, WebFetcher } from "./contract.ts";
import { formatWarnings, writeDocumentBody } from "./shared.ts";

export const DEFAULT_SEARCH_MODE = "advanced";
export const DEFAULT_MAX_RESULTS = 5;
export const MAX_MAX_RESULTS = 8;

const API_URL = "https://api.parallel.ai/v1";

const execAsync = promisify(exec);

export interface ParallelSearchRequest {
  objective: string;
  search_queries: string[];
  mode: typeof DEFAULT_SEARCH_MODE;
  advanced_settings: { max_results: number; source_policy?: { after_date: string } };
}

export interface ParallelExtractRequest {
  urls: string[];
  objective?: string;
  advanced_settings: { full_content: true };
}

const PARALLEL_ERROR_SCHEMA = Type.Object({
  error: Type.Object({ message: Type.String() }),
});

// Authentication is refused before the API proper, in a gateway's shape: a bad key is
// `{"code":16,"message":"Invalid API key (C.1)"}`, not the `error` object above.
const PARALLEL_GATEWAY_ERROR_SCHEMA = Type.Object({ message: Type.String() });

// The key is resolved per call, so a rotated secret takes effect without restarting pi.
// Two endpoints and one header: the SDK they replace brought an optional dependency that some
// registry mirrors do not carry at all.
export class ParallelClient {
  constructor(private readonly settings: ParallelSettings) {}

  search(request: ParallelSearchRequest, signal: AbortSignal | undefined): Promise<unknown> {
    return this.post("search", request, signal);
  }

  extract(request: ParallelExtractRequest, signal: AbortSignal | undefined): Promise<unknown> {
    return this.post("extract", request, signal);
  }

  private async post(
    endpoint: "search" | "extract",
    body: ParallelSearchRequest | ParallelExtractRequest,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    const response = await fetch(`${API_URL}/${endpoint}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": await resolveApiKey(this.settings, signal),
      },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
    const payload: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
      const detail =
        safeParseTypeBoxValue(PARALLEL_ERROR_SCHEMA, payload)?.error.message ??
        safeParseTypeBoxValue(PARALLEL_GATEWAY_ERROR_SCHEMA, payload)?.message;
      throw new Error(
        `Parallel ${endpoint} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`,
      );
    }
    return payload;
  }
}

export function hasParallelCredentials(settings: ParallelSettings): boolean {
  return settings.apiKey !== undefined || settings.apiKeyCommand !== undefined;
}

async function resolveApiKey(
  settings: ParallelSettings,
  signal: AbortSignal | undefined,
): Promise<string> {
  if (settings.apiKey) {
    return settings.apiKey;
  }
  if (!settings.apiKeyCommand) {
    throw new Error("Parallel credentials are not configured");
  }
  let apiKey: string;
  try {
    const command = execAsync(settings.apiKeyCommand, {
      timeout: 30_000,
      maxBuffer: 64 * 1024,
      ...(signal ? { signal } : {}),
    });
    command.child.stdin?.end();
    apiKey = (await command).stdout.trim();
  } catch {
    // Subprocess errors include the command and output, which may contain credentials.
    throw new Error("Parallel API key command failed");
  }
  if (!apiKey || /\s/.test(apiKey)) {
    throw new Error("Parallel API key command must return a single nonempty key");
  }
  return apiKey;
}

export function normalizeSearchQueries(
  searchQueries: string[] | undefined,
  objective: string,
): string[] {
  const cleaned = (searchQueries ?? []).map((query) => query.trim()).filter(Boolean);
  return cleaned.length > 0 ? cleaned : [objective];
}

export function clampMaxResults(maxResults: number | undefined): number {
  if (maxResults === undefined) return DEFAULT_MAX_RESULTS;
  return Math.min(Math.max(maxResults, 1), MAX_MAX_RESULTS);
}

export function validateAfterDate(afterDate: string | undefined): string | undefined {
  if (!afterDate) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(afterDate)) {
    throw new Error(`Invalid after_date: ${afterDate}. Expected YYYY-MM-DD.`);
  }

  const date = new Date(`${afterDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== afterDate) {
    throw new Error(
      `Invalid after_date: ${afterDate}. Expected a real calendar date in YYYY-MM-DD format.`,
    );
  }
  return afterDate;
}

const nullableString = Type.Union([Type.String(), Type.Null()]);

const parallelWarnings = Type.Optional(
  Type.Union([
    Type.Array(Type.Object({ message: Type.String(), type: Type.String() })),
    Type.Null(),
  ]),
);

const parallelSearchResponse = Type.Object({
  results: Type.Array(
    Type.Object({
      url: Type.String(),
      title: Type.Optional(nullableString),
      publish_date: Type.Optional(nullableString),
      excerpts: Type.Array(Type.String()),
    }),
  ),
  warnings: parallelWarnings,
});

const parallelExtractResponse = Type.Object({
  results: Type.Array(
    Type.Object({
      url: Type.String(),
      title: Type.Optional(nullableString),
      publish_date: Type.Optional(nullableString),
      excerpts: Type.Array(Type.String()),
      full_content: Type.Optional(nullableString),
    }),
  ),
  errors: Type.Array(
    Type.Object({
      url: Type.String(),
      error_type: Type.String(),
      http_status_code: Type.Union([Type.Number(), Type.Null()]),
      content: nullableString,
    }),
  ),
  warnings: parallelWarnings,
});

type ParallelExtractError = {
  url: string;
  error_type: string;
  http_status_code: number | null;
  content: string | null;
};

export type ParallelSearchHit = {
  url: string;
  title?: string;
  publish_date?: string;
  excerpts: string[];
};

export type ParallelSearchResult = {
  results: ParallelSearchHit[];
  warnings: FetchWarning[];
};

export function parseParallelSearchResponse(response: unknown): ParallelSearchResult {
  const parsed = parseTypeBoxValue(parallelSearchResponse, response, "Parallel search response");
  return {
    results: parsed.results.map(({ url, title, publish_date, excerpts }) => ({
      url,
      ...(title != null ? { title } : {}),
      ...(publish_date != null ? { publish_date } : {}),
      excerpts,
    })),
    warnings: (parsed.warnings ?? []).map(({ message, type }) => ({ message, type })),
  };
}

export function buildSearchSummary(results: ParallelSearchHit[], warnings: FetchWarning[]): string {
  const warningLines = formatWarnings(warnings);
  const resultText =
    results.length === 0
      ? "No results."
      : results
          .map((result, index) => {
            const title = result.title?.trim() || result.url;
            const publishDate = result.publish_date ? ` (${result.publish_date})` : "";
            const excerpts = result.excerpts.map((excerpt, excerptIndex) => {
              const prefix =
                result.excerpts.length > 1 ? `   Excerpt ${excerptIndex + 1}: ` : "   ";
              return `${prefix}${excerpt}`;
            });
            return [`${index + 1}. ${title}${publishDate}`, `   ${result.url}`, ...excerpts].join(
              "\n",
            );
          })
          .join("\n\n");

  if (warningLines.length === 0) return resultText;
  return [`Warnings:`, ...warningLines.map((warning) => `- ${warning}`), "", resultText].join("\n");
}

export interface ParallelDocument extends FetchedDocument {
  kind: "parallel.page";
  source: "parallel";
}

export function createParallelFetcher(client: ParallelClient): WebFetcher {
  return {
    source: "parallel",
    promptGuidelines: [],
    canFetch: () => true,
    async fetch({ urls, objective, artifactDir, signal }) {
      const { results, errors, warnings } = parseTypeBoxValue(
        parallelExtractResponse,
        await client.extract(
          { urls, ...(objective ? { objective } : {}), advanced_settings: { full_content: true } },
          signal,
        ),
        "Parallel extract response",
      );

      // Parallel returns results in completion order, not request order, so
      // positional mapping misattributes content. Match each result back to
      // its requested url, tolerating percent-encoding drift.
      const requestedByCanonical = new Map(urls.map((url) => [canonicalUrl(url), url]));
      const documents = await Promise.all(
        results.map(async (item): Promise<ParallelDocument> => {
          const requestedUrl = requestedByCanonical.get(canonicalUrl(item.url)) ?? item.url;
          const body = await writeDocumentBody(
            artifactDir,
            requestedUrl,
            "content.md",
            item.full_content ?? "",
          );
          return {
            kind: "parallel.page",
            source: "parallel",
            url: requestedUrl,
            ...(item.url !== requestedUrl ? { link: item.url } : {}),
            title: item.title?.trim() || item.url,
            facts: item.publish_date ? [`published ${item.publish_date}`] : [],
            // With an objective, Parallel's excerpts are the steered answer the
            // agent asked for — deliver all of them uncapped as highlights.
            ...(objective ? { highlights: item.excerpts } : { excerpt: item.excerpts[0] }),
            bodies: [body],
          };
        }),
      );
      return {
        documents,
        warnings: formatWarnings(warnings).map((message) => ({ type: "parallel", message })),
        failures: errors.map((error) => ({
          url: error.url,
          reason: formatParallelError(error),
        })),
      };
    },
  };
}

export function canonicalUrl(url: string): string {
  let href: string;
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    href = parsed.href;
  } catch {
    return url;
  }
  try {
    href = decodeURI(href);
  } catch {
    // keep the encoded form when it does not round-trip
  }
  return href.endsWith("/") ? href.slice(0, -1) : href;
}

function formatParallelError(error: ParallelExtractError): string {
  const bits = [`type=${error.error_type}`];
  if (error.http_status_code != null) bits.push(`status=${error.http_status_code}`);
  if (error.content?.trim()) bits.push(`content=${error.content.trim()}`);
  return bits.join(" | ");
}
