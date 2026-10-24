import { type Static, Type } from "typebox";
import { parseTypeBoxValue, safeParseTypeBoxValue } from "../shared/typebox.ts";
import {
  EntryNotFoundError,
  EntryTooLargeError,
  type RepoEntry,
  type RepoEntryType,
  type RepoFileReader,
  submoduleUrl,
} from "./repo-entry.ts";

export class BitbucketApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BitbucketApiError";
  }
}

const ERRORS_SCHEMA = Type.Object({
  errors: Type.Array(Type.Object({ message: Type.String() })),
});

const REPOSITORY_SCHEMA = Type.Object({
  slug: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  archived: Type.Optional(Type.Boolean()),
  project: Type.Object({ key: Type.String() }),
});

const CODE_HIT_SCHEMA = Type.Object({
  repository: REPOSITORY_SCHEMA,
  file: Type.String(),
  hitContexts: Type.Array(Type.Array(Type.Object({ line: Type.Number(), text: Type.String() }))),
  hitCount: Type.Number(),
});

const CODE_RESULT_SCHEMA = Type.Object({
  code: Type.Object({
    count: Type.Number(),
    isLastPage: Type.Boolean(),
    values: Type.Array(Type.Unknown()),
  }),
});

export interface BitbucketRepository {
  repo: string;
  name: string;
  description: string | undefined;
  archived: boolean;
}

export interface BitbucketCodeHit {
  repo: string;
  path: string;
  hitCount: number;
  lines: { lineNumber: number; text: string }[];
}

export interface BitbucketCodeResult {
  // Capped by the server at 10,000.
  count: number;
  isLastPage: boolean;
  hits: BitbucketCodeHit[];
}

const PAGE_SCHEMA = Type.Object({
  isLastPage: Type.Boolean(),
  values: Type.Array(Type.Unknown()),
});

const LISTING_PAGE_SIZE = 1000;
const MAX_LISTING_PAGES = 20;

const BROWSE_SCHEMA = Type.Object({
  children: Type.Object({
    isLastPage: Type.Boolean(),
    nextPageStart: Type.Optional(Type.Number()),
    values: Type.Array(
      Type.Object({
        path: Type.Object({ name: Type.String() }),
        type: Type.String(),
        size: Type.Optional(Type.Number()),
      }),
    ),
  }),
});

