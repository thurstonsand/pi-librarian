import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  clipLine,
  formatDigest,
  plural,
  type SearchArtifact,
  type ShownEntry,
  writeSearchArtifact,
} from "../delivery.ts";
import type { LibrarianSource, SearchSettings } from "../settings.ts";
import type { SourcegraphClient, StreamResult } from "../sourcegraph.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";
import {
  limitParameter,
  rejectUnsafeValue,
  resolveLimit,
  selectInstance,
  sourceProperties,
} from "./shared.ts";
import {
  type GroupedEntry,
  groupInRankOrder,
  mapRepository,
  rejectKeywordFilters,
  repoFilter,
  runSourcegraphSearch,
  sourcegraphClients,
  validateRegex,
} from "./sourcegraph-search.ts";

const SOURCEGRAPH_MAX = 50;
const MATCHED_LINES_SHOWN = 5;
type Detail = "repos" | "files" | "matches";
type PatternType = "literal" | "keyword" | "regexp";

// count: counts the unit select: projects to, so each detail level gets its own result limit:
// repositories are cheap enough to list instance-wide, matched ranges pile up fastest.
const RESULT_LIMIT: Record<Detail, number> = { repos: 5000, files: 1000, matches: 2000 };

export interface SearchCodeSourcegraphDetails {
  kind: "search_code_sourcegraph";
  source: string;
  unit: Detail;
  matchCount: number;
  repoCount: number | undefined;
  fetchedCount: number;
  shownCount: number;
  complete: boolean;
  incompleteReason: string | undefined;
  artifact: SearchArtifact;
  entries: ShownEntry[];
}

// The query parser is a trap — whitespace becomes .*? under regexp, and/or/not are operators in
// every mode — so agent text only ever reaches it in the two forms parsed atomically.
export function encodeSourcegraphPattern(pattern: string, patternType: PatternType): string {
  switch (patternType) {
    case "literal": {
      if (pattern.length === 0) {
        throw new Error("pattern cannot be empty.");
      }
      return `content:"${pattern.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
    }
    case "regexp": {
      try {
        new RegExp(pattern);
      } catch (error) {
        throw new Error(
          `pattern is not a valid regular expression: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      return `/${pattern.replace(/\//g, "\\/")}/`;
    }
    case "keyword":
      return rejectKeywordFilters(pattern);
  }
}

export interface SourcegraphCodeQuery {
  pattern: string;
  patternType: PatternType;
  detail: Detail;
  repos: string[] | undefined;
  path: string | undefined;
  language: string | undefined;
}

export function buildSourcegraphCodeQuery(query: SourcegraphCodeQuery): string {
  const parts = ["type:file", `count:${RESULT_LIMIT[query.detail]}`];
  if (query.detail === "repos") {
    parts.push("select:repo");
  } else if (query.detail === "files") {
    parts.push("select:file");
  }
  const repos = repoFilter(query.repos);
  if (repos) {
    parts.push(repos);
  }
  if (query.path) {
    parts.push(`file:${validateRegex("path", query.path)}`);
  }
  if (query.language) {
    parts.push(`lang:${rejectUnsafeValue("language", query.language)}`);
  }
  parts.push(encodeSourcegraphPattern(query.pattern, query.patternType));
  return parts.join(" ");
}

function found(detail: Detail, result: StreamResult): string {
  const { matchCount, repositoriesCount } = result.progress;
  switch (detail) {
    case "repos":
      return plural(matchCount, "repo");
    case "files":
      return `${plural(matchCount, "file")} across ${plural(repositoriesCount, "repo")}`;
    case "matches":
      return `${plural(matchCount, "match", "matches")} in ${plural(result.matches.length, "file")} across ${plural(repositoriesCount, "repo")}`;
  }
}

