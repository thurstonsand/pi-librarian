import { Type } from "typebox";
import { EntryNotFoundError, EntryTooLargeError, submoduleUrl, } from "./repo-entry.js";
import { parseTypeBoxValue, safeParseTypeBoxValue } from "./typebox.js";
export class BitbucketApiError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
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
        values: Type.Array(Type.Object({
            path: Type.Object({ name: Type.String() }),
            type: Type.String(),
            size: Type.Optional(Type.Number()),
        })),
    }),
});
// Hit contexts arrive HTML-escaped, with the matched text wrapped in <em>.
function decodeHit(text) {
    return text
        .replace(/<\/?em>/g, "")
        .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)))
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
}
function repository(parsed) {
    return {
        repo: `${parsed.project.key}/${parsed.slug}`,
        name: parsed.name,
        description: parsed.description || undefined,
        archived: parsed.archived ?? false,
    };
}
function browseType(type) {
    switch (type) {
        case "DIRECTORY":
            return "directory";
        case "SUBMODULE":
            return "submodule";
        default:
            return "file";
    }
}
function splitRepo(repo) {
    const [project, slug, ...rest] = repo.split("/");
    if (!project || !slug || rest.length > 0) {
        throw new Error(`Bitbucket repositories are PROJECT/repo; "${repo}" is not.`);
    }
    return { project, slug };
}
export class BitbucketClient {
    url;
    token;
    constructor(url, token) {
        this.url = url;
        this.token = token;
    }
    // Resolves the token ahead of a search, so its time budget covers only the search.
    async authorize() {
        await this.token();
    }
    async request(path, init, signal) {
        const url = new URL(path, this.url);
        for (const [key, value] of Object.entries(init.params ?? {})) {
            if (value !== undefined) {
                url.searchParams.set(key, value);
            }
        }
        const response = await fetch(url, {
            method: init.method ?? "GET",
            headers: {
                authorization: `Bearer ${await this.token()}`,
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
            }
            catch {
                // Not JSON; keep the body.
            }
            if (response.status === 401) {
                throw new BitbucketApiError(`Bitbucket rejected the token (401): ${message}`, 401);
            }
            throw new BitbucketApiError(`Bitbucket API ${response.status}: ${message}`, response.status);
        }
        return response;
    }
    async searchCode(query, limit, signal) {
        const response = await this.request("/rest/search/latest/search", {
            method: "POST",
            body: {
                query,
                entities: { code: { start: 0, limit } },
                limits: { primary: limit, secondary: 10 },
            },
        }, signal);
        const parsed = safeParseTypeBoxValue(CODE_RESULT_SCHEMA, await response.json());
        if (!parsed) {
            throw new Error("Bitbucket code search returned an unexpected payload shape.");
        }
        const hits = [];
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
    async searchRepositories(params, signal) {
        const response = await this.request("/rest/api/1.0/repos", { params: { name: params.name, projectkey: params.project, limit: String(params.limit) } }, signal);
        const parsed = safeParseTypeBoxValue(PAGE_SCHEMA, await response.json());
        if (!parsed) {
            throw new Error("Bitbucket repository search returned an unexpected payload shape.");
        }
        return {
            repositories: parsed.values.map((value) => repository(parseTypeBoxValue(REPOSITORY_SCHEMA, value, "Bitbucket repository"))),
            isLastPage: parsed.isLastPage,
        };
    }
    // An unknown project key is a silent zero in code search, so emptiness is checked against this.
    async projectExists(project, signal) {
        try {
            await this.request(`/rest/api/1.0/projects/${encodeURIComponent(project)}`, {}, signal);
            return true;
        }
        catch (error) {
            if (error instanceof BitbucketApiError && error.status === 404) {
                return false;
            }
            throw error;
        }
    }
    async readEntry(repo, path, ref, maxBytes, signal) {
        const { project, slug } = splitRepo(repo);
        const base = `/rest/api/1.0/projects/${encodeURIComponent(project)}/repos/${encodeURIComponent(slug)}`;
        const cleanPath = path.replace(/^\/+|\/+$/g, "");
        const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
        const location = `${repo}/${cleanPath}${ref ? ` at ${ref}` : ""}`;
        // A listing reads every page: an entry on page two is not absent.
        const browse = async (browsePath) => {
            try {
                const children = [];
                let start = 0;
                for (let page = 0; page < MAX_LISTING_PAGES; page += 1) {
                    const response = await this.request(`${base}/browse${browsePath ? `/${browsePath}` : ""}`, { params: { at: ref, limit: String(LISTING_PAGE_SIZE), start: String(start) } }, signal);
                    const parsed = parseTypeBoxValue(BROWSE_SCHEMA, await response.json(), "Bitbucket browse");
                    children.push(...parsed.children.values);
                    if (parsed.children.isLastPage || parsed.children.nextPageStart === undefined) {
                        return children;
                    }
                    start = parsed.children.nextPageStart;
                }
                throw new Error(`${repo}/${browsePath} has more than ${MAX_LISTING_PAGES * LISTING_PAGE_SIZE} entries; clone it with checkout_repo and list it locally.`);
            }
            catch (error) {
                if (error instanceof BitbucketApiError && error.status === 404) {
                    throw new EntryNotFoundError(`Not found: ${location}.\n${error.message}`);
                }
                throw error;
            }
        };
        const slash = cleanPath.lastIndexOf("/");
        const parent = slash === -1 ? "" : cleanPath.slice(0, slash);
        const name = slash === -1 ? cleanPath : cleanPath.slice(slash + 1);
        let type = "directory";
        let size;
        if (cleanPath) {
            const siblings = await browse(parent.split("/").map(encodeURIComponent).join("/"));
            const entry = siblings.find((sibling) => sibling.path.name === name);
            if (!entry) {
                throw new EntryNotFoundError(`Not found: ${location}. Paths are case-sensitive; list ${parent || "the repository root"} to see what is there.`);
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
                const gitmodules = await this.request(`${base}/raw/.gitmodules`, { params: { at: ref } }, signal);
                return { type: "submodule", url: submoduleUrl(await gitmodules.text(), cleanPath) };
            }
            catch (error) {
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
export function createBitbucketFileReader(client) {
    return {
        readEntry: (request) => client.readEntry(request.repo, request.path, request.ref, request.maxBytes, request.signal),
    };
}
