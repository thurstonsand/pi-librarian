import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  formatCount,
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
  validateIsoDate,
} from "./shared.ts";
import {
  type GroupedEntry,
  groupInRankOrder,
  mapRepository,
  runSourcegraphSearch,
  sourcegraphClients,
  validateRegex,
} from "./sourcegraph-search.ts";

const SOURCEGRAPH_MAX = 50;
// A repository list is about 200 bytes a repository, so fetching the whole list beats paging.
const REPO_RESULT_LIMIT = 5000;
// has.commit.after walks git history at about 10 ms a repository, so 15 seconds covers about
// 1,200; counting the scope first costs under a second.
const HISTORY_SCOPE_LIMIT = 1000;

export interface SearchReposSourcegraphDetails {
  kind: "search_repos_sourcegraph";
  source: string;
  matchCount: number;
  fetchedCount: number;
  shownCount: number;
  complete: boolean;
  incompleteReason: string | undefined;
  artifact: SearchArtifact;
  entries: ShownEntry[];
}

export interface SourcegraphRepoQuery {
  name: string | undefined;
  topics: string[];
  containsPath: string | undefined;
  changedAfter: string | undefined;
  includeForks: boolean;
  includeArchived: boolean;
}

export function buildSourcegraphRepoQuery(query: SourcegraphRepoQuery, count: number): string {
  const parts = ["type:repo", `count:${count}`];
  if (query.name) {
    parts.push(`repo:${validateRegex("name", query.name)}`);
  }
  for (const topic of query.topics) {
    parts.push(`repo:has.topic(${rejectUnsafeValue("topics", topic)})`);
  }
  if (query.containsPath) {
    parts.push(`repo:has.path(${validateRegex("contains_path", query.containsPath)})`);
  }
  if (query.changedAfter) {
    parts.push(`repo:has.commit.after(${validateIsoDate("changed_after", query.changedAfter)})`);
  }
  if (query.includeForks) {
    parts.push("fork:yes");
  }
  if (query.includeArchived) {
    parts.push("archived:yes");
  }
  return parts.join(" ");
}

export function createSearchReposSourcegraphTool(
  instances: LibrarianSource[],
  clients: Map<string, SourcegraphClient>,
  cloneSources: LibrarianSource[],
  cacheDir: string,
  search: SearchSettings,
) {
  const Params = Type.Object({
    ...sourceProperties(instances, "Which Sourcegraph to search"),
    name: Type.Optional(
      Type.String({ description: "RE2 pattern matched against repository names." }),
    ),
    topics: Type.Optional(
      Type.Array(Type.String(), {
        description: "Only repos with every one of these topics.",
        maxItems: 10,
      }),
    ),
    contains_path: Type.Optional(
      Type.String({
        description: "Only repos with a file whose path matches this RE2 pattern, e.g. ^go\\.mod$.",
      }),
    ),
    changed_after: Type.Optional(
      Type.String({
        description:
          "Only repos with a commit after this date, YYYY-MM-DD. Walks git history, about 10 ms per repository in scope, so it is refused above about 1,000 repositories — narrow with name first.",
      }),
    ),
    include_forks: Type.Optional(Type.Boolean({ description: "Include forks. Default: false." })),
    include_archived: Type.Optional(
      Type.Boolean({ description: "Include archived repos. Default: false." }),
    ),
    limit: limitParameter(SOURCEGRAPH_MAX, search.defaultLimit),
  });

  return defineTool<typeof Params, SearchReposSourcegraphDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchReposSourcegraph,
    label: "Search Sourcegraph repos",
    description:
      "Find repositories the Sourcegraph instance indexes by name, topic, a file they contain, or recent commits. Answers what a repository is; to find repositories containing some code, search code with detail repos instead. Results are unordered.",
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(toolCallId, params, signal) {
      const instance = selectInstance(instances, params);
      const client = sourcegraphClients(instances, clients, instance);
      const repoQuery: SourcegraphRepoQuery = {
        name: params.name,
        topics: params.topics ?? [],
        containsPath: params.contains_path,
        changedAfter: params.changed_after,
        includeForks: params.include_forks ?? false,
        includeArchived: params.include_archived ?? false,
      };
      const query = buildSourcegraphRepoQuery(repoQuery, REPO_RESULT_LIMIT);
      const limit = resolveLimit(params.limit, search, SOURCEGRAPH_MAX);

      if (repoQuery.changedAfter) {
        const scope = await runSourcegraphSearch({
          client,
          search,
          signal,
          query: buildSourcegraphRepoQuery(
            { ...repoQuery, changedAfter: undefined },
            HISTORY_SCOPE_LIMIT + 1,
          ),
          patternType: "standard",
          describeFound: (partial) => plural(partial.matches.length, "repo"),
          advice: "narrow name.",
        });
        const inScope = scope.result.matches.length;
        if (inScope > HISTORY_SCOPE_LIMIT) {
          throw new Error(
            `changed_after covers more than ${formatCount(HISTORY_SCOPE_LIMIT)} repositories, which takes longer than the search budget; narrow with name first.`,
          );
        }
      }

      const outcome = await runSourcegraphSearch({
        client,
        search,
        signal,
        query,
        patternType: "standard",
        describeFound: (partial) => plural(partial.matches.length, "repo"),
        advice: "narrow name, or drop changed_after.",
      });
      const repos = outcome.result.matches.filter((match) => match.type === "repo");
      const ranked: GroupedEntry[] = repos.map((match) => {
        const mapped = mapRepository(match.repository, cloneSources);
        const flags = [...(match.fork ? ["fork"] : []), ...(match.archived ? ["archived"] : [])];
        return {
          group: mapped.group,
          label: mapped.repo,
          ...(flags.length > 0 ? { meta: flags.join(" · ") } : {}),
          ...(match.description ? { detail: match.description } : {}),
        };
      });
      const entries = groupInRankOrder(ranked.slice(0, limit));
      const artifact = await writeSearchArtifact(
        cacheDir,
        toolCallId,
        repos.map((match) => {
          const mapped = mapRepository(match.repository, cloneSources);
          return {
            instance: instance.name,
            repository: match.repository,
            source: mapped.group.cloneSource ?? null,
            repo: mapped.repo,
            ...(match.description ? { description: match.description } : {}),
            fork: match.fork,
            archived: match.archived,
          };
        }),
      );

      return {
        content: [
          {
            type: "text",
            text: formatDigest(
              {
                found: `${plural(repos.length, "repository", "repositories")} match`,
                source: instance.name,
                complete: outcome.complete,
                incompleteReason: outcome.incompleteReason,
                fetchedCount: repos.length,
                limitHit: false,
                shownCount: entries.length,
                artifact,
              },
              entries,
            ),
          },
        ],
        details: {
          kind: "search_repos_sourcegraph",
          source: instance.name,
          matchCount: repos.length,
          fetchedCount: repos.length,
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
