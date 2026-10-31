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
import type { GitLabClient, GitLabProjectHit } from "../gitlab.ts";
import type { LibrarianSource, SearchSettings } from "../settings.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";
import {
  limitParameter,
  rejectUnsafeValue,
  resolveLimit,
  runRestSearch,
  selectInstance,
  sourceProperties,
  validateIsoDate,
} from "./shared.ts";

const GITLAB_MAX = 50;
type Sort = "activity" | "stars" | "updated" | "created" | "name";
const SORTS: Sort[] = ["activity", "stars", "updated", "created", "name"];

// GitLab sorts descending for every order unless told otherwise, so name order is spelled out.
const ORDERING: Record<Sort, { order_by: string; sort: "asc" | "desc" }> = {
  activity: { order_by: "last_activity_at", sort: "desc" },
  stars: { order_by: "star_count", sort: "desc" },
  updated: { order_by: "updated_at", sort: "desc" },
  created: { order_by: "created_at", sort: "desc" },
  name: { order_by: "path", sort: "asc" },
};

export interface SearchReposGitLabDetails {
  kind: "search_repos_gitlab";
  source: string;
  matchCount: number;
  fetchedCount: number;
  shownCount: number;
  complete: boolean | undefined;
  artifact: SearchArtifact;
  entries: ShownEntry[];
}

export interface GitLabRepoQuery {
  name: string | undefined;
  topics: string[];
  changedAfter: string | undefined;
  includeArchived: boolean;
  sort: Sort;
  limit: number;
}

export function buildGitLabProjectSearch(
  query: GitLabRepoQuery,
): Record<string, string | undefined> {
  const ordering = ORDERING[query.sort];
  return {
    search: query.name?.trim() || undefined,
    // Needed for a group path like platform/widget, and harmful otherwise: it turns off the
    // exact-name match GitLab falls back to when every word is under three characters.
    search_namespaces: query.name?.includes("/") ? "true" : undefined,
    simple: "true",
    // Archived projects are included when the parameter is absent.
    archived: query.includeArchived ? undefined : "false",
    topic:
      query.topics.length > 0
        ? query.topics.map((topic) => rejectUnsafeValue("topics", topic)).join(",")
        : undefined,
    // GitLab accepts 10/01/2026 and reads it as 10 January, so the date is checked here.
    last_activity_after: query.changedAfter
      ? `${validateIsoDate("changed_after", query.changedAfter)}T00:00:00Z`
      : undefined,
    order_by: ordering.order_by,
    sort: ordering.sort,
    per_page: String(query.limit),
  };
}

function projectMeta(hit: GitLabProjectHit): string | undefined {
  const meta = [
    ...(hit.stars === undefined ? [] : [`★${hit.stars}`]),
    ...(hit.lastActivityAt ? [`last active ${hit.lastActivityAt.slice(0, 10)}`] : []),
  ];
  return meta.length > 0 ? meta.join(" · ") : undefined;
}

export function createSearchReposGitLabTool(
  instances: LibrarianSource[],
  clients: Map<string, GitLabClient>,
  cacheDir: string,
  search: SearchSettings,
) {
  const Params = Type.Object({
    ...sourceProperties(instances, "Which GitLab to search"),
    name: Type.Optional(
      Type.String({
        description:
          "Text matched against project path, name, group path, or description. Every word must appear in the same one of those; words under three characters are ignored.",
      }),
    ),
    topics: Type.Optional(
      Type.Array(Type.String(), {
        description: "Only projects with every one of these topics, exact and case-sensitive.",
        maxItems: 10,
      }),
    ),
    changed_after: Type.Optional(
      Type.String({ description: "Only projects with activity after this date, YYYY-MM-DD." }),
    ),
    include_archived: Type.Optional(
      Type.Boolean({ description: "Include archived projects. Default: false." }),
    ),
    sort: Type.Optional(
      StringEnum(SORTS, {
        description: "Ordering. Default: activity, most recently active first.",
      }),
    ),
    limit: limitParameter(GITLAB_MAX, search.defaultLimit),
  });

  return defineTool<typeof Params, SearchReposGitLabDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchReposGitLab,
    label: "Search GitLab projects",
    description:
      "Find GitLab projects by name, group, description, topic, and recent activity. Returns projects with their stars and last activity.",
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(toolCallId, params, signal) {
      const instance = selectInstance(instances, params);
      const client = clients.get(instance.name);
      if (!client) {
        throw new Error(`No GitLab client for source "${instance.name}".`);
      }
      const limit = resolveLimit(params.limit, search, GITLAB_MAX);
      const query = buildGitLabProjectSearch({
        name: params.name,
        topics: params.topics ?? [],
        changedAfter: params.changed_after,
        includeArchived: params.include_archived ?? false,
        sort: params.sort ?? "activity",
        limit,
      });
      await client.authorize();
      const result = await runRestSearch(
        search,
        signal,
        "add topics, or a more distinctive name.",
        (searchSignal) => client.searchProjects(query, searchSignal),
      );

      const entries: ShownEntry[] = result.hits.map((hit) => {
        const meta = projectMeta(hit);
        return {
          label: hit.path,
          url: hit.url,
          ...(meta ? { meta } : {}),
          ...(hit.description ? { detail: hit.description } : {}),
        };
      });
      const artifact = await writeSearchArtifact(
        cacheDir,
        toolCallId,
        result.hits.map((hit) => ({ source: instance.name, ...hit })),
      );
      const matchCount = result.total ?? result.hits.length;

      return {
        content: [
          {
            type: "text",
            text: formatDigest(
              {
                found: `${result.total === undefined ? "At least " : ""}${plural(matchCount, "project")} match`,
                source: instance.name,
                complete: undefined,
                incompleteReason: undefined,
                fetchedCount: result.hits.length,
                limitHit: result.hits.length < matchCount,
                shownCount: entries.length,
                artifact,
              },
              entries,
            ),
          },
        ],
        details: {
          kind: "search_repos_gitlab",
          source: instance.name,
          matchCount,
          fetchedCount: result.hits.length,
          shownCount: entries.length,
          complete: undefined,
          artifact,
          entries,
        },
      };
    },
  });
}
