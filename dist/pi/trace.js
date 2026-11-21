import { formatCount, plural } from "../core/delivery.js";
import { REPO_TOOL_NAMES } from "../core/tools/names.js";
export function asRepoToolDetails(details) {
    if (details &&
        typeof details === "object" &&
        "kind" in details &&
        typeof details.kind === "string" &&
        REPO_TOOL_NAMES.includes(details.kind)) {
        return details;
    }
    return undefined;
}
function summarizeCodeSearch(details, ranked) {
    const repos = details.unit === "repos" || details.repoCount === undefined
        ? ""
        : ` · ${plural(details.repoCount, "repo")}`;
    const flags = [
        ...(details.complete === false ? ["incomplete"] : []),
        ...(ranked ? [] : ["unranked"]),
    ];
    const singular = { repos: "repo", files: "file", matches: "match" }[details.unit];
    const count = details.atLeast
        ? `${formatCount(details.matchCount)}+ ${details.unit}`
        : plural(details.matchCount, singular, details.unit);
    return `${count}${repos}${flags.length > 0 ? `, ${flags.join(", ")}` : ""}`;
}
function summarizeRepoSearch(details) {
    const count = details.fetchedCount < details.matchCount
        ? `${formatCount(details.fetchedCount)} of ${formatCount(details.matchCount)} repos`
        : plural(details.matchCount, "repo");
    return details.complete === false ? `${count}, incomplete` : count;
}
export function summarizeRepoToolDetails(details) {
    switch (details.kind) {
        case "search_code_github":
        case "search_code_grepapp":
        case "search_code_sourcegraph":
        case "search_code_bitbucket":
            return summarizeCodeSearch(details, true);
        case "search_code_gitlab":
            return summarizeCodeSearch(details, details.ranked);
        case "search_repos_gitlab":
        case "search_repos_bitbucket":
        case "search_repos_github":
        case "search_repos_sourcegraph":
            return summarizeRepoSearch(details);
        case "find_definition": {
            const count = plural(details.matchCount, "definition");
            return details.complete ? count : `${count}, incomplete`;
        }
        case "read_file":
            return undefined;
        case "checkout_repo":
            return `${details.fileCount} files @ ${details.headSha.slice(0, 7)}`;
        case "provide_results":
            return plural(details.locationCount, "location");
    }
}
function summarizeWebDetails(details) {
    if (!details || typeof details !== "object" || !("kind" in details)) {
        return undefined;
    }
    switch (details.kind) {
        case "web_fetch": {
            const fetched = details;
            const documents = plural(fetched.count, "document");
            return fetched.failed.length > 0
                ? `${documents}, ${fetched.failed.length} failed`
                : documents;
        }
        case "web_search":
            return plural(details.count, "result");
        default:
            return undefined;
    }
}
export function summarizeToolResult(result, isError) {
    if (!result || typeof result !== "object") {
        return undefined;
    }
    const firstText = result.content?.find((part) => part.type === "text" && "text" in part && typeof part.text === "string")?.text;
    if (isError) {
        return firstText?.split("\n")[0]?.slice(0, 120);
    }
    const details = asRepoToolDetails(result.details);
    if (details) {
        return summarizeRepoToolDetails(details);
    }
    const web = summarizeWebDetails(result.details);
    if (web !== undefined) {
        return web;
    }
    if (firstText !== undefined) {
        const lineCount = firstText.length === 0 ? 0 : firstText.split("\n").length;
        return `${lineCount} lines`;
    }
    return undefined;
}
