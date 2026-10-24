import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { SearchTimeoutError, searchTimeoutMessage, withSearchDeadline } from "../budget.ts";
import { type LibrarianSource, MAX_SEARCH_LIMIT, type SearchSettings } from "../settings.ts";

export function limitParameter(maximum: number, defaultLimit: number) {
  return Type.Optional(
    Type.Integer({
      minimum: 1,
      maximum,
      description: `How many results to return. Default: ${defaultLimit}. Raise it only when the first results did not answer the question; each result with matched lines costs about 1 KB of context.`,
    }),
  );
}

export function resolveLimit(
  requested: number | undefined,
  search: SearchSettings,
  maximum: number,
): number {
  return Math.min(requested ?? search.defaultLimit, maximum, MAX_SEARCH_LIMIT);
}

export function sourceLabels(sources: LibrarianSource[]): string {
  return sources.map((source) => `${source.name} (${new URL(source.url).host})`).join(", ");
}

// One instance means no argument: an enum of one member is noise the model reads on every call.
export function sourceProperties(instances: LibrarianSource[], description: string) {
  return instances.length > 1
    ? {
        source: StringEnum(
          instances.map((instance) => instance.name),
          { description: `${description}: ${sourceLabels(instances)}.` },
        ),
      }
    : {};
}

export function selectInstance(instances: LibrarianSource[], params: object): LibrarianSource {
  if (instances.length === 1 && instances[0]) {
    return instances[0];
  }
  const requested =
    "source" in params && typeof params.source === "string" ? params.source : undefined;
  const instance = instances.find((candidate) => candidate.name === requested);
  if (!instance) {
    throw new Error(
      `Unknown source "${requested ?? ""}". Use one of: ${instances.map((candidate) => candidate.name).join(", ")}.`,
    );
  }
  return instance;
}

// Engines read a space in an interpolated value as the start of another qualifier, and a quoted
// value as a silent zero, so there is no safe escaping: refuse both.
export function rejectUnsafeValue(argument: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${argument} cannot be blank.`);
  }
  if (/[\s"']/.test(trimmed)) {
    throw new Error(`${argument} cannot contain spaces or quotes: "${value}".`);
  }
  return trimmed;
}

export function validateIsoDate(argument: string, value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match || Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) {
    throw new Error(`${argument} must be a date as YYYY-MM-DD, e.g. 2026-01-01: "${value}".`);
  }
  return trimmed;
}

// REST engines have no server-side cancel and report nothing when stopped, so they are held to the
// budget itself; closing the connection is all there is.
export function runRestSearch<T>(
  search: SearchSettings,
  signal: AbortSignal | undefined,
  advice: string,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  return withSearchDeadline(
    search.timeoutSeconds * 1000,
    signal,
    () => new SearchTimeoutError(searchTimeoutMessage(search.timeoutSeconds, undefined, advice)),
    (deadline) => run(deadline.signal),
  );
}
