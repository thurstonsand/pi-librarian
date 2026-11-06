import { SearchTimeoutError, searchTimeoutMessage, withSearchDeadline } from "../budget.js";
// The stream's own report of a cut-off is unreliable, so a search the server stopped at its
// timeout is recognised by its clock: a predicate search can time out with zero results, a clean
// done, and facets claiming to be exhaustive.
const CLIENT_GRACE_MS = 3000;
const COMPLETE_SKIP_REASONS = new Set(["repository-fork", "repository-archived"]);
export class SourcegraphAlertError extends Error {
    constructor(message) {
        super(message);
        this.name = "SourcegraphAlertError";
    }
}
function alertText(alert) {
    return alert.description ? `${alert.title}: ${alert.description}` : alert.title;
}
export async function runSourcegraphSearch(request) {
    const { search } = request;
    const timeoutMs = search.timeoutSeconds * 1000;
    let partial;
    const timeoutError = (found) => new SearchTimeoutError(searchTimeoutMessage(search.timeoutSeconds, found ? request.describeFound(found) : undefined, request.advice));
    // The budget is for the search; a token command can take seconds on first use.
    await request.client.authorize();
    const result = await withSearchDeadline(timeoutMs + CLIENT_GRACE_MS, request.signal, () => timeoutError(partial), (deadline) => request.client.streamSearch({
        query: `${request.query} timeout:${search.timeoutSeconds}s`,
        patternType: request.patternType,
        signal: deadline.signal,
        onPartial: (found) => {
            partial = found;
        },
    }));
    const skipped = result.progress.skipped;
    if (!result.done ||
        result.progress.durationMs >= timeoutMs ||
        skipped.some((entry) => entry.reason === "shard-timeout")) {
        throw timeoutError(result);
    }
    if (result.matches.length === 0 && result.alerts.length > 0) {
        throw new SourcegraphAlertError(result.alerts.map(alertText).join("\n"));
    }
    const shortfall = skipped.filter((entry) => !COMPLETE_SKIP_REASONS.has(entry.reason));
    return {
        result,
        complete: shortfall.length === 0,
        incompleteReason: shortfall.length === 0
            ? undefined
            : shortfall
                .map((entry) => entry.reason === "shard-match-limit"
                ? "reached the result limit for one search"
                : entry.title)
                .join("; "),
        warnings: result.alerts.map(alertText),
    };
}
// JavaScript's RegExp is not RE2: it refuses RE2's inline flags and accepts lookaround and
// backreferences, which RE2 lacks. So RE2-only syntax is rewritten before the JavaScript check, and
// the JavaScript-only syntax is refused, before an invalid pattern can become a silent zero.
export function validateRe2(argument, pattern) {
    if (/\(\?<?[=!]/.test(pattern)) {
        throw new Error(`${argument} uses lookaround, which RE2 does not support.`);
    }
    if (/\\[1-9]/.test(pattern)) {
        throw new Error(`${argument} uses a backreference, which RE2 does not support.`);
    }
    const javascript = pattern
        .replace(/\(\?[imsU]+\)/g, "")
        .replace(/\(\?[imsU]*-?[imsU]*:/g, "(?:")
        .replace(/\(\?P</g, "(?<")
        .replace(/\[\[:[a-z]+:\]\]/g, "\\w")
        .replace(/\\[pP]\{?[A-Za-z]+\}?/g, "\\w")
        .replace(/\\[Az]/g, "");
    try {
        new RegExp(javascript);
    }
    catch (error) {
        throw new Error(`${argument} is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`);
    }
    return pattern;
}
export function validateRegex(argument, pattern) {
    const trimmed = pattern.trim();
    if (trimmed.length === 0) {
        throw new Error(`${argument} cannot be blank.`);
    }
    // A space ends a filter value and a quote closes one, so either would let the rest of the value
    // be parsed as another filter; the engine answers an invalid regex with a silent zero.
    if (/[\s"']/.test(trimmed)) {
        throw new Error(`${argument} cannot contain spaces or quotes; use \\s or \\x22 in the pattern: "${pattern}".`);
    }
    return validateRe2(argument, trimmed);
}
// Several repo: filters are intersected; one alternation is the union an agent means by a list.
export function repoFilter(patterns) {
    if (!patterns || patterns.length === 0) {
        return undefined;
    }
    const validated = patterns.map((pattern) => validateRegex("repos", pattern));
    return validated.length === 1
        ? `repo:${validated[0]}`
        : `repo:${validated.map((pattern) => `(?:${pattern})`).join("|")}`;
}
export function rejectKeywordFilters(pattern) {
    const trimmed = pattern.trim();
    const unquoted = trimmed.replace(/"[^"]*"/g, " ");
    const filter = /(^|[\s(])(-?[A-Za-z_.]+):\S/.exec(unquoted);
    if (filter) {
        throw new Error(`pattern contains a filter "${filter[2]}:". Use the repos, path, and language arguments instead, or quote it to search for the text.`);
    }
    return trimmed;
}
// Sourcegraph names repositories host/path by default, so stripping a declared clone source's
// hostname leaves exactly what checkout_repo takes. Anything else is shown whole, never as a guessed
// source: a site can change the naming pattern, and a mirror's host says nothing about its kind.
export function mapRepository(name, cloneSources) {
    const [host, ...rest] = name.split("/");
    const source = cloneSources.find((candidate) => new URL(candidate.url).hostname.toLowerCase() === host?.toLowerCase());
    if (source && rest.length > 0) {
        return { group: { label: source.name, cloneSource: source.name }, repo: rest.join("/") };
    }
    return { group: { label: "not a declared source", cloneSource: undefined }, repo: name };
}
// Groups appear in order of their first, best-ranked result, and each keeps its own ranking.
export function groupInRankOrder(entries) {
    const order = [];
    for (const entry of entries) {
        if (!order.includes(entry.group.label)) {
            order.push(entry.group.label);
        }
    }
    return order.flatMap((label) => entries.filter((entry) => entry.group.label === label));
}
export function sourcegraphClients(instances, clients, instance) {
    const client = clients.get(instance.name);
    if (!client || !instances.includes(instance)) {
        throw new Error(`No Sourcegraph client for source "${instance.name}".`);
    }
    return client;
}
