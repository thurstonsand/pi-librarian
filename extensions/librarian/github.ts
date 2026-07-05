import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import { type Static, Type } from "typebox";
import { safeParseTypeBoxValue } from "../shared/typebox.ts";

const execFileAsync = promisify(execFile);

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfterSeconds: number | undefined,
    override readonly cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "GitHubApiError";
  }
}

export interface GitHubRepoSlug {
  owner: string;
  repo: string;
}

function repoFullName(repo: GitHubRepoSlug): string {
  return `${repo.owner}/${repo.repo}`;
}

export type GitHubClientProvider = () => Promise<GitHubClient>;

export async function resolveGitHubToken(): Promise<string | undefined> {
  const envToken = process.env.GITHUB_TOKEN?.trim() || process.env.GH_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  try {
    const { stdout } = await execFileAsync("gh", ["auth", "token"], { timeout: 10_000 });
    const token = stdout.trim();
    return token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

// Any console output corrupts pi's interactive TUI (its differential renderer
// cannot recover from writes it did not make), so octokit must never log.
// The top-level `log` alone is not enough: @octokit/request resolves its logger
// from the per-request options (`request.log || console`) when emitting API
// deprecation warnings, so the silent logger has to be passed at both levels.
const SILENT_OCTOKIT_LOG = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

export function createGitHubClient(token: string | undefined): GitHubClient {
  return new GitHubClient(
    new Octokit({
      ...(token ? { auth: token } : {}),
      userAgent: "pi-librarian",
      log: SILENT_OCTOKIT_LOG,
      request: {
        log: SILENT_OCTOKIT_LOG,
        headers: {
          "x-github-api-version": "2022-11-28",
        },
      },
    }),
  );
}

export function createGitHubClientProvider(
  tokenResolver: () => Promise<string | undefined> = resolveGitHubToken,
): GitHubClientProvider {
  let client: Promise<GitHubClient> | undefined;
  return () => {
    client ??= tokenResolver().then((token) => createGitHubClient(token));
    return client;
  };
}

function retryAfterSeconds(
  headers: Record<string, string | number | undefined> | undefined,
): number | undefined {
  const retryAfter = headers?.["retry-after"];
  const rateReset = headers?.["x-ratelimit-reset"];

  let seconds: number | undefined;
  if (retryAfter) {
    seconds = Number(retryAfter);
  } else if (rateReset) {
    seconds = Math.max(0, Number(rateReset) - Math.floor(Date.now() / 1000));
  }

  return Number.isFinite(seconds) ? seconds : undefined;
}

const GITHUB_ERROR_DATA_SCHEMA = Type.Object({
  message: Type.Optional(Type.String()),
});

function errorDetail(error: RequestError): string {
  const parsed = safeParseTypeBoxValue(GITHUB_ERROR_DATA_SCHEMA, error.response?.data);
  if (parsed?.message) {
    return parsed.message;
  }
  return error.message;
}

function normalizeGitHubError(error: unknown, operation: string): never {
  if (error instanceof RequestError) {
    const detail = errorDetail(error).slice(0, 300);
    throw new GitHubApiError(
      `GitHub API ${error.status} during ${operation}${detail ? `: ${detail}` : ""}`,
      error.status,
      retryAfterSeconds(error.response?.headers),
      error,
    );
  }

  throw error;
}

const REPO_SEARCH_ITEM_SCHEMA = Type.Object({
  full_name: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  stargazers_count: Type.Number(),
  language: Type.Union([Type.String(), Type.Null()]),
  topics: Type.Optional(Type.Array(Type.String())),
  pushed_at: Type.Union([Type.String(), Type.Null()]),
  archived: Type.Boolean(),
  fork: Type.Boolean(),
});

const REPO_SEARCH_RESPONSE_SCHEMA = Type.Object({
  total_count: Type.Number(),
  items: Type.Array(Type.Unknown()),
});

export interface RepoSearchHit {
  repo: string;
  description: string | undefined;
  stars: number;
  language: string | undefined;
  topics: string[];
  pushedAt: string | undefined;
  archived: boolean;
  fork: boolean;
}

export interface RepoSearchResult {
  totalCount: number;
  hits: RepoSearchHit[];
}

export interface SearchRepositoriesParams {
  query: string;
  sort: "stars" | "updated" | "best-match";
  limit: number;
}

const CODE_SEARCH_MATCH_SCHEMA = Type.Object({
  fragment: Type.Optional(Type.String()),
});

const CODE_SEARCH_ITEM_SCHEMA = Type.Object({
  path: Type.String(),
  repository: Type.Object({ full_name: Type.String() }),
  text_matches: Type.Optional(Type.Array(Type.Unknown())),
});

const CODE_SEARCH_RESPONSE_SCHEMA = Type.Object({
  total_count: Type.Number(),
  items: Type.Array(Type.Unknown()),
});

export interface CodeSearchHit {
  repo: string;
  path: string;
  fragments: string[];
}

export interface GitHubCodeSearchResult {
  totalCount: number;
  hits: CodeSearchHit[];
}

export interface SearchGitHubCodeParams {
  pattern: string;
  repos?: GitHubRepoSlug[];
  owners?: string[];
  language?: string;
  path?: string;
  limit: number;
}

const CONTENTS_DIR_ENTRY_SCHEMA = Type.Object({
  type: Type.String(),
  path: Type.String(),
  size: Type.Optional(Type.Number()),
});

export type FileContents = {
  kind: "file";
  text: string;
};

export type DirectoryContents = {
  kind: "directory";
  entries: { type: string; path: string; size: number | undefined }[];
};

export interface ReadContentsParams {
  repo: GitHubRepoSlug;
  path: string;
  ref: string | undefined;
}

const REPO_META_SCHEMA = Type.Object({
  default_branch: Type.String(),
  private: Type.Boolean(),
});

export interface RepoMeta {
  defaultBranch: string;
  isPrivate: boolean;
}

function buildGitHubCodeQuery(params: SearchGitHubCodeParams): string {
  const parts: string[] = [params.pattern.replace(/^\/|\/$/g, "")];

  for (const repo of params.repos ?? []) {
    parts.push(`repo:${repoFullName(repo)}`);
  }
  for (const owner of params.owners ?? []) {
    parts.push(`user:${owner}`);
  }
  if (params.language) {
    parts.push(`language:${params.language}`);
  }
  if (params.path) {
    parts.push(`path:${params.path}`);
  }

  return parts.join(" ");
}

export class GitHubClient {
  constructor(private readonly octokit: Octokit) {}

  async searchRepositories(params: SearchRepositoriesParams): Promise<RepoSearchResult> {
    try {
      const response = await this.octokit.rest.search.repos({
        q: params.query,
        per_page: params.limit,
        ...(params.sort === "best-match" ? {} : { sort: params.sort, order: "desc" as const }),
      });
      const payload = safeParseTypeBoxValue(REPO_SEARCH_RESPONSE_SCHEMA, response.data);
      if (!payload) {
        throw new Error("GitHub repository search returned an unexpected payload shape.");
      }

      const hits: RepoSearchHit[] = [];
      for (const item of payload.items) {
        const parsed = safeParseTypeBoxValue(REPO_SEARCH_ITEM_SCHEMA, item);
        if (!parsed) {
          continue;
        }

        hits.push({
          repo: parsed.full_name,
          description: parsed.description ?? undefined,
          stars: parsed.stargazers_count,
          language: parsed.language ?? undefined,
          topics: parsed.topics ?? [],
          pushedAt: parsed.pushed_at ?? undefined,
          archived: parsed.archived,
          fork: parsed.fork,
        });
      }

      return { totalCount: payload.total_count, hits };
    } catch (error) {
      normalizeGitHubError(error, "repository search");
    }
  }

  async searchCode(params: SearchGitHubCodeParams): Promise<GitHubCodeSearchResult> {
    try {
      const response = await this.octokit.rest.search.code({
        q: buildGitHubCodeQuery(params),
        per_page: params.limit,
        mediaType: { format: "text-match" },
      });

      const payload = safeParseTypeBoxValue(CODE_SEARCH_RESPONSE_SCHEMA, response.data);
      if (!payload) {
        throw new Error("GitHub code search returned an unexpected payload shape.");
      }

      const hits: CodeSearchHit[] = [];
      for (const item of payload.items) {
        const parsed = safeParseTypeBoxValue(CODE_SEARCH_ITEM_SCHEMA, item);
        if (!parsed) {
          continue;
        }

        const fragments: string[] = [];
        for (const match of parsed.text_matches ?? []) {
          const parsedMatch = safeParseTypeBoxValue(CODE_SEARCH_MATCH_SCHEMA, match);
          if (parsedMatch?.fragment) {
            fragments.push(parsedMatch.fragment);
          }
        }

        hits.push({ repo: parsed.repository.full_name, path: parsed.path, fragments });
      }

      return { totalCount: payload.total_count, hits };
    } catch (error) {
      normalizeGitHubError(error, "code search");
    }
  }

  async readContents(params: ReadContentsParams): Promise<FileContents | DirectoryContents> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: params.repo.owner,
        repo: params.repo.repo,
        path: params.path,
        ...(params.ref ? { ref: params.ref } : {}),
        mediaType: { format: "raw" },
      });

      if (Array.isArray(response.data)) {
        const entries = response.data
          .map((entry) => safeParseTypeBoxValue(CONTENTS_DIR_ENTRY_SCHEMA, entry))
          .filter((entry): entry is Static<typeof CONTENTS_DIR_ENTRY_SCHEMA> => entry !== undefined)
          .map((entry) => ({ type: entry.type, path: entry.path, size: entry.size }));
        return { kind: "directory", entries };
      }

      if (typeof response.data === "string") {
        return { kind: "file", text: response.data };
      }

      throw new Error(`Unexpected payload reading ${repoFullName(params.repo)}:${params.path}.`);
    } catch (error) {
      normalizeGitHubError(error, `read ${repoFullName(params.repo)}:${params.path}`);
    }
  }

  async getRepo(repo: GitHubRepoSlug): Promise<RepoMeta> {
    try {
      const response = await this.octokit.rest.repos.get({ owner: repo.owner, repo: repo.repo });
      const payload = safeParseTypeBoxValue(REPO_META_SCHEMA, response.data);
      if (!payload) {
        throw new Error(
          `GitHub repo metadata for ${repoFullName(repo)} returned an unexpected payload shape.`,
        );
      }

      return { defaultBranch: payload.default_branch, isPrivate: payload.private };
    } catch (error) {
      normalizeGitHubError(error, `repo metadata for ${repoFullName(repo)}`);
    }
  }
}
