import { Type } from "typebox";
import { parseTypeBoxValue, safeParseTypeBoxValue } from "../shared/typebox.ts";
import {
  EntryNotFoundError,
  EntryTooLargeError,
  type RepoEntry,
  type RepoEntryType,
  type RepoFileReader,
  submoduleUrl,
} from "./repo-entry.ts";

export class GitLabApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "GitLabApiError";
  }
}

const CODE_SEARCHES_PER_WINDOW = 30;
const LISTING_PAGE_SIZE = 1000;
const MAX_LISTING_PAGES = 20;
const RATE_WINDOW_MS = 60_000;

// GitLab allows 30 code searches a minute per user, counting every page and every refusal, in a
// fixed window from its first request; its 429 always says Retry-After: 60 whatever is left. So the
// window is kept here, shared by every search through this client, and the tool fails with the real
// wait instead of spending the quota on refusals.
export class CodeSearchWindow {
  private windowStart = 0;
  private used = 0;

  constructor(private readonly now: () => number) {}

  take(): void {
    const now = this.now();
    if (now - this.windowStart >= RATE_WINDOW_MS) {
      this.windowStart = now;
      this.used = 0;
    }
    if (this.used >= CODE_SEARCHES_PER_WINDOW) {
      const wait = Math.ceil((this.windowStart + RATE_WINDOW_MS - now) / 1000);
      throw new GitLabApiError(
        `GitLab allows ${CODE_SEARCHES_PER_WINDOW} code searches a minute; the next one is possible in ${wait}s.`,
        429,
      );
    }
    this.used += 1;
  }
}

const MESSAGE_SCHEMA = Type.Object({
  message: Type.Optional(Type.Unknown()),
  error: Type.Optional(Type.String()),
});

// Parameter validation answers {error}, everything else {message}, and a 429 nests one in the other.
function errorMessage(body: string): string {
  try {
    const parsed = safeParseTypeBoxValue(MESSAGE_SCHEMA, JSON.parse(body));
    if (parsed?.error) {
      return parsed.error;
    }
    if (typeof parsed?.message === "string") {
      return parsed.message;
    }
    const nested = safeParseTypeBoxValue(MESSAGE_SCHEMA, parsed?.message);
    if (nested?.error) {
      return nested.error;
    }
  } catch {
    // Not JSON; the body itself is the message.
  }
  return body.slice(0, 200);
}

function listBody(body: unknown): unknown[] {
  if (!Array.isArray(body)) {
    throw new Error("GitLab returned an object where it lists results.");
  }
  return body;
}

const PROJECT_SCHEMA = Type.Object({
  id: Type.Number(),
  path_with_namespace: Type.String(),
  default_branch: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  repository_access_level: Type.Optional(Type.String()),
});

export interface GitLabProject {
  id: number;
  path: string;
  defaultBranch: string | undefined;
  repositoryRestricted: boolean;
}

const BLOB_HIT_SCHEMA = Type.Object({
  id: Type.Union([Type.String(), Type.Null()]),
  path: Type.String(),
  data: Type.String(),
  ref: Type.String(),
  startline: Type.Number(),
  project_id: Type.Number(),
});

export interface GitLabBlobHit {
  // A hit whose path matched carries the head of the file, not a match.
  pathMatch: boolean;
  path: string;
  data: string;
  ref: string;
  startline: number;
  projectId: number;
}

export interface BlobSearchPage {
  hits: GitLabBlobHit[];
  // A lower bound until the last page when the query has no filter.
  total: number | undefined;
  hasNextPage: boolean;
}

const PROJECT_SEARCH_ITEM_SCHEMA = Type.Object({
  path_with_namespace: Type.String(),
  web_url: Type.String(),
  description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  star_count: Type.Optional(Type.Number()),
  last_activity_at: Type.Optional(Type.String()),
  topics: Type.Optional(Type.Array(Type.String())),
});

export interface GitLabProjectHit {
  path: string;
  url: string;
  description: string | undefined;
  stars: number | undefined;
  lastActivityAt: string | undefined;
  topics: string[];
}

export interface ProjectSearchResult {
  total: number | undefined;
  hits: GitLabProjectHit[];
}

const TREE_ENTRY_SCHEMA = Type.Object({
  name: Type.String(),
  type: Type.String(),
  mode: Type.String(),
});

function treeEntryType(entry: { type: string; mode: string }): RepoEntryType {
  if (entry.type === "tree") {
    return "directory";
  }
  if (entry.type === "commit") {
    return "submodule";
  }
  return entry.mode === "120000" ? "symlink" : "file";
}

export class GitLabClient {
  readonly codeSearches: CodeSearchWindow;
  private readonly projects = new Map<string, Promise<GitLabProject>>();

