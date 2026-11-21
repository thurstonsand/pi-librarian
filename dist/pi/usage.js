import fs from "node:fs/promises";
import path from "node:path";
import { isCodeSearchTool, isRepoSearchTool, LIBRARIAN_TOOL_NAMES } from "../core/tools/names.js";
function isSearch(name) {
    return (isCodeSearchTool(name) || isRepoSearchTool(name) || name === LIBRARIAN_TOOL_NAMES.findDefinition);
}
function withoutLimit(args) {
    if (!args || typeof args !== "object") {
        return JSON.stringify(args);
    }
    const { limit: _limit, ...rest } = args;
    return JSON.stringify(rest, Object.keys(rest).sort());
}
export function summarizeSearchUsage(trace, cacheDir) {
    const searchesRoot = path.join(cacheDir, "searches");
    const seen = new Set();
    const usage = { searches: 0, artifactReads: 0, repeatedSearches: 0 };
    for (const call of trace) {
        if (isSearch(call.name)) {
            usage.searches += 1;
            const key = `${call.name}:${withoutLimit(call.args)}`;
            if (seen.has(key)) {
                usage.repeatedSearches += 1;
            }
            seen.add(key);
        }
        else if (JSON.stringify(call.args ?? "").includes(searchesRoot)) {
            usage.artifactReads += 1;
        }
    }
    return usage;
}
export async function appendSearchUsage(cacheDir, runId, trace) {
    const usage = summarizeSearchUsage(trace, cacheDir);
    if (usage.searches === 0) {
        return;
    }
    await fs.appendFile(path.join(cacheDir, "usage.jsonl"), `${JSON.stringify({ runId, endedAt: new Date().toISOString(), ...usage })}\n`);
}
