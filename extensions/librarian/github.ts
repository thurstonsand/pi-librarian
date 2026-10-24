import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { RequestError } from "@octokit/request-error";
import { Octokit } from "@octokit/rest";
import { type Static, type TSchema, Type } from "typebox";
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

export type GitHubClientProvider = () => Promise<GitHubClient>;

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

function searchResponseSchema<T extends TSchema>(item: T) {
  return Type.Object({
    total_count: Type.Number(),
    incomplete_results: Type.Boolean(),
    items: Type.Array(item),
  });
}

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
  text_matches: Type.Optional(Type.Array(CODE_SEARCH_MATCH_SCHEMA)),
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

// One GitHub API request. route is Octokit's "METHOD /path/{param}" form, filled from params.
export interface GitHubRequest {
  route: string;
  params: Record<string, unknown>;
  operation: string;
  signal: AbortSignal | undefined;
}

export class GitHubClient {
  constructor(private readonly octokit: Octokit) {}

  // Every response crosses the edge here, so a caller holds a validated value or an error that
  // names the operation; GitHub's own failures arrive as GitHubApiError with the status.
  async get<T extends TSchema>(request: GitHubRequest, schema: T): Promise<Static<T>> {
    try {
      const response = await this.octokit.request(request.route, {
        ...request.params,
        request: requestOptions(request.signal),
      });
      return parseTypeBoxValue(schema, response.data, `GitHub ${request.operation}`);
    } catch (error) {
      normalizeGitHubError(error, request.operation);
    }
  }

  async getRaw(request: GitHubRequest): Promise<Buffer> {
    try {
      const response = await this.octokit.request(request.route, {
        ...request.params,
        mediaType: { format: "raw" },
        request: requestOptions(request.signal),
      });
      const data: unknown = response.data;
      if (typeof data === "string") {
        return Buffer.from(data);
      }
      if (data instanceof ArrayBuffer) {
        return Buffer.from(data);
      }
      throw new Error(`GitHub ${request.operation} returned no raw content.`);
    } catch (error) {
      normalizeGitHubError(error, request.operation);
    }
  }

  async graphql<T extends TSchema>(
    query: string,
    variables: Record<string, unknown>,
    schema: T,
    operation: string,
    signal: AbortSignal | undefined,
  ): Promise<Static<T>> {
    try {
      const data: unknown = await this.octokit.graphql(query, {
        ...variables,
        request: requestOptions(signal),
      });
      return parseTypeBoxValue(schema, data, `GitHub ${operation}`);
    } catch (error) {
      normalizeGitHubError(error, operation);
    }
  }

  async searchRepositories(params: SearchRepositoriesParams): Promise<RepoSearchResult> {
    const payload = await this.get(
      {
        route: "GET /search/repositories",
        params: {
          q: params.query,
          per_page: params.limit,
          ...(params.sort === "best-match" ? {} : { sort: params.sort, order: "desc" }),
        },
        operation: "repository search",
        signal: params.signal,
      },
      searchResponseSchema(REPO_SEARCH_ITEM_SCHEMA),
    );
    return {
      totalCount: payload.total_count,
      incompleteResults: payload.incomplete_results,
      hits: payload.items.map((item) => ({
        repo: item.full_name,
        url: item.html_url,
        description: item.description ?? undefined,
        stars: item.stargazers_count,
        language: item.language ?? undefined,
        topics: item.topics ?? [],
        pushedAt: item.pushed_at ?? undefined,
        archived: item.archived,
        fork: item.fork,
      })),
    };
  }

  async searchCode(params: SearchCodeParams): Promise<GitHubCodeSearchResult> {
    const payload = await this.get(
      {
        route: "GET /search/code",
        params: { q: params.query, per_page: params.limit, mediaType: { format: "text-match" } },
        operation: "code search",
        signal: params.signal,
      },
      searchResponseSchema(CODE_SEARCH_ITEM_SCHEMA),
    );
    return {
      totalCount: payload.total_count,
      incompleteResults: payload.incomplete_results,
      hits: payload.items.map((item) => ({
        repo: item.repository.full_name,
        path: item.path,
        url: item.html_url,
        commit: commitFromBlobUrl(item.html_url),
        fragments: (item.text_matches ?? []).flatMap((match) =>
          match.fragment ? [match.fragment] : [],
        ),
      })),
    };
  }

  async readEntry(params: ReadEntryParams): Promise<RepoEntry> {
    const request: GitHubRequest = {
      route: "GET /repos/{owner}/{repo}/contents/{path}",
      params: {
        owner: params.owner,
        repo: params.repo,
        path: params.path,
        ...(params.ref ? { ref: params.ref } : {}),
      },
      operation: `read ${params.owner}/${params.repo}/${params.path}`,
      signal: params.signal,
    };
    try {
      const payload = await this.get(
        request,
        Type.Union([Type.Array(CONTENTS_ENTRY_SCHEMA), CONTENTS_ENTRY_SCHEMA]),
      );
      if (Array.isArray(payload)) {
        return {
          type: "directory",
          entries: payload.map((entry) => ({ name: entry.name, type: entryType(entry.type) })),
        };
      }

      switch (entryType(payload.type)) {
        case "symlink":
          return { type: "symlink", target: payload.target ?? "" };
        case "submodule":
          return { type: "submodule", url: payload.submodule_git_url };
        case "directory":
          throw new Error(`Unexpected directory entry during ${request.operation}.`);
        case "file":
          break;
      }

      if (payload.size > params.maxBytes) {
        throw new EntryTooLargeError(payload.size);
      }
      // Above 1 MB the JSON form returns 200 with empty content; only the raw media type serves it.
      if (
        payload.encoding === "base64" &&
        payload.content !== undefined &&
        payload.content.length > 0
      ) {
        return { type: "file", size: payload.size, bytes: Buffer.from(payload.content, "base64") };
      }
      return { type: "file", size: payload.size, bytes: await this.getRaw(request) };
    } catch (error) {
      if (error instanceof GitHubApiError && error.status === 404) {
        throw new EntryNotFoundError(
          `Not found: ${params.owner}/${params.repo}/${params.path}${params.ref ? ` at ${params.ref}` : ""}.\nGitHub returns the same 404 for a missing path, ref, or repository and for a private repository your token cannot read.`,
        );
      }
      throw error;
    }
  }

  async getRepo(owner: string, repo: string, signal: AbortSignal | undefined): Promise<RepoMeta> {
    const payload = await this.get(
      {
        route: "GET /repos/{owner}/{repo}",
        params: { owner, repo },
        operation: `repo lookup for ${owner}/${repo}`,
        signal,
      },
      REPO_META_SCHEMA,
    );
    return {
      fullName: payload.full_name,
      defaultBranch: payload.default_branch,
      isPrivate: payload.private,
    };
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
