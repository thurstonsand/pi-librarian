import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { BitbucketApiError, type BitbucketClient } from "../bitbucket.ts";
import {
  clipLine,
  formatCount,
  formatDigest,
  plural,
  type SearchArtifact,
  type ShownEntry,
  writeSearchArtifact,
} from "../delivery.ts";
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

const BITBUCKET_MAX = 50;
// The server stops counting at 10,000; past that the number is a floor.
const COUNT_CAP = 10_000;
const MATCHED_LINES_SHOWN = 5;

export interface SearchCodeBitbucketDetails {
  kind: "search_code_bitbucket";
  source: string;
  unit: "files";
  matchCount: number;
  repoCount: number | undefined;
  fetchedCount: number;
  shownCount: number;
  complete: boolean | undefined;
  artifact: SearchArtifact;
  entries: ShownEntry[];
}

export interface BitbucketCodeQuery {
  pattern: string;
  project: string | undefined;
  repo: string | undefined;
  language: string | undefined;
  extension: string | undefined;
  path: string | undefined;
}

export function buildBitbucketCodeQuery(query: BitbucketCodeQuery): string {
  const pattern = query.pattern.trim();
  if (pattern.length === 0) {
    throw new Error("pattern cannot be blank.");
  }
  // An unknown modifier is a silent zero, so none pass through the pattern.
  const modifier = /(^|\s|\()(-?[A-Za-z_]+):\S/.exec(pattern.replace(/"[^"]*"/g, " "));
  if (modifier) {
    throw new Error(
      `pattern contains a modifier "${modifier[2]}:". Use the project, repo, language, extension, and path arguments instead, or quote it to search for the text.`,
    );
  }
  if (/(^|\s)\S*\*/.test(pattern.replace(/"[^"]*"/g, " "))) {
    throw new Error("Bitbucket code search has no wildcards; search whole words.");
  }
  const parts = [pattern];
  if (query.repo && !query.project) {
    throw new Error("repo requires project; pass the project key and the repository slug.");
  }
  if (query.project) {
    const project = rejectUnsafeValue("project", query.project);
    parts.push(
      query.repo
        ? `repo:${project}/${rejectUnsafeValue("repo", query.repo)}`
        : `project:${project}`,
    );
  }
  if (query.language) {
    parts.push(`lang:${rejectUnsafeValue("language", query.language)}`);
  }
  if (query.extension) {
    parts.push(`ext:${rejectUnsafeValue("extension", query.extension).replace(/^\./, "")}`);
  }
  if (query.path) {
    parts.push(`path:${rejectUnsafeValue("path", query.path).replace(/^\/+|\/+$/g, "")}`);
  }
  return parts.join(" ");
}

export function createSearchCodeBitbucketTool(
  instances: LibrarianSource[],
  clients: Map<string, BitbucketClient>,
  cacheDir: string,
  search: SearchSettings,
) {
  const Params = Type.Object({
    ...sourceProperties(instances, "Which Bitbucket to search"),
    pattern: Type.String({
      description:
        "Whole words to find, case-insensitively; words must all appear in the file. Quote a phrase to keep it together, join alternatives with OR, exclude with NOT or -word, group with parentheses. Matches whole tokens only — no substrings, no wildcards, no regex — and ignores punctuation.",
    }),
    project: Type.Optional(Type.String({ description: "Restrict to a project key, e.g. PROJ." })),
    repo: Type.Optional(
      Type.String({ description: "Restrict to one repository slug in project. Requires project." }),
    ),
    language: Type.Optional(Type.String({ description: "Restrict to a language, e.g. go." })),
    extension: Type.Optional(
      Type.String({ description: "File extension without the dot, e.g. go." }),
    ),
    path: Type.Optional(
      Type.String({ description: "Restrict to paths containing this directory, e.g. internal." }),
    ),
    limit: limitParameter(BITBUCKET_MAX, search.defaultLimit),
  });

  return defineTool<typeof Params, SearchCodeBitbucketDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchCodeBitbucket,
    label: "Search Bitbucket code",
    description:
      "Search code across every repository on a Bitbucket Server instance, by whole words. Results come with their matched lines; no more than about 1,000 results of any search can be read.",
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(toolCallId, params, signal) {
      const instance = selectInstance(instances, params);
      const client = clients.get(instance.name);
      if (!client) {
        throw new Error(`No Bitbucket client for source "${instance.name}".`);
      }
      const query = buildBitbucketCodeQuery({
        pattern: params.pattern,
        project: params.project,
        repo: params.repo,
        language: params.language,
        extension: params.extension,
        path: params.path,
      });
      const limit = resolveLimit(params.limit, search, BITBUCKET_MAX);
      await client.authorize();
      const result = await runRestSearch(
        search,
        signal,
        "add project, language, or path, or more words.",
        async (searchSignal) => {
          try {
            return await client.searchCode(query, limit, searchSignal);
          } catch (error) {
            if (error instanceof BitbucketApiError && error.status === 400) {
              throw new Error(
                `${error.message}\nThe pattern or a modifier is malformed; check quotes and parentheses.`,
              );
            }
            throw error;
          }
        },
      );
      if (
        result.count === 0 &&
        params.project &&
        !(await client.projectExists(params.project, signal))
      ) {
        throw new Error(
          `No Bitbucket project ${params.project} on ${instance.name}, or it is not visible to this token. This is not an empty result.`,
        );
      }

      const repos = new Set(result.hits.map((hit) => hit.repo));
      const entries: ShownEntry[] = result.hits.map((hit) => {
        const lines = hit.lines.slice(0, MATCHED_LINES_SHOWN);
        const detail = [
          ...lines.map((line) => `${line.lineNumber}: ${clipLine(line.text)}`),
          ...(hit.lines.length > lines.length
            ? [`… ${hit.lines.length - lines.length} more matched lines`]
            : []),
        ].join("\n");
        return { label: `${hit.repo} — ${hit.path}`, ...(detail ? { detail } : {}) };
      });
      const artifact = await writeSearchArtifact(
        cacheDir,
        toolCallId,
        result.hits.map((hit) => ({ source: instance.name, ...hit })),
      );
      const allFetched = result.isLastPage;
      const found = allFetched
        ? `${plural(result.count, "file")} across ${plural(repos.size, "repo")}`
        : `${result.count >= COUNT_CAP ? `${formatCount(COUNT_CAP)}+` : formatCount(result.count)} files match`;

      return {
        content: [
          {
            type: "text",
            text: formatDigest(
              {
                found,
                source: instance.name,
                complete: undefined,
                incompleteReason: undefined,
                fetchedCount: result.hits.length,
                limitHit: !allFetched,
                shownCount: entries.length,
                artifact,
              },
              entries,
            ),
          },
        ],
        details: {
          kind: "search_code_bitbucket",
          source: instance.name,
          unit: "files",
          matchCount: result.count,
          repoCount: allFetched ? repos.size : undefined,
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
