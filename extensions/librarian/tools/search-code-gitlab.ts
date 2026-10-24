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
import { GitLabApiError, type GitLabBlobHit, type GitLabClient } from "../gitlab.ts";
import type { LibrarianSource, SearchSettings } from "../settings.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";
import {
  limitParameter,
  rejectUnsafeValue,
  resolveLimit,
  runRestSearch,
  selectInstance,
  sourceProperties,
} from "./shared.ts";

const GITLAB_MAX = 50;
// per_page=100 can stop at exactly 100 hits and report no next page, so pages stay below it.
const PAGE_SIZE = 50;
// Every page is one of 30 code searches a minute, so a search stops paging well short of that.
const MAX_PAGES = 4;
const MATCHED_LINES_SHOWN = 5;
const FILTER_WORDS = /(^|\s)-?(filename|path|extension|blob):/i;

export interface SearchCodeGitLabDetails {
  kind: "search_code_gitlab";
  source: string;
  unit: "files";
  matchCount: number;
  repoCount: number | undefined;
  fetchedCount: number;
  shownCount: number;
  complete: boolean | undefined;
  ranked: false;
  artifact: SearchArtifact;
  entries: ShownEntry[];
}

export interface GitLabCodeQuery {
  pattern: string;
  filename: string | undefined;
  path: string | undefined;
  extension: string | undefined;
}

export function buildGitLabCodeSearch(query: GitLabCodeQuery): string {
  if (query.pattern.trim().length < 2) {
    throw new Error(
      "pattern must be at least two characters; GitLab silently finds nothing for one.",
    );
  }
  if (FILTER_WORDS.test(query.pattern)) {
    throw new Error(
      "pattern contains a filter; use the filename, path, and extension arguments instead.",
    );
  }
  const parts = [query.pattern];
  if (query.filename) {
    parts.push(`filename:${rejectUnsafeValue("filename", query.filename)}`);
  }
  if (query.path) {
    parts.push(`path:${rejectUnsafeValue("path", query.path).replace(/^\/+|\/+$/g, "")}`);
  }
  if (query.extension) {
    // A leading dot never matches; GitLab answers it with a silent zero.
    parts.push(`extension:${rejectUnsafeValue("extension", query.extension).replace(/^\./, "")}`);
  }
  return parts.join(" ");
}

interface FileHits {
  projectId: number;
  path: string;
  ref: string;
  pathMatch: boolean;
  lines: { lineNumber: number; text: string }[];
}

// A chunk is the match plus two lines either side, and startline is the first context line, so
// the matching lines are found again inside it to number them.
export function matchingLines(
  hit: GitLabBlobHit,
  pattern: string,
): { lineNumber: number; text: string }[] {
  const needle = pattern.toLowerCase();
  return hit.data
    .split("\n")
    .map((text, offset) => ({ lineNumber: hit.startline + offset, text }))
    .filter((line) => line.text.toLowerCase().includes(needle));
}

function groupByFile(hits: GitLabBlobHit[], pattern: string): FileHits[] {
  const files = new Map<string, FileHits>();
  for (const hit of hits) {
    const key = `${hit.projectId}:${hit.path}`;
    const file = files.get(key) ?? {
      projectId: hit.projectId,
      path: hit.path,
      ref: hit.ref,
      pathMatch: false,
      lines: [],
    };
    if (hit.pathMatch) {
      file.pathMatch = true;
    } else {
      file.lines.push(...matchingLines(hit, pattern));
    }
    files.set(key, file);
  }
  return [...files.values()];
}