// Hit contexts arrive HTML-escaped, with the matched text wrapped in <em>.
function decodeHit(text: string): string {
  return text
    .replace(/<\/?em>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function repository(parsed: Static<typeof REPOSITORY_SCHEMA>): BitbucketRepository {
  return {
    repo: `${parsed.project.key}/${parsed.slug}`,
    name: parsed.name,
    description: parsed.description || undefined,
    archived: parsed.archived ?? false,
  };
}

function browseType(type: string): RepoEntryType {
  switch (type) {
    case "DIRECTORY":
      return "directory";
    case "SUBMODULE":
      return "submodule";
    default:
      return "file";
  }
}

function splitRepo(repo: string): { project: string; slug: string } {
  const [project, slug, ...rest] = repo.split("/");
  if (!project || !slug || rest.length > 0) {
    throw new Error(`Bitbucket repositories are PROJECT/repo; "${repo}" is not.`);
  }
  return { project, slug };
}

export class BitbucketClient {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private async request(
    path: string,
    init: { method?: "GET" | "POST"; params?: Record<string, string | undefined>; body?: unknown },
    signal: AbortSignal | undefined,
  ): Promise<Response> {
    const url = new URL(path, this.url);
    for (const [key, value] of Object.entries(init.params ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
    const response = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${this.token}`,
        "user-agent": "pi-librarian",
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) {
      const text = await response.text();
      let message = text.slice(0, 200);
      try {
        const parsed = safeParseTypeBoxValue(ERRORS_SCHEMA, JSON.parse(text));
        if (parsed?.errors[0]) {
          message = parsed.errors[0].message;
        }
      } catch {
        // Not JSON; keep the body.
      }
      if (response.status === 401) {
        throw new BitbucketApiError(`Bitbucket rejected the token (401): ${message}`, 401);
      }
      throw new BitbucketApiError(`Bitbucket API ${response.status}: ${message}`, response.status);
    }
    return response;
  }

  async searchCode(
    query: string,
    limit: number,
    signal: AbortSignal | undefined,
  ): Promise<BitbucketCodeResult> {
    const response = await this.request(
      "/rest/search/latest/search",
      {
        method: "POST",
        body: {
          query,
          entities: { code: { start: 0, limit } },
          limits: { primary: limit, secondary: 10 },
        },
      },
      signal,
    );
    const parsed = safeParseTypeBoxValue(CODE_RESULT_SCHEMA, await response.json());
    if (!parsed) {
      throw new Error("Bitbucket code search returned an unexpected payload shape.");
    }
    const hits: BitbucketCodeHit[] = [];
    for (const value of parsed.code.values) {
      const hit = parseTypeBoxValue(CODE_HIT_SCHEMA, value, "Bitbucket code search result");
      hits.push({
        repo: repository(hit.repository).repo,
        path: hit.file,
        hitCount: hit.hitCount,
        lines: hit.hitContexts
          .flat()
          .filter((line) => line.text.includes("<em>"))
          .map((line) => ({ lineNumber: line.line, text: decodeHit(line.text) })),
      });
    }
    return { count: parsed.code.count, isLastPage: parsed.code.isLastPage, hits };
  }

  async searchRepositories(
    params: { name: string | undefined; project: string | undefined; limit: number },
    signal: AbortSignal | undefined,
  ): Promise<{ repositories: BitbucketRepository[]; isLastPage: boolean }> {
    const response = await this.request(
      "/rest/api/1.0/repos",
      { params: { name: params.name, projectkey: params.project, limit: String(params.limit) } },
      signal,
    );
    const parsed = safeParseTypeBoxValue(PAGE_SCHEMA, await response.json());
    if (!parsed) {
      throw new Error("Bitbucket repository search returned an unexpected payload shape.");
    }
    return {
      repositories: parsed.values.map((value) =>
        repository(parseTypeBoxValue(REPOSITORY_SCHEMA, value, "Bitbucket repository")),
      ),
      isLastPage: parsed.isLastPage,
    };
  }

  // An unknown project key is a silent zero in code search, so emptiness is checked against this.
  async projectExists(project: string, signal: AbortSignal | undefined): Promise<boolean> {
    try {
      await this.request(`/rest/api/1.0/projects/${encodeURIComponent(project)}`, {}, signal);
      return true;
    } catch (error) {
      if (error instanceof BitbucketApiError && error.status === 404) {
        return false;
      }
      throw error;
    }
  }

  async readEntry(
    repo: string,
    path: string,
    ref: string | undefined,
    maxBytes: number,
    signal: AbortSignal | undefined,
  ): Promise<RepoEntry> {
    const { project, slug } = splitRepo(repo);
    const base = `/rest/api/1.0/projects/${encodeURIComponent(project)}/repos/${encodeURIComponent(slug)}`;
    const cleanPath = path.replace(/^\/+|\/+$/g, "");
    const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
    const location = `${repo}/${cleanPath}${ref ? ` at ${ref}` : ""}`;
    // A listing reads every page: an entry on page two is not absent.
    const browse = async (browsePath: string) => {
      try {
        const children: { path: { name: string }; type: string; size?: number }[] = [];
        let start = 0;
        for (let page = 0; page < MAX_LISTING_PAGES; page += 1) {
          const response = await this.request(
            `${base}/browse${browsePath ? `/${browsePath}` : ""}`,
            { params: { at: ref, limit: String(LISTING_PAGE_SIZE), start: String(start) } },
            signal,
          );
          const parsed = parseTypeBoxValue(
            BROWSE_SCHEMA,
            await response.json(),
            "Bitbucket browse",
          );
          children.push(...parsed.children.values);
          if (parsed.children.isLastPage || parsed.children.nextPageStart === undefined) {
            return children;
          }
          start = parsed.children.nextPageStart;
        }
        throw new Error(
          `${repo}/${browsePath} has more than ${MAX_LISTING_PAGES * LISTING_PAGE_SIZE} entries; clone it with checkout_repo and list it locally.`,
        );
      } catch (error) {
        if (error instanceof BitbucketApiError && error.status === 404) {
          throw new EntryNotFoundError(`Not found: ${location}.\n${error.message}`);
        }
        throw error;
      }
    };

    const slash = cleanPath.lastIndexOf("/");
    const parent = slash === -1 ? "" : cleanPath.slice(0, slash);
    const name = slash === -1 ? cleanPath : cleanPath.slice(slash + 1);
    let type: RepoEntryType = "directory";
    let size: number | undefined;
    if (cleanPath) {
      const siblings = await browse(parent.split("/").map(encodeURIComponent).join("/"));
      const entry = siblings.find((sibling) => sibling.path.name === name);
      if (!entry) {
        throw new EntryNotFoundError(
          `Not found: ${location}. Paths are case-sensitive; list ${parent || "the repository root"} to see what is there.`,
        );
      }
      type = browseType(entry.type);
      size = entry.size;
    }

    if (type === "directory") {
      const children = await browse(encodedPath);
      return {
        type: "directory",
        entries: children.map((child) => ({ name: child.path.name, type: browseType(child.type) })),
      };
    }
    if (type === "submodule") {
      try {
        const gitmodules = await this.request(
          `${base}/raw/.gitmodules`,
          { params: { at: ref } },
          signal,
        );
        return { type: "submodule", url: submoduleUrl(await gitmodules.text(), cleanPath) };
      } catch (error) {
        if (error instanceof BitbucketApiError && error.status === 404) {
          return { type: "submodule", url: undefined };
        }
        throw error;
      }
    }
    if (size !== undefined && size > maxBytes) {
      throw new EntryTooLargeError(size);
    }
    const raw = await this.request(`${base}/raw/${encodedPath}`, { params: { at: ref } }, signal);
    const bytes = Buffer.from(await raw.arrayBuffer());
    return { type: "file", size: bytes.length, bytes };
  }
}

export function createBitbucketFileReader(client: BitbucketClient): RepoFileReader {
  return {
    readEntry: (request) =>
      client.readEntry(request.repo, request.path, request.ref, request.maxBytes, request.signal),
  };
}
