import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { SearchTimeoutError } from "../budget.ts";
import {
  formatCount,
  formatDigest,
  plural,
  type SearchArtifact,
  type ShownEntry,
  writeSearchArtifact,
} from "../delivery.ts";
import {
  GitHubApiError,
  type GitHubClientApi,
  type GitHubClientProvider,
  type GitHubCodeSearchResult,
} from "../github.ts";
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

const GITHUB_CODE_SEARCH_MAX = 50;
const NARROWING_ADVICE = "set owner or repos, or add path, filename, or extension.";

export interface SearchCodeGitHubDetails {
  kind: "search_code_github";
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

// GitHub reads these silently wrong (OR as AND, a qualifier as a silent zero) or fails with a 422
// that names none of them, so the pattern is checked outside its quoted phrases first.
export function validateGitHubCodePattern(pattern: string): string {
  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    throw new Error("pattern cannot be blank.");
  }
  if ((trimmed.match(/"/g) ?? []).length % 2 !== 0) {
    throw new Error("pattern has an unbalanced quote; quote a phrase at both ends.");
  }
  const unquoted = trimmed.replace(/"[^"]*"/g, " ");
  if (/(^|\s)OR(\s|$)/.test(unquoted)) {
    throw new Error(
      "GitHub code search reads OR as AND. Search each alternative separately, or quote it to find the word OR.",
    );
  }
  if (/[()]/.test(unquoted)) {
    throw new Error(
      "GitHub code search cannot group with parentheses; quote them to search for them.",
    );
  }
  const qualifier = /(^|\s)(-?[A-Za-z_]+):\S/.exec(unquoted);
  if (qualifier) {
    throw new Error(
      `pattern contains a qualifier "${qualifier[2]}:". Use the owner, repos, path, filename, extension, and language arguments instead, or quote it to search for the text.`,
    );
  }
  return trimmed;
}

// GitHub's fragments start and end mid-context, often on an empty line.
function trimBlankLines(fragment: string): string {
  return fragment.replace(/^(\s*\n)+/, "").replace(/(\n\s*)+$/, "");
}

export interface GitHubCodeQuery {
  pattern: string;
  owner: string | undefined;
  repos: string[] | undefined;
  path: string | undefined;
  filename: string | undefined;
  extension: string | undefined;
  language: string | undefined;
}

export function buildGitHubCodeQuery(query: GitHubCodeQuery): string {
  const parts = [validateGitHubCodePattern(query.pattern)];
  if (query.repos && query.repos.length > 0) {
    if (!query.owner) {
      throw new Error("repos requires owner; pass owner and the bare repository names.");
    }
    const owner = rejectUnsafeValue("owner", query.owner);
    for (const repo of query.repos) {
      const name = rejectUnsafeValue("repos", repo);
      if (name.includes("/")) {
        throw new Error(
          `repos takes bare names under owner: pass owner "${name.split("/")[0]}" and repos ["${name.split("/").slice(1).join("/")}"].`,
        );
      }
      parts.push(`repo:${owner}/${name}`);
    }
  } else if (query.owner) {
    parts.push(`user:${rejectUnsafeValue("owner", query.owner)}`);
  }
  if (query.path) {
    parts.push(`path:${rejectUnsafeValue("path", query.path).replace(/^\/+|\/+$/g, "")}`);
  }
  if (query.filename) {
    parts.push(`filename:${rejectUnsafeValue("filename", query.filename)}`);
  }
  if (query.extension) {
    parts.push(`extension:${rejectUnsafeValue("extension", query.extension).replace(/^\./, "")}`);
  }
  if (query.language) {
    parts.push(`language:${rejectUnsafeValue("language", query.language)}`);
  }
  return parts.join(" ");
}

// incomplete_results with nothing found means GitHub could not search the scope at all, which reads
// as "no matches" unless said otherwise. A repo lookup follows renames, the commonest cause.
async function unsearchableScopeError(
  client: GitHubClientApi,
  owner: string | undefined,
  repos: string[] | undefined,
  signal: AbortSignal | undefined,
): Promise<Error> {
  const reasons: string[] = [];
  for (const repo of owner ? (repos ?? []) : []) {
    try {
      const meta = await client.getRepo(owner ?? "", repo, signal);
      if (meta.fullName.toLowerCase() !== `${owner}/${repo}`.toLowerCase()) {
        reasons.push(`${owner}/${repo} was renamed to ${meta.fullName}`);
      }
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        reasons.push(`${owner}/${repo} does not exist or is private to you`);
      } else {
        throw error;
      }
    }
  }
  const detail =
    reasons.length > 0
      ? reasons.join("; ")
      : "the scope may be missing, private to you, renamed, or a fork GitHub does not index";
  return new Error(`GitHub could not search this scope: ${detail}. This is not an empty result.`);
}

export function createSearchCodeGitHubTool(
  instances: LibrarianSource[],
  clients: Map<string, GitHubClientProvider>,
  cacheDir: string,
  search: SearchSettings,
) {
  const maximum = GITHUB_CODE_SEARCH_MAX;
  const Params = Type.Object({
    ...sourceProperties(instances, "Which GitHub to search"),
    pattern: Type.String({
      description:
        "Text to find, matched case-insensitively as a substring. Space-separated words must all appear in the file; quote a phrase to match it exactly; -word excludes. No regex, no OR, no parentheses.",
    }),
    owner: Type.Optional(
      Type.String({ description: "Restrict to repositories owned by this user or organization." }),
    ),
    repos: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Restrict to these repositories under owner, by bare name, e.g. drizzle-orm. Requires owner.",
        maxItems: 20,
      }),
    ),
    path: Type.Optional(
      Type.String({
        description:
          "Directory from the repository root, e.g. drizzle-kit/src. Not a glob and not a file name.",
      }),
    ),
    filename: Type.Optional(
      Type.String({ description: "File name or suffix, e.g. drizzle.config.ts." }),
    ),
    extension: Type.Optional(Type.String({ description: "File extension, e.g. ts." })),
    language: Type.Optional(
      Type.String({ description: "Restrict to a language, e.g. typescript." }),
    ),
    limit: limitParameter(maximum, search.defaultLimit),
  });

  return defineTool<typeof Params, SearchCodeGitHubDetails>({
    name: LIBRARIAN_TOOL_NAMES.searchCodeGitHub,
    label: "Search GitHub code",
    description:
      "Search code on GitHub's default branches, including private repositories your token can read. Returns matching files with short excerpts, without line numbers; files over about 350 KB are not indexed. Limited to 10 searches a minute.",
    parameters: Params,
    annotations: { readOnlyHint: true, openWorldHint: true },

    async execute(toolCallId, params, signal) {
      const instance = selectInstance(instances, params);
      const provider = clients.get(instance.name);
      if (!provider) {
        throw new Error(`No GitHub client for source "${instance.name}".`);
      }
      const query = buildGitHubCodeQuery({
        pattern: params.pattern,
        owner: params.owner,
        repos: params.repos,
        path: params.path,
        filename: params.filename,
        extension: params.extension,
        language: params.language,
      });
      const limit = resolveLimit(params.limit, search, maximum);
      const client = await provider();

      let result: GitHubCodeSearchResult;
      try {
        result = await runRestSearch(search, signal, NARROWING_ADVICE, (searchSignal) =>
          client.searchCode({ query, limit, signal: searchSignal }),
        );
      } catch (error) {
        if (error instanceof GitHubApiError && error.status === 408) {
          throw new SearchTimeoutError(
            `GitHub stopped the search at its own time limit, about 9s.\nNarrow it before retrying: ${NARROWING_ADVICE}`,
          );
        }
        if (error instanceof GitHubApiError && error.status === 422 && params.language) {
          throw new Error(
            `${error.message}\nIf the language is the problem, use its GitHub name, e.g. typescript, c#, or jupyter-notebook.`,
          );
        }
        throw error;
      }

      if (result.incompleteResults && result.hits.length === 0) {
        throw await unsearchableScopeError(client, params.owner, params.repos, signal);
      }

      const repos = new Set(result.hits.map((hit) => hit.repo));
      const allFetched = result.hits.length >= result.totalCount;
      const entries: ShownEntry[] = result.hits.map((hit) => {
        const fragments = hit.fragments
          .slice(0, 2)
          .map((fragment) => trimBlankLines(fragment).split("\n").slice(0, 3).join("\n"))
          .join("\n…\n");
        return {
          label: `${hit.repo} — ${hit.path}`,
          url: hit.url,
          ...(hit.commit ? { revision: hit.commit.slice(0, 7) } : {}),
          ...(fragments ? { detail: fragments } : {}),
        };
      });
      const artifact = await writeSearchArtifact(
        cacheDir,
        toolCallId,
        result.hits.map((hit) => ({ source: instance.name, ...hit })),
      );
      const found = allFetched
        ? `${plural(result.totalCount, "file")} across ${plural(repos.size, "repo")}`
        : `${formatCount(result.totalCount)} files match`;
      const complete = result.incompleteResults ? false : undefined;

      return {
        content: [
          {
            type: "text",
            text: formatDigest(
              {
                found,
                source: instance.name,
                complete,
                incompleteReason: "GitHub did not finish searching every file",
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
          kind: "search_code_github",
          source: instance.name,
          unit: "files",
          matchCount: result.totalCount,
          repoCount: allFetched ? repos.size : undefined,
          fetchedCount: result.hits.length,
          shownCount: entries.length,
          complete,
          artifact,
          entries,
        },
      };
    },
  });
}
