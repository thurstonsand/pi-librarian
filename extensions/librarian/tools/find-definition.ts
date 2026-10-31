import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  formatDigest,
  plural,
  type SearchArtifact,
  type ShownEntry,
  writeSearchArtifact,
} from "../delivery.ts";
import type { LibrarianSource, SearchSettings } from "../settings.ts";
import type { SourcegraphClient } from "../sourcegraph.ts";
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
  repoFilter,
  runSourcegraphSearch,
  sourcegraphClients,
} from "./sourcegraph-search.ts";

const SOURCEGRAPH_MAX = 50;
const SYMBOL_RESULT_LIMIT = 1000;
// The select:symbol kinds the instance accepts; "type" is not one of them.
const SYMBOL_KINDS = [
  "function",
  "method",
  "class",
  "struct",
  "interface",
  "enum",
  "variable",
  "constant",
  "field",
  "property",
] as const;

export interface FindDefinitionDetails {
  kind: "find_definition";
  source: string;
  symbol: string;
  matchCount: number;
  fetchedCount: number;
  shownCount: number;
  complete: boolean;
  incompleteReason: string | undefined;
  artifact: SearchArtifact;
  entries: ShownEntry[];
}

function escapeRegex(text: string): string {
  return text.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&");
}

export interface DefinitionQuery {
  symbol: string;
  kind: string | undefined;
  repos: string[] | undefined;
  language: string | undefined;
  includeVendored: boolean;
}

export function buildDefinitionQuery(query: DefinitionQuery): string {
  const symbol = rejectUnsafeValue("symbol", query.symbol);
  const parts = ["type:symbol", `count:${SYMBOL_RESULT_LIMIT}`];
  if (query.kind) {
    parts.push(`select:symbol.${query.kind}`);
  }
  const repos = repoFilter(query.repos);
  if (repos) {
    parts.push(repos);
  }
  if (query.language) {
    parts.push(`lang:${rejectUnsafeValue("language", query.language)}`);
  }
  if (!query.includeVendored) {
    parts.push("-file:(^|/)vendor/");
  }
  parts.push(`/^${escapeRegex(symbol)}$/`);
  return parts.join(" ");
}

export function createFindDefinitionTool(
  instances: LibrarianSource[],
  clients: Map<string, SourcegraphClient>,
  cloneSources: LibrarianSource[],
  cacheDir: string,
  search: SearchSettings,
) {
  const Params = Type.Object({
    ...sourceProperties(instances, "Which Sourcegraph to search"),
    symbol: Type.String({ description: "Exact symbol name, e.g. NewClient." }),
    kind: Type.Optional(
      StringEnum(SYMBOL_KINDS, {
        description:
          "Only definitions of this kind. Kinds are exact: `function` excludes `method` (Go receivers, Java members), `class` excludes `struct`. Omit unless the name is ambiguous.",
      }),
    ),
    repos: Type.Optional(
      Type.Array(Type.String(), {
        description: "Restrict to repositories matching these RE2 patterns.",
        maxItems: 20,
      }),
    ),
    language: Type.Optional(Type.String({ description: "Restrict to a language, e.g. go." })),
    include_vendored: Type.Optional(
      Type.Boolean({ description: "Include copies under vendor/ directories. Default: false." }),
    ),
    limit: limitParameter(SOURCEGRAPH_MAX, search.defaultLimit),
  });

  return defineTool<typeof Params, FindDefinitionDetails>({
    name: LIBRARIAN_TOOL_NAMES.findDefinition,
    label: "Find definition",
    description:
      "Locate where a symbol is defined, by exact name, across every repository the Sourcegraph instance indexes. Returns definition sites with 1-based line numbers; a miss can mean the language or repository is not indexed for symbols.",
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(toolCallId, params, signal) {
      const instance = selectInstance(instances, params);
      const client = sourcegraphClients(instances, clients, instance);
      const query = buildDefinitionQuery({
        symbol: params.symbol,
        kind: params.kind,
        repos: params.repos,
        language: params.language,
        includeVendored: params.include_vendored ?? false,
      });
      const limit = resolveLimit(params.limit, search, SOURCEGRAPH_MAX);

      const outcome = await runSourcegraphSearch({
        client,
        search,
        signal,
        query,
        patternType: "standard",
        describeFound: (partial) => plural(partial.matches.length, "definition"),
        advice: "restrict repos or language, or set kind.",
      });
      const definitions = outcome.result.matches.flatMap((match) =>
        match.symbols.map((symbol) => ({ match, symbol })),
      );
      const ranked: GroupedEntry[] = definitions.map(({ match, symbol }) => {
        const mapped = mapRepository(match.repository, cloneSources);
        return {
          group: mapped.group,
          label: `${mapped.repo} — ${match.path ?? ""}:${symbol.line}`,
          ...(match.commit ? { revision: match.commit.slice(0, 7) } : {}),
          meta: `${symbol.kind.toLowerCase()}${symbol.containerName ? ` in ${symbol.containerName}` : ""}`,
        };
      });
      const entries = groupInRankOrder(ranked.slice(0, limit));
      const artifact = await writeSearchArtifact(
        cacheDir,
        toolCallId,
        definitions.map(({ match, symbol }) => {
          const mapped = mapRepository(match.repository, cloneSources);
          return {
            instance: instance.name,
            repository: match.repository,
            source: mapped.group.cloneSource ?? null,
            repo: mapped.repo,
            path: match.path,
            line: symbol.line,
            ...(match.commit ? { commit: match.commit } : {}),
            name: symbol.name,
            kind: symbol.kind,
            ...(symbol.containerName ? { container: symbol.containerName } : {}),
          };
        }),
      );

      return {
        content: [
          {
            type: "text",
            text: formatDigest(
              {
                found: `${plural(definitions.length, "definition")} of ${params.symbol}`,
                source: instance.name,
                complete: outcome.complete,
                incompleteReason: outcome.incompleteReason,
                fetchedCount: definitions.length,
                limitHit: false,
                shownCount: entries.length,
                artifact,
              },
              entries,
            ),
          },
        ],
        details: {
          kind: "find_definition",
          source: instance.name,
          symbol: params.symbol,
          matchCount: definitions.length,
          fetchedCount: definitions.length,
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
