import fs from "node:fs/promises";
import path from "node:path";
import type { TraceCall } from "./run.ts";
import { isCodeSearchTool, isRepoSearchTool, LIBRARIAN_TOOL_NAMES } from "./tools/names.ts";

// How runs use search digests, logged so the default result count can be set from evidence: a run
// that keeps reading results.jsonl or re-asking with a higher limit was shown too few.
export interface SearchUsage {
  searches: number;
  artifactReads: number;
  repeatedSearches: number;
}

function isSearch(name: string): boolean {
  return (
    isCodeSearchTool(name) || isRepoSearchTool(name) || name === LIBRARIAN_TOOL_NAMES.findDefinition
  );
}

function withoutLimit(args: unknown): string {
  if (!args || typeof args !== "object") {
    return JSON.stringify(args);
  }
  const { limit: _limit, ...rest } = args as Record<string, unknown>;
  return JSON.stringify(rest, Object.keys(rest).sort());
}

export function summarizeSearchUsage(trace: TraceCall[], cacheDir: string): SearchUsage {
  const searchesRoot = path.join(cacheDir, "searches");
  const seen = new Set<string>();
  const usage: SearchUsage = { searches: 0, artifactReads: 0, repeatedSearches: 0 };
  for (const call of trace) {
    if (isSearch(call.name)) {
      usage.searches += 1;
      const key = `${call.name}:${withoutLimit(call.args)}`;
      if (seen.has(key)) {
        usage.repeatedSearches += 1;
      }
      seen.add(key);
    } else if (JSON.stringify(call.args ?? "").includes(searchesRoot)) {
      usage.artifactReads += 1;
    }
  }
  return usage;
}

export async function appendSearchUsage(
  cacheDir: string,
  runId: string,
  trace: TraceCall[],
): Promise<void> {
  const usage = summarizeSearchUsage(trace, cacheDir);
  if (usage.searches === 0) {
    return;
  }
  await fs.appendFile(
    path.join(cacheDir, "usage.jsonl"),
    `${JSON.stringify({ runId, endedAt: new Date().toISOString(), ...usage })}\n`,
  );
}