export function createSearchCodeSourcegraphTool(
  instances: LibrarianSource[],
  clients: Map<string, SourcegraphClient>,
  cloneSources: LibrarianSource[],
  cacheDir: string,
  search: SearchSettings,
) {
  const Params = Type.Object({
    ...sourceProperties(instances, "Which Sourcegraph to search"),
    pattern: Type.String({ description: "Code to find, as it appears in files." }),
    pattern_type: Type.Optional(
      StringEnum(["literal", "keyword", "regexp"] as const, {
        description:
          "How to read the pattern. literal: the exact text, spaces and punctuation included. keyword: every term somewhere in the same file, any order, matching substrings; quote a phrase to keep it together, join alternatives with OR, exclude with NOT — a leading - is searched as text. regexp: RE2, matched within one line. Default: literal.",
      }),
    ),
    detail: Type.Optional(
      StringEnum(["repos", "files", "matches"] as const, {
        description:
          "What each result is: a repository, a file, or a file with its matched lines — and so what the result limit counts. repos stays complete across the whole instance; files and matches may hit the limit on a broad pattern. Default: files.",
      }),
    ),
    repos: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Restrict to repositories whose names match these RE2 patterns, e.g. ^git\\.example\\.com/PROJ/. The only filter that makes a search faster.",
        maxItems: 20,
      }),
    ),
    path: Type.Optional(
      Type.String({ description: "Restrict to file paths matching this RE2 pattern." }),
    ),
    language: Type.Optional(Type.String({ description: "Restrict to a language, e.g. go." })),
    limit: limitParameter(SOURCEGRAPH_MAX, search.defaultLimit),
  });

  return defineTool<typeof Params, SearchCodeSourcegraphDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchCodeSourcegraph,
    label: "Search code across repos",
    description:
      "Search code across every repository the Sourcegraph instance indexes, and report whether the search covered them all. Results are ranked across repositories; line numbers are from the indexed commit.",
    promptGuidelines: [
      "To find callers of a symbol across repositories with search_code_sourcegraph, search the name as a regexp with word boundaries, e.g. \\bNewClient\\b.",
    ],
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(toolCallId, params, signal) {
      const instance = selectInstance(instances, params);
      const client = sourcegraphClients(instances, clients, instance);
      const detail = params.detail ?? "files";
      const patternType = params.pattern_type ?? "literal";
      const query = buildSourcegraphCodeQuery({
        pattern: params.pattern,
        patternType,
        detail,
        repos: params.repos,
        path: params.path,
        language: params.language,
      });
      const limit = resolveLimit(params.limit, search, SOURCEGRAPH_MAX);

      const outcome = await runSourcegraphSearch({
        client,
        search,
        signal,
        query,
        patternType: patternType === "keyword" ? "keyword" : "standard",
        describeFound: (partial) => found(detail, partial),
        advice: "restrict repos, add a path or language, or ask for detail repos.",
      });

      const units = outcome.result.matches.filter((match) =>
        detail === "repos"
          ? match.type === "repo"
          : match.type === "content" || match.type === "path",
      );
      const ranked = units.map((match) => {
        const mapped = mapRepository(match.repository, cloneSources);
        const lines = match.lines.slice(0, MATCHED_LINES_SHOWN);
        const entry: GroupedEntry = {
          group: mapped.group,
          label: detail === "repos" ? mapped.repo : `${mapped.repo} — ${match.path ?? ""}`,
          ...(detail !== "repos" && match.commit ? { revision: match.commit.slice(0, 7) } : {}),
          ...(detail === "matches" && lines.length > 0
            ? {
                detail: [
                  ...lines.map((line) => `${line.lineNumber}: ${clipLine(line.text)}`),
                  ...(match.lines.length > lines.length
                    ? [`… ${match.lines.length - lines.length} more matched lines`]
                    : []),
                ].join("\n"),
              }
            : {}),
        };
        return entry;
      });
      const entries = groupInRankOrder(ranked.slice(0, limit));
      const artifact = await writeSearchArtifact(
        cacheDir,
        toolCallId,
        units.map((match) => {
          const mapped = mapRepository(match.repository, cloneSources);
          return {
            instance: instance.name,
            repository: match.repository,
            source: mapped.group.cloneSource ?? null,
            repo: mapped.repo,
            ...(match.path ? { path: match.path } : {}),
            ...(match.commit ? { commit: match.commit } : {}),
            ...(match.lines.length > 0 ? { lines: match.lines } : {}),
          };
        }),
      );
      const warnings = outcome.warnings.map((warning) => `Warning: ${warning}`);
      const digest = formatDigest(
        {
          found: found(detail, outcome.result),
          source: instance.name,
          complete: outcome.complete,
          incompleteReason: outcome.incompleteReason,
          fetchedCount: units.length,
          limitHit: false,
          shownCount: entries.length,
          artifact,
        },
        entries,
      );

      return {
        content: [{ type: "text", text: [digest, ...warnings].join("\n\n") }],
        details: {
          kind: "search_code_sourcegraph",
          source: instance.name,
          unit: detail,
          matchCount: outcome.result.progress.matchCount,
          repoCount: detail === "repos" ? undefined : outcome.result.progress.repositoriesCount,
          fetchedCount: units.length,
          shownCount: entries.length,
          complete: outcome.complete,
          incompleteReason: outcome.incompleteReason,
          artifact,
          entries,
        },
      };
    },
  });
}