  constructor(
    private readonly url: string,
    private readonly token: string,
    now: () => number,
  ) {
    this.codeSearches = new CodeSearchWindow(now);
  }

  private async request(
    path: string,
    params: Record<string, string | undefined>,
    signal: AbortSignal | undefined,
    method: "GET" | "HEAD" = "GET",
  ): Promise<Response> {
    const url = new URL(`/api/v4${path}`, this.url);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
    const response = await fetch(url, {
      method,
      headers: { "private-token": this.token, "user-agent": "pi-librarian" },
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      const message = method === "HEAD" ? response.statusText : errorMessage(await response.text());
      if (response.status === 401) {
        throw new GitLabApiError(`GitLab rejected the token (401): ${message}`, 401);
      }
      throw new GitLabApiError(`GitLab API ${response.status}: ${message}`, response.status);
    }
    return response;
  }

  // Renamed projects redirect correctly here and break on /search, so every search goes by id.
  resolveProject(path: string, signal: AbortSignal | undefined): Promise<GitLabProject> {
    const key = path.toLowerCase();
    let project = this.projects.get(key);
    if (!project) {
      project = this.request(`/projects/${encodeURIComponent(path)}`, {}, signal)
        .then(async (response) => {
          const parsed = safeParseTypeBoxValue(PROJECT_SCHEMA, await response.json());
          if (!parsed) {
            throw new Error(`GitLab project ${path} returned an unexpected payload shape.`);
          }
          const resolved: GitLabProject = {
            id: parsed.id,
            path: parsed.path_with_namespace,
            defaultBranch: parsed.default_branch ?? undefined,
            repositoryRestricted:
              parsed.repository_access_level !== undefined &&
              parsed.repository_access_level !== "enabled",
          };
          // A search result names its project by id; this saves looking up one already resolved.
          if (!this.projects.has(String(parsed.id))) {
            this.projects.set(String(parsed.id), Promise.resolve(resolved));
          }
          return resolved;
        })
        .catch((error: unknown) => {
          this.projects.delete(key);
          if (error instanceof GitLabApiError && error.status === 404) {
            throw new GitLabApiError(
              `No GitLab project ${path}, or it is not visible to this token.`,
              404,
            );
          }
          throw error;
        });
      this.projects.set(key, project);
    }
    return project;
  }

  async refExists(
    projectId: number,
    ref: string,
    signal: AbortSignal | undefined,
  ): Promise<boolean> {
    try {
      await this.request(
        `/projects/${projectId}/repository/commits/${encodeURIComponent(ref)}`,
        {},
        signal,
      );
      return true;
    } catch (error) {
      if (error instanceof GitLabApiError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async searchBlobs(
    scope: { projectId: number } | "instance",
    search: string,
    ref: string | undefined,
    page: number,
    perPage: number,
    signal: AbortSignal | undefined,
  ): Promise<BlobSearchPage> {
    this.codeSearches.take();
    const path = scope === "instance" ? "/search" : `/projects/${scope.projectId}/search`;
    const response = await this.request(
      path,
      {
        scope: "blobs",
        search,
        // gitlab.com answers a project search with exact code search unless told otherwise, which
        // ANDs words and parses `foo(` as a broken regex. Basic is the fixed string the tool
        // promises, and the only engine an instance without advanced search has.
        search_type: scope === "instance" ? undefined : "basic",
        ref,
        page: String(page),
        per_page: String(perPage),
      },
      signal,
    );
    const body: unknown = await response.json();
    const hits: GitLabBlobHit[] = [];
    for (const item of listBody(body)) {
      const parsed = parseTypeBoxValue(BLOB_HIT_SCHEMA, item, "GitLab code search result");
      hits.push({
        pathMatch: parsed.id !== null,
        path: parsed.path,
        data: parsed.data,
        ref: parsed.ref,
        startline: parsed.startline,
        projectId: parsed.project_id,
      });
    }
    const total = Number(response.headers.get("x-total"));
    return {
      hits,
      total: Number.isFinite(total) && response.headers.has("x-total") ? total : undefined,
      hasNextPage: (response.headers.get("x-next-page") ?? "") !== "",
    };
  }

  async projectPath(projectId: number, signal: AbortSignal | undefined): Promise<string> {
    return (await this.resolveProject(String(projectId), signal)).path;
  }

  async searchProjects(
    params: Record<string, string | undefined>,
    signal: AbortSignal | undefined,
  ): Promise<ProjectSearchResult> {
    const response = await this.request("/projects", params, signal);
    const body: unknown = await response.json();
    const hits: GitLabProjectHit[] = [];
    for (const item of listBody(body)) {
      const parsed = parseTypeBoxValue(
        PROJECT_SEARCH_ITEM_SCHEMA,
        item,
        "GitLab project search result",
      );
      hits.push({
        path: parsed.path_with_namespace,
        url: parsed.web_url,
        description: parsed.description || undefined,
        stars: parsed.star_count,
        lastActivityAt: parsed.last_activity_at,
        topics: parsed.topics ?? [],
      });
    }
    const total = Number(response.headers.get("x-total"));
    return {
      total: response.headers.has("x-total") && Number.isFinite(total) ? total : undefined,
      hits,
    };
  }

  private async submoduleTarget(
    projectId: number,
    path: string,
    ref: string | undefined,
    signal: AbortSignal | undefined,
  ): Promise<string | undefined> {
    try {
      const response = await this.request(
        `/projects/${projectId}/repository/files/.gitmodules/raw`,
        { ref },
        signal,
      );
      return submoduleUrl(await response.text(), path);
    } catch (error) {
      if (error instanceof GitLabApiError && error.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  async readEntry(
    projectPath: string,
    path: string,
    ref: string | undefined,
    maxBytes: number,
    signal: AbortSignal | undefined,
  ): Promise<RepoEntry> {
    const project = await this.resolveProject(projectPath, signal);
    const cleanPath = path.replace(/^\/+|\/+$/g, "");
    const location = `${project.path}/${cleanPath}${ref ? ` at ${ref}` : ""}`;
    // A listing reads every page: an entry on page two is not absent.
    const treeEntries = async (treePath: string) => {
      const entries: { name: string; type: string; mode: string }[] = [];
      for (let page = 1; page <= MAX_LISTING_PAGES; page += 1) {
        const response = await this.request(
          `/projects/${project.id}/repository/tree`,
          {
            path: treePath || undefined,
            ref,
            per_page: String(LISTING_PAGE_SIZE),
            page: String(page),
          },
          signal,
        );
        for (const item of listBody(await response.json())) {
          entries.push(parseTypeBoxValue(TREE_ENTRY_SCHEMA, item, "GitLab tree entry"));
        }
        if ((response.headers.get("x-next-page") ?? "") === "") {
          return entries;
        }
      }
      throw new Error(
        `${project.path}/${treePath} has more than ${MAX_LISTING_PAGES * LISTING_PAGE_SIZE} entries; clone it with checkout_repo and list it locally.`,
      );
    };

    // The raw endpoint cannot tell a submodule from an empty file or a symlink from a one-line text
    // file, so the parent's tree entry says what this path is first.
    const slash = cleanPath.lastIndexOf("/");
    const parent = slash === -1 ? "" : cleanPath.slice(0, slash);
    const name = slash === -1 ? cleanPath : cleanPath.slice(slash + 1);
    let type: RepoEntryType = "directory";
    if (cleanPath) {
      let siblings: { name: string; type: string; mode: string }[];
      try {
        siblings = await treeEntries(parent);
      } catch (error) {
        if (error instanceof GitLabApiError && error.status === 404) {
          throw new EntryNotFoundError(`Not found: ${location}.\nGitLab says: ${error.message}`);
        }
        throw error;
      }
      const entry = siblings.find((sibling) => sibling.name === name);
      if (!entry) {
        throw new EntryNotFoundError(
          `Not found: ${location}. Paths are case-sensitive; list ${parent || "the repository root"} to see what is there.`,
        );
      }
      type = treeEntryType(entry);
    }

    if (type === "directory") {
      const entries = await treeEntries(cleanPath);
      return {
        type: "directory",
        entries: entries.map((entry) => ({ name: entry.name, type: treeEntryType(entry) })),
      };
    }
    if (type === "submodule") {
      return {
        type: "submodule",
        url: await this.submoduleTarget(project.id, cleanPath, ref, signal),
      };
    }

    const rawPath = `/projects/${project.id}/repository/files/${encodeURIComponent(cleanPath)}/raw`;
    const head = await this.request(rawPath, { ref }, signal, "HEAD");
    const size = Number(head.headers.get("x-gitlab-size"));
    if (Number.isFinite(size) && size > maxBytes) {
      throw new EntryTooLargeError(size);
    }
    const bytes = Buffer.from(await (await this.request(rawPath, { ref }, signal)).arrayBuffer());
    if (type === "symlink") {
      return { type: "symlink", target: bytes.toString("utf-8").trim() };
    }
    return { type: "file", size: bytes.length, bytes };
  }
}

export function createGitLabFileReader(client: GitLabClient): RepoFileReader {
  return {
    readEntry: (request) =>
      client.readEntry(request.repo, request.path, request.ref, request.maxBytes, request.signal),
  };
}
