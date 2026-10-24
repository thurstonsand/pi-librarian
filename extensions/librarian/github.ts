import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import { Type } from "typebox";
import { parseTypeBoxValue, safeParseTypeBoxValue } from "../shared/typebox.ts";
import {
  EntryNotFoundError,
  EntryTooLargeError,
  type RepoEntry,
  type RepoEntryType,
  type RepoFileReader,
} from "./repo-entry.ts";

const execFileAsync = promisify(execFile);

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    override readonly cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "GitHubApiError";
  }
}

export interface GitHubClientApi {
  searchRepositories(params: SearchRepositoriesParams): Promise<RepoSearchResult>;
  searchCode(params: SearchCodeParams): Promise<GitHubCodeSearchResult>;
  readEntry(params: ReadEntryParams): Promise<RepoEntry>;
  getRepo(owner: string, repo: string, signal: AbortSignal | undefined): Promise<RepoMeta>;
}

export type GitHubClientProvider = () => Promise<GitHubClientApi>;

// GITHUB_TOKEN and GH_TOKEN are read with the rest of the settings; this is the zero-config fallback.
export async function resolveGhCliToken(): Promise<string | undefined> {
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

function apiBaseUrl(webUrl: string): string {
  return webUrl === "https://github.com" ? "https://api.github.com" : `${webUrl}/api/v3`;
}

export function createGitHubClient(token: string | undefined, webUrl: string): GitHubClient {
  return new GitHubClient(
    new Octokit({
      ...(token ? { auth: token } : {}),
      baseUrl: apiBaseUrl(webUrl),
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
  tokenResolver: () => Promise<string | undefined>,
  webUrl: string,
): GitHubClientProvider {
  let client: Promise<GitHubClient> | undefined;
  return () => {
    client ??= tokenResolver().then((token) => createGitHubClient(token, webUrl));
    return client;
  };
}

// The rate-limit reset is an epoch second on GitHub's clock; measuring it against the response's own
// Date header rather than ours keeps clock skew out of the wait we report.
function rateLimitResetSeconds(
  headers: Record<string, string | number | undefined> | undefined,
): number | undefined {
  const reset = Number(headers?.["x-ratelimit-reset"]);
  const serverDate = Date.parse(String(headers?.date ?? ""));
  if (!Number.isFinite(reset) || Number.isNaN(serverDate)) {
    return undefined;
  }
  return Math.max(0, Math.ceil(reset - serverDate / 1000));
}

const GITHUB_ERROR_DATA_SCHEMA = Type.Object({
  message: Type.Optional(Type.String()),
});

function errorDetail(error: RequestError): string {
  const parsed = safeParseTypeBoxValue(GITHUB_ERROR_DATA_SCHEMA, error.response?.data);
  return parsed?.message ?? error.message;
}

function normalizeGitHubError(error: unknown, operation: string): never {
  if (!(error instanceof RequestError)) {
    throw error;
  }

  const headers = error.response?.headers;
  if (
    (error.status === 403 || error.status === 429) &&
    String(headers?.["x-ratelimit-remaining"]) === "0"
  ) {
    const reset = rateLimitResetSeconds(headers);
    throw new GitHubApiError(
      `GitHub ${operation} rate limit reached${reset === undefined ? "" : `; resets in ${reset}s`}.`,
      error.status,
      error,
    );
  }

  const detail = errorDetail(error).slice(0, 300);
  throw new GitHubApiError(
    `GitHub API ${error.status} during ${operation}${detail ? `: ${detail}` : ""}`,
    error.status,
    error,
  );
}

function requestOptions(signal: AbortSignal | undefined): { signal?: AbortSignal } {
  return signal ? { signal } : {};
}

const REPO_SEARCH_ITEM_SCHEMA = Type.Object({
  full_name: Type.String(),
  html_url: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  stargazers_count: Type.Number(),
  language: Type.Union([Type.String(), Type.Null()]),
  topics: Type.Optional(Type.Array(Type.String())),
  pushed_at: Type.Union([Type.String(), Type.Null()]),
  archived: Type.Boolean(),
  fork: Type.Boolean(),
});

const SEARCH_RESPONSE_SCHEMA = Type.Object({
  total_count: Type.Number(),
  incomplete_results: Type.Boolean(),
  items: Type.Array(Type.Unknown()),
});

export interface RepoSearchHit {
  repo: string;
  url: string;
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
  incompleteResults: boolean;
  hits: RepoSearchHit[];
}

export interface SearchRepositoriesParams {
  query: string;
  sort: "best-match" | "stars" | "updated";
  limit: number;
  signal: AbortSignal | undefined;
}

const CODE_SEARCH_MATCH_SCHEMA = Type.Object({
  fragment: Type.Optional(Type.String()),
});

const CODE_SEARCH_ITEM_SCHEMA = Type.Object({
  path: Type.String(),
  html_url: Type.String(),
  repository: Type.Object({ full_name: Type.String() }),
  text_matches: Type.Optional(Type.Array(Type.Unknown())),
});

export interface CodeSearchHit {
  repo: string;
  path: string;
  url: string;
  commit: string | undefined;
  fragments: string[];
}

export interface GitHubCodeSearchResult {
  totalCount: number;
  incompleteResults: boolean;
  hits: CodeSearchHit[];
}

export interface SearchCodeParams {
  query: string;
  limit: number;
  signal: AbortSignal | undefined;
}

const CONTENTS_ENTRY_SCHEMA = Type.Object({
  type: Type.String(),
  name: Type.String(),
  path: Type.String(),
  size: Type.Number(),
  sha: Type.String(),
  content: Type.Optional(Type.String()),
  encoding: Type.Optional(Type.String()),
  target: Type.Optional(Type.String()),
  submodule_git_url: Type.Optional(Type.String()),
});

export interface ReadEntryParams {
  owner: string;
  repo: string;
  path: string;
  ref: string | undefined;
  maxBytes: number;
  signal: AbortSignal | undefined;
}

const REPO_META_SCHEMA = Type.Object({
  full_name: Type.String(),
  default_branch: Type.String(),
  private: Type.Boolean(),
});

export interface RepoMeta {
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
}

// The contents API spells the four entry types this way; a directory listing reports a submodule
// as "file" with no download_url in some versions, so the single-entry form is the one trusted.
function entryType(type: string): RepoEntryType {
  switch (type) {
    case "dir":
      return "directory";
    case "symlink":
      return "symlink";
    case "submodule":
      return "submodule";
    default:
      return "file";
  }
}

// Line references in GitHub's blob URLs are a commit, which is what a reader needs to agree on lines.
function commitFromBlobUrl(url: string): string | undefined {
  return /\/blob\/([0-9a-f]{40})\//.exec(url)?.[1];
}

export class GitHubClient implements GitHubClientApi {
  constructor(private readonly octokit: Octokit) {}

  async searchRepositories(params: SearchRepositoriesParams): Promise<RepoSearchResult> {
    try {
      const response = await this.octokit.rest.search.repos({
        q: params.query,
        per_page: params.limit,
        ...(params.sort === "best-match" ? {} : { sort: params.sort, order: "desc" as const }),
        request: requestOptions(params.signal),
      });
      const payload = safeParseTypeBoxValue(SEARCH_RESPONSE_SCHEMA, response.data);
      if (!payload) {
        throw new Error("GitHub repository search returned an unexpected payload shape.");
      }

      const hits: RepoSearchHit[] = [];
      for (const item of payload.items) {
        const parsed = parseTypeBoxValue(
          REPO_SEARCH_ITEM_SCHEMA,
          item,
          "GitHub repository search result",
        );
        hits.push({
          repo: parsed.full_name,
          url: parsed.html_url,
          description: parsed.description ?? undefined,
          stars: parsed.stargazers_count,
          language: parsed.language ?? undefined,
          topics: parsed.topics ?? [],
          pushedAt: parsed.pushed_at ?? undefined,
          archived: parsed.archived,
          fork: parsed.fork,
        });
      }

      return {
        totalCount: payload.total_count,
        incompleteResults: payload.incomplete_results,
        hits,
      };
    } catch (error) {
      normalizeGitHubError(error, "repository search");
    }
  }

  async searchCode(params: SearchCodeParams): Promise<GitHubCodeSearchResult> {
    try {
      const response = await this.octokit.rest.search.code({
        q: params.query,
        per_page: params.limit,
        mediaType: { format: "text-match" },
        request: requestOptions(params.signal),
      });

      const payload = safeParseTypeBoxValue(SEARCH_RESPONSE_SCHEMA, response.data);
      if (!payload) {
        throw new Error("GitHub code search returned an unexpected payload shape.");
      }

      const hits: CodeSearchHit[] = [];
      for (const item of payload.items) {
        const parsed = parseTypeBoxValue(
          CODE_SEARCH_ITEM_SCHEMA,
          item,
          "GitHub code search result",
        );

        const fragments: string[] = [];
        for (const match of parsed.text_matches ?? []) {
          const parsedMatch = safeParseTypeBoxValue(CODE_SEARCH_MATCH_SCHEMA, match);
          if (parsedMatch?.fragment) {
            fragments.push(parsedMatch.fragment);
          }
        }

        hits.push({
          repo: parsed.repository.full_name,
          path: parsed.path,
          url: parsed.html_url,
          commit: commitFromBlobUrl(parsed.html_url),
          fragments,
        });
      }

      return {
        totalCount: payload.total_count,
        incompleteResults: payload.incomplete_results,
        hits,
      };
    } catch (error) {
      normalizeGitHubError(error, "code search");
    }
  }

  async readEntry(params: ReadEntryParams): Promise<RepoEntry> {
    const operation = `read ${params.owner}/${params.repo}/${params.path}`;
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: params.path,
        ...(params.ref ? { ref: params.ref } : {}),
        request: requestOptions(params.signal),
      });

      if (Array.isArray(response.data)) {
        const entries = response.data
          .map((entry) => parseTypeBoxValue(CONTENTS_ENTRY_SCHEMA, entry, "GitHub directory entry"))
          .map((entry) => ({ name: entry.name, type: entryType(entry.type) }));
        return { type: "directory", entries };
      }

      const entry = safeParseTypeBoxValue(CONTENTS_ENTRY_SCHEMA, response.data);
      if (!entry) {
        throw new Error(`Unexpected payload during ${operation}.`);
      }

      switch (entryType(entry.type)) {
        case "symlink":
          return { type: "symlink", target: entry.target ?? "" };
        case "submodule":
          return { type: "submodule", url: entry.submodule_git_url };
        case "directory":
          throw new Error(`Unexpected directory entry during ${operation}.`);
        case "file":
          break;
      }

      if (entry.size > params.maxBytes) {
        throw new EntryTooLargeError(entry.size);
      }
      // Above 1 MB the JSON form returns 200 with empty content; only the raw media type serves it.
      if (entry.encoding === "base64" && entry.content !== undefined && entry.content.length > 0) {
        return { type: "file", size: entry.size, bytes: Buffer.from(entry.content, "base64") };
      }
      const raw = await this.octokit.rest.repos.getContent({
        owner: params.owner,
        repo: params.repo,
        path: params.path,
        ...(params.ref ? { ref: params.ref } : {}),
        mediaType: { format: "raw" },
        request: requestOptions(params.signal),
      });
      const bytes =
        typeof raw.data === "string"
          ? Buffer.from(raw.data)
          : Buffer.from(raw.data as unknown as ArrayBuffer);
      return { type: "file", size: entry.size, bytes };
    } catch (error) {
      if (error instanceof EntryTooLargeError) {
        throw error;
      }
      if (error instanceof RequestError && error.status === 404) {
        throw new EntryNotFoundError(
          `Not found: ${params.owner}/${params.repo}/${params.path}${params.ref ? ` at ${params.ref}` : ""}.\nGitHub returns the same 404 for a missing path, ref, or repository and for a private repository your token cannot read.`,
        );
      }
      normalizeGitHubError(error, operation);
    }
  }

  async getRepo(owner: string, repo: string, signal: AbortSignal | undefined): Promise<RepoMeta> {
    try {
      const response = await this.octokit.rest.repos.get({
        owner,
        repo,
        request: requestOptions(signal),
      });
      const payload = safeParseTypeBoxValue(REPO_META_SCHEMA, response.data);
      if (!payload) {
        throw new Error(
          `GitHub repo metadata for ${owner}/${repo} returned an unexpected payload shape.`,
        );
      }
      return {
        fullName: payload.full_name,
        defaultBranch: payload.default_branch,
        isPrivate: payload.private,
      };
    } catch (error) {
      normalizeGitHubError(error, `repo lookup for ${owner}/${repo}`);
    }
  }
}

export function createGitHubFileReader(provider: GitHubClientProvider): RepoFileReader {
  return {
    async readEntry(request) {
      const [owner, repo, ...rest] = request.repo.split("/");
      if (!owner || !repo || rest.length > 0) {
        throw new Error(`GitHub repositories are owner/repo; "${request.repo}" is not.`);
      }
      const client = await provider();
      return client.readEntry({
        owner,
        repo,
        path: request.path,
        ref: request.ref,
        maxBytes: request.maxBytes,
        signal: request.signal,
      });
    },
  };
}
