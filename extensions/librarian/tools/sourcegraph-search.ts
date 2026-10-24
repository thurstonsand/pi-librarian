import { SearchTimeoutError, searchTimeoutMessage, withSearchDeadline } from "../budget.ts";
import type { EntryGroup, ShownEntry } from "../delivery.ts";
import type { LibrarianSource, SearchSettings } from "../settings.ts";
import type { SourcegraphClient, StreamResult } from "../sourcegraph.ts";

// The stream's own report of a cut-off is unreliable, so a search the server stopped at its
// timeout is recognised by its clock: a predicate search can time out with zero results, a clean
// done, and facets claiming to be exhaustive.
const CLIENT_GRACE_MS = 3000;
const COMPLETE_SKIP_REASONS = new Set(["repository-fork", "repository-archived"]);

export class SourcegraphAlertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourcegraphAlertError";
  }
}

export interface SourcegraphSearchOutcome {
  result: StreamResult;
  complete: boolean;
  incompleteReason: string | undefined;
  warnings: string[];
}

export interface SourcegraphSearchRequest {
  client: SourcegraphClient;
  search: SearchSettings;
  signal: AbortSignal | undefined;
  query: string;
  patternType: "standard" | "keyword";
  // Phrases what had been found when a search is cut off, for the narrowing error.
  describeFound: (partial: StreamResult) => string | undefined;
  advice: string;
}

function alertText(alert: { title: string; description: string | undefined }): string {
  return alert.description ? `${alert.title}: ${alert.description}` : alert.title;
}

export async function runSourcegraphSearch(
  request: SourcegraphSearchRequest,
): Promise<SourcegraphSearchOutcome> {
  const { search } = request;
  const timeoutMs = search.timeoutSeconds * 1000;
  let partial: StreamResult | undefined;
  const timeoutError = (found: StreamResult | undefined) =>
    new SearchTimeoutError(
      searchTimeoutMessage(
        search.timeoutSeconds,
        found ? request.describeFound(found) : undefined,
        request.advice,
      ),
    );

  const result = await withSearchDeadline(
    timeoutMs + CLIENT_GRACE_MS,
    request.signal,
    () => timeoutError(partial),
    (deadline) =>
      request.client.streamSearch({
        query: `${request.query} timeout:${search.timeoutSeconds}s`,
        patternType: request.patternType,
        signal: deadline.signal,
        onPartial: (found) => {
          partial = found;
        },
      }),
  );

  const skipped = result.progress.skipped;
  if (
    !result.done ||
    result.progress.durationMs >= timeoutMs ||
    skipped.some((entry) => entry.reason === "shard-timeout")
  ) {
    throw timeoutError(result);
  }
  if (result.matches.length === 0 && result.alerts.length > 0) {
    throw new SourcegraphAlertError(result.alerts.map(alertText).join("\n"));
  }

  const shortfall = skipped.filter((entry) => !COMPLETE_SKIP_REASONS.has(entry.reason));
  return {
    result,
    complete: shortfall.length === 0,
    incompleteReason:
      shortfall.length === 0
        ? undefined
        : shortfall
            .map((entry) =>
              entry.reason === "shard-match-limit"
                ? "reached the result limit for one search"
                : entry.title,
            )
            .join("; "),
    warnings: result.alerts.map(alertText),
  };
}

export function validateRegex(argument: string, pattern: string): string {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    throw new Error(`${argument} cannot be blank.`);
  }
  // A space ends a filter value, and the engine answers an invalid regex with a silent zero.
  if (/\s/.test(trimmed)) {
    throw new Error(`${argument} cannot contain spaces; use \\s in the pattern: "${pattern}".`);
  }
  try {
    new RegExp(trimmed);
  } catch (error) {
    throw new Error(
      `${argument} is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return trimmed;
}

// Several repo: filters are intersected; one alternation is the union an agent means by a list.
export function repoFilter(patterns: string[] | undefined): string | undefined {
  if (!patterns || patterns.length === 0) {
    return undefined;
  }
  const validated = patterns.map((pattern) => validateRegex("repos", pattern));
  return validated.length === 1
    ? `repo:${validated[0]}`
    : `repo:${validated.map((pattern) => `(?:${pattern})`).join("|")}`;
}

export function rejectKeywordFilters(pattern: string): string {
  const trimmed = pattern.trim();
  const unquoted = trimmed.replace(/"[^"]*"/g, " ");
  const filter = /(^|\s)(-?[A-Za-z_.]+):\S/.exec(unquoted);
  if (filter) {
    throw new Error(
      `pattern contains a filter "${filter[2]}:". Use the repos, path, and language arguments instead, or quote it to search for the text.`,
    );
  }
  return trimmed;
}

export interface MappedRepository {
  group: EntryGroup;
  repo: string;
}

// Sourcegraph names repositories host/path by default, so stripping a declared clone source's
// hostname leaves exactly what checkout_repo takes. Anything else is shown whole, never as a guessed
// source: a site can change the naming pattern, and a mirror's host says nothing about its kind.
export function mapRepository(name: string, cloneSources: LibrarianSource[]): MappedRepository {
  const [host, ...rest] = name.split("/");
  const source = cloneSources.find(
    (candidate) => new URL(candidate.url).hostname.toLowerCase() === host?.toLowerCase(),
  );
  if (source && rest.length > 0) {
    return { group: { label: source.name, cloneSource: source.name }, repo: rest.join("/") };
  }
  return { group: { label: "not a declared source", cloneSource: undefined }, repo: name };
}

export interface GroupedEntry extends ShownEntry {
  group: EntryGroup;
}

// Groups appear in order of their first, best-ranked result, and each keeps its own ranking.
export function groupInRankOrder(entries: GroupedEntry[]): GroupedEntry[] {
  const order: string[] = [];
  for (const entry of entries) {
    if (!order.includes(entry.group.label)) {
      order.push(entry.group.label);
    }
  }
  return order.flatMap((label) => entries.filter((entry) => entry.group.label === label));
}

export function sourcegraphClients(
  instances: LibrarianSource[],
  clients: Map<string, SourcegraphClient>,
  instance: LibrarianSource,
): SourcegraphClient {
  const client = clients.get(instance.name);
  if (!client || !instances.includes(instance)) {
    throw new Error(`No Sourcegraph client for source "${instance.name}".`);
  }
  return client;
}
