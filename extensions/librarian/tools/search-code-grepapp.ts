import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  formatDigest,
  plural,
  type SearchArtifact,
  type ShownEntry,
  writeSearchArtifact,
} from "../delivery.ts";
import { type GrepCodeMatch, searchCodeGrep } from "../grep-app.ts";
import type { SearchSettings } from "../settings.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";
import { limitParameter, resolveLimit, runRestSearch } from "./shared.ts";

const GREP_APP_SOURCE = "grep.app";
// Unmeasured: the MCP server decides how many hits one call returns, and the tool does not page.
const GREP_APP_MAX = 50;

export interface SearchCodeGrepAppDetails {
  kind: "search_code_grepapp";
  source: string;
  unit: "files";
  matchCount: number;
  repoCount: number;
  fetchedCount: number;
  shownCount: number;
  complete: boolean | undefined;
  artifact: SearchArtifact;
  entries: ShownEntry[];
}

function matchDetail(match: GrepCodeMatch): string | undefined {
  const lines = match.snippets
    .slice(0, 2)
    .map((snippet) =>
      snippet.content
        .split("\n")
        .slice(0, 8)
        .map((line, offset) => `${snippet.lineNumber + offset}: ${line.trimEnd()}`)
        .join("\n"),
    )
    .join("\n…\n");
  return lines.length > 0 ? lines : undefined;
}

export function createSearchCodeGrepAppTool(cacheDir: string, search: SearchSettings) {
  const Params = Type.Object({
    pattern: Type.String({
      description:
        "Code to find, as it appears in files: e.g. `useState(` rather than `react hook state`.",
    }),
    regex: Type.Optional(
      Type.Boolean({
        description:
          "Treat pattern as a regular expression instead of literal text. Supports (?s) for multi-line patterns. Default: false.",
      }),
    ),
    repo: Type.Optional(
      Type.String({
        description:
          "Restrict to a repository or repository prefix, e.g. drizzle-team/drizzle-orm or vercel.",
      }),
    ),
    language: Type.Optional(
      Type.String({ description: "Restrict to a language, e.g. TypeScript." }),
    ),
    path: Type.Optional(
      Type.String({ description: "Restrict to file paths matching this pattern." }),
    ),
    limit: limitParameter(GREP_APP_MAX, search.defaultLimit),
  });

  return defineTool<typeof Params, SearchCodeGrepAppDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchCodeGrepApp,
    label: "Search public code",
    description:
      "Search public open-source code on GitHub by literal pattern or regex, through grep.app. Public code only; it reaches no private repository.",
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(toolCallId, params, signal) {
      const limit = resolveLimit(params.limit, search, GREP_APP_MAX);
      const result = await runRestSearch(
        search,
        signal,
        "add repo, language, or path.",
        (searchSignal) =>
          searchCodeGrep(
            {
              query: params.pattern,
              ...(params.regex ? { useRegexp: true } : {}),
              ...(params.repo ? { repo: params.repo } : {}),
              ...(params.language ? { language: [params.language] } : {}),
              ...(params.path ? { path: params.path } : {}),
            },
            searchSignal,
          ),
      );
      const matches = result.matches.slice(0, limit);
      const repoCount = new Set(matches.map((match) => match.repo)).size;
      const entries: ShownEntry[] = matches.map((match) => {
        const detail = matchDetail(match);
        return {
          label: `${match.repo} — ${match.path}`,
          ...(match.url ? { url: match.url } : {}),
          ...(detail ? { detail } : {}),
        };
      });
      const artifact = await writeSearchArtifact(
        cacheDir,
        toolCallId,
        matches.map((match) => ({ source: GREP_APP_SOURCE, ...match })),
      );

      return {
        content: [
          {
            type: "text",
            text: formatDigest(
              {
                found: `${plural(matches.length, "file")} across ${plural(repoCount, "repo")}`,
                source: GREP_APP_SOURCE,
                complete: undefined,
                incompleteReason: undefined,
                fetchedCount: matches.length,
                limitHit: result.matches.length > limit,
                shownCount: entries.length,
                artifact,
              },
              entries,
            ),
          },
        ],
        details: {
          kind: "search_code_grepapp",
          source: GREP_APP_SOURCE,
          unit: "files",
          matchCount: matches.length,
          repoCount,
          fetchedCount: matches.length,
          shownCount: entries.length,
          complete: undefined,
          artifact,
          entries,
        },
      };
    },
  });
}