export function createSearchCodeGitLabTool(
  instances: LibrarianSource[],
  clients: Map<string, GitLabClient>,
  cacheDir: string,
  search: SearchSettings,
) {
  // Advanced search lets a search span projects; without it GitLab refuses anything wider than one.
  const projectOptional = instances.every((instance) => instance.advancedSearch);
  const projectDescription = projectOptional
    ? "Restrict to one project, e.g. platform/widget-sdk."
    : "Project path, e.g. platform/widget-sdk.";
  const Params = Type.Object({
    ...sourceProperties(instances, "Which GitLab to search"),
    pattern: Type.String({
      description:
        "Text to find, matched case-insensitively as one exact string — spaces and quotes included. No regex, and several words are a phrase, not separate terms. At least two characters.",
    }),
    project: projectOptional
      ? Type.Optional(Type.String({ description: projectDescription }))
      : Type.String({ description: projectDescription }),
    ref: Type.Optional(
      Type.String({ description: "Branch, tag, or commit. Default: the default branch." }),
    ),
    filename: Type.Optional(
      Type.String({ description: "File name, wildcards allowed, e.g. *_test.go." }),
    ),
    path: Type.Optional(
      Type.String({ description: "Directory within the project, e.g. internal/git." }),
    ),
    extension: Type.Optional(
      Type.String({ description: "File extension without the dot, e.g. go." }),
    ),
    limit: limitParameter(GITLAB_MAX, search.defaultLimit),
  });

  return defineTool<typeof Params, SearchCodeGitLabDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchCodeGitLab,
    label: "Search GitLab code",
    description: `Search the code of ${projectOptional ? "a GitLab instance" : "one GitLab project"} for an exact string. Results are unranked — files whose path matches come first, then matches in path order. Filters scan the whole project, which is slow on very large repositories. Limited to 30 searches a minute.`,
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(toolCallId, params, signal) {
      const instance = selectInstance(instances, params);
      const client = clients.get(instance.name);
      if (!client) {
        throw new Error(`No GitLab client for source "${instance.name}".`);
      }
      const searchText = buildGitLabCodeSearch({
        pattern: params.pattern,
        filename: params.filename,
        path: params.path,
        extension: params.extension,
      });
      const limit = resolveLimit(params.limit, search, GITLAB_MAX);
      const filtered = Boolean(params.filename || params.path || params.extension);
      const advice = filtered
        ? "filters scan the whole project; search without them, then read the files."
        : "use a rarer pattern, or narrow with path.";

      const { files, hasMore, total } = await runRestSearch(
        search,
        signal,
        advice,
        async (searchSignal) => {
          const project = params.project
            ? await client.resolveProject(params.project, searchSignal)
            : undefined;
          if (
            project &&
            params.ref &&
            !(await client.refExists(project.id, params.ref, searchSignal))
          ) {
            throw new Error(
              `Ref ${params.ref} does not exist in ${project.path}; there is nothing to search.`,
            );
          }
          const hits: GitLabBlobHit[] = [];
          let page = 1;
          let more = true;
          let lastTotal: number | undefined;
          while (more && page <= MAX_PAGES && groupByFile(hits, params.pattern).length < limit) {
            try {
              const result = await client.searchBlobs(
                project ? { projectId: project.id } : "instance",
                searchText,
                params.ref,
                page,
                PAGE_SIZE,
                searchSignal,
              );
              hits.push(...result.hits);
              more = result.hasNextPage;
              lastTotal = result.total;
            } catch (error) {
              if (
                error instanceof GitLabApiError &&
                /supported only with advanced search/.test(error.message)
              ) {
                throw new Error(
                  `${instance.name} searches one project at a time; name one with project. If it does have advanced search, advancedSearch is set wrongly for this source.`,
                );
              }
              throw error;
            }
            page += 1;
          }
          if (hits.length === 0 && project?.repositoryRestricted) {
            throw new Error(
              `${project.path}'s repository is restricted, so GitLab returns no code for it to this token. This is not an empty result.`,
            );
          }
          return { files: groupByFile(hits, params.pattern), hasMore: more, total: lastTotal };
        },
      );

      const projectPaths = new Map<number, string>();
      for (const projectId of new Set(files.map((file) => file.projectId))) {
        projectPaths.set(projectId, await client.projectPath(projectId, signal));
      }
      const shown = files.slice(0, limit);
      const entries: ShownEntry[] = shown.map((file) => {
        const lines = file.lines.slice(0, MATCHED_LINES_SHOWN);
        const detailLines = [
          ...(file.pathMatch ? ["(the path matches)"] : []),
          ...lines.map((line) => `${line.lineNumber}: ${clipLine(line.text)}`),
          ...(file.lines.length > lines.length
            ? [`… ${file.lines.length - lines.length} more matched lines`]
            : []),
        ];
        return {
          label: `${projectPaths.get(file.projectId) ?? file.projectId} — ${file.path}`,
          ...(detailLines.length > 0 ? { detail: detailLines.join("\n") } : {}),
        };
      });
      const artifact = await writeSearchArtifact(
        cacheDir,
        toolCallId,
        files.map((file) => ({
          source: instance.name,
          repo: projectPaths.get(file.projectId),
          path: file.path,
          ref: file.ref,
          pathMatch: file.pathMatch,
          lines: file.lines,
        })),
      );
      const repoCount = projectPaths.size;
      const found = hasMore
        ? `At least ${plural(files.length, "file")} across ${plural(repoCount, "repo")}${total === undefined ? "" : `, ${plural(total, "hit")} or more`}`
        : `${plural(files.length, "file")} across ${plural(repoCount, "repo")}`;
      const digest = formatDigest(
        {
          found: `${found}, unranked`,
          source: instance.name,
          complete: undefined,
          incompleteReason: undefined,
          fetchedCount: files.length,
          limitHit: hasMore,
          shownCount: entries.length,
          artifact,
        },
        entries,
      );

      return {
        content: [{ type: "text", text: digest }],
        details: {
          kind: "search_code_gitlab",
          source: instance.name,
          unit: "files",
          matchCount: files.length,
          repoCount,
          fetchedCount: files.length,
          shownCount: entries.length,
          complete: undefined,
          ranked: false,
          artifact,
          entries,
        },
      };
    },
  });
}
