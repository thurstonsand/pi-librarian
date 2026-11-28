import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);
const FETCH_DEBOUNCE_MS = 15 * 60 * 1000;
export class CheckoutError extends Error {
    constructor(message) {
        super(message);
        this.name = "CheckoutError";
    }
}
const GUIDANCE_FILES = ["AGENTS.md", "CLAUDE.md"];
export function repoCachePath(cacheDir, repo) {
    return path.join(cacheDir, "repos", ...repo.split("/"));
}
function normalizeRepoPath(rawPath, input) {
    const repoPath = rawPath.replace(/^\/+/, "").replace(/\.git$/, "");
    const parts = repoPath.split("/");
    // Bitbucket Server names a personal repository's project ~user.
    if (parts.some((part, index) => !(index === 0 ? /^~?[\w.-]+$/ : /^[\w.-]+$/).test(part))) {
        throw invalidRepo(input);
    }
    return parts.join("/");
}
// Bitbucket Server serves HTTPS clones under /scm/; the repository itself, and its SSH URL, carry
// no such prefix, so identity must exclude it or one repo gets two cache keys.
function stripScmPrefix(repoPath) {
    return /^scm\//i.test(repoPath) ? repoPath.slice("scm/".length) : repoPath;
}
function declaredKind(sources, hostname) {
    return sources.find((source) => new URL(source.url).hostname.toLowerCase() === hostname)?.kind;
}
function invalidRepo(input) {
    return new CheckoutError(`Invalid repository "${input}". Pass a host-relative repository path with source, or an HTTPS/SSH repository URL without source.`);
}
// Identity is host plus repository path, and it is the cache path, so it must name a repository
// exactly once. A port is transport — keeping it would give one repository two entries. Case is
// presentation — git sources treat paths case-insensitively, and on a case-insensitive filesystem two
// spellings fight over one directory.
function repoIdentity(host, repoPath) {
    return `${host.replace(/:\d+$/, "")}/${repoPath}`.toLowerCase();
}
function parseUrlReference(trimmed, input, sources) {
    let url;
    try {
        url = new URL(trimmed.replace(/\.git$/, ""));
    }
    catch {
        throw invalidRepo(input);
    }
    if (url.protocol !== "https:" && url.protocol !== "ssh:") {
        throw invalidRepo(input);
    }
    const urlRepoPath = normalizeRepoPath(url.pathname, input);
    const host = url.host.toLowerCase();
    const stripsScm = url.protocol === "https:" &&
        declaredKind(sources, url.hostname.toLowerCase()) === "bitbucket-server";
    const repoPath = stripsScm ? stripScmPrefix(urlRepoPath) : urlRepoPath;
    const user = url.username || "git";
    const cloneUrl = url.protocol === "https:"
        ? `https://${host}/${urlRepoPath}.git`
        : `ssh://${user}@${host}/${urlRepoPath}.git`;
    return { key: repoIdentity(host, repoPath), cloneUrls: [cloneUrl] };
}
function parseScpReference(trimmed, input) {
    const match = /^(?<user>[\w.-]+)@(?<host>[\w.-]+):(?<path>[\w./-]+?)(?:\.git)?$/.exec(trimmed);
    if (!match?.groups) {
        return undefined;
    }
    const user = match.groups.user;
    const rawHost = match.groups.host;
    const rawPath = match.groups.path;
    if (!user || !rawHost || !rawPath) {
        throw invalidRepo(input);
    }
    const host = rawHost.toLowerCase();
    const repoPath = normalizeRepoPath(rawPath, input);
    return {
        key: repoIdentity(host, repoPath),
        cloneUrls: [`${user}@${host}:${repoPath}.git`],
    };
}
function parseCloneUrlReference(trimmed, input, sources) {
    return /^[a-z][\w+.-]*:\/\//i.test(trimmed)
        ? parseUrlReference(trimmed, input, sources)
        : parseScpReference(trimmed, input);
}
export function cloneSources(sources) {
    return sources.filter((source) => source.roles.includes("clone"));
}
function resolveCloneSource(sources, sourceName) {
    const candidates = cloneSources(sources);
    const source = candidates.find((source) => source.name === sourceName);
    if (source) {
        return source;
    }
    const usable = `Pass an HTTPS/SSH clone URL, or use one of: ${candidates.map((source) => source.name).join(", ")}.`;
    const declared = sources.find((source) => source.name === sourceName);
    if (declared) {
        const reason = declared.kind === "sourcegraph" ? "kind sourcegraph" : "cloning disabled in settings";
        throw new CheckoutError(`Source "${sourceName}" cannot clone (${reason}). ${usable}`);
    }
    throw new CheckoutError(`Unknown source "${sourceName}". ${usable}`);
}
function deriveReference(trimmed, input, source) {
    let repoPath = normalizeRepoPath(trimmed.replace(/^\/+/, ""), input);
    let prefix;
    switch (source.kind) {
        case "github":
            if (repoPath.split("/").length !== 2) {
                throw new CheckoutError(`Invalid repository "${input}" for source "${source.name}". GitHub requires exactly owner/repo.`);
            }
            prefix = "";
            break;
        case "gitlab":
            prefix = "";
            break;
        case "bitbucket-server":
            repoPath = stripScmPrefix(repoPath);
            prefix = "scm/";
            break;
    }
    const baseUrl = new URL(source.url);
    const host = baseUrl.host.toLowerCase();
    return {
        key: repoIdentity(host, repoPath),
        cloneUrls: [`${baseUrl.protocol}//${host}/${prefix}${repoPath}.git`],
    };
}
export function parseRepoReference(input, sources, sourceName) {
    const trimmed = input.trim().replace(/\/+$/, "");
    const cloneUrlReference = parseCloneUrlReference(trimmed, input, sources);
    if (cloneUrlReference) {
        if (sourceName) {
            throw new CheckoutError(`Repository "${input}" is already a clone URL. Remove source "${sourceName}".`);
        }
        return cloneUrlReference;
    }
    // With one clone source a shorthand can only mean that one, as a search tool over one instance
    // takes no source at all.
    const clonable = cloneSources(sources);
    const only = clonable.length === 1 ? clonable[0] : undefined;
    if (!sourceName && only) {
        return deriveReference(trimmed, input, only);
    }
    if (!sourceName) {
        throw new CheckoutError(`Repository "${input}" is a shorthand path. Pass source to select its code host, or pass an HTTPS/SSH clone URL.`);
    }
    return deriveReference(trimmed, input, resolveCloneSource(sources, sourceName));
}
// A credential helper can answer for a host and git then echoes the credential inside the URL it
// prints on failure. Never let that reach the model.
function redactCredentials(text) {
    return text.replace(/(\w+:\/\/)[^/\s@]*:[^/\s@]*@/g, "$1<redacted>@");
}
async function git(args, cwd, signal) {
    try {
        const { stdout } = await execFileAsync("git", args, {
            ...(cwd ? { cwd } : {}),
            ...(signal ? { signal } : {}),
            timeout: 300_000,
            maxBuffer: 32 * 1024 * 1024,
            env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
        });
        return stdout.trim();
    }
    catch (error) {
        const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
        const message = stderr.trim() || (error instanceof Error ? error.message : String(error));
        throw new CheckoutError(`git ${args[0]} failed: ${redactCredentials(message).slice(0, 500)}`);
    }
}
async function pathExists(target) {
    try {
        await fs.access(target);
        return true;
    }
    catch {
        return false;
    }
}
async function currentRemoteKey(dest, sources, signal) {
    try {
        const remoteUrl = await git(["remote", "get-url", "origin"], dest, signal);
        return parseCloneUrlReference(remoteUrl, remoteUrl, sources)?.key;
    }
    catch {
        return undefined;
    }
}
async function clone(reference, dest, signal) {
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const failures = [];
    for (const url of reference.cloneUrls) {
        try {
            await git(["clone", "--filter=blob:none", url, dest], undefined, signal);
            return;
        }
        catch (error) {
            failures.push(`${url}: ${error instanceof Error ? error.message : String(error)}`);
            await fs.rm(dest, { recursive: true, force: true });
        }
    }
    throw new CheckoutError(`Could not clone ${reference.key}. Tried ${failures.length} URL(s):\n${failures.join("\n")}\nPass the exact clone URL if this host uses a different layout, or check that credentials for it are configured.`);
}
async function fetchIfStale(dest, signal) {
    let lastFetched = 0;
    try {
        const stat = await fs.stat(path.join(dest, ".git", "FETCH_HEAD"));
        lastFetched = stat.mtimeMs;
    }
    catch {
        // Never fetched since clone; the clone itself counts only via HEAD age, so fetch.
    }
    if (Date.now() - lastFetched < FETCH_DEBOUNCE_MS) {
        return;
    }
    await git(["fetch", "origin", "--prune"], dest, signal);
}
async function defaultBranch(repo, dest, signal) {
    try {
        const ref = await git(["symbolic-ref", "refs/remotes/origin/HEAD"], dest, signal);
        return ref.replace("refs/remotes/origin/", "");
    }
    catch {
        try {
            await git(["remote", "set-head", "origin", "--auto"], dest, signal);
        }
        catch (error) {
            if (error instanceof Error && error.message.includes("Cannot determine remote HEAD")) {
                throw new CheckoutError(`Cloned ${repo}, but it has no remote HEAD and may be empty. Pass a ref after the repository has a commit.`);
            }
            throw error;
        }
        const ref = await git(["symbolic-ref", "refs/remotes/origin/HEAD"], dest, signal);
        return ref.replace("refs/remotes/origin/", "");
    }
}
export async function checkoutRepo(repoInput, sources, sourceName, ref, cacheDir, signal) {
    const repo = parseRepoReference(repoInput, sources, sourceName);
    const dest = repoCachePath(cacheDir, repo.key);
    const reusedClone = (await pathExists(path.join(dest, ".git"))) &&
        (await currentRemoteKey(dest, sources, signal)) === repo.key;
    if (!reusedClone) {
        await fs.rm(dest, { recursive: true, force: true });
    }
    if (reusedClone) {
        await fetchIfStale(dest, signal);
    }
    else {
        await clone(repo, dest, signal);
    }
    let checkedOutRef;
    if (ref) {
        try {
            await git(["fetch", "origin", ref], dest, signal);
            await git(["checkout", "--force", "--detach", "FETCH_HEAD"], dest, signal);
        }
        catch {
            // Refs already fetched (e.g. a sha reachable from an earlier fetch) check out directly.
            await git(["checkout", "--force", "--detach", ref], dest, signal);
        }
        await git(["reset", "--hard", "HEAD"], dest, signal);
        checkedOutRef = ref;
    }
    else {
        const branch = await defaultBranch(repo.key, dest, signal);
        await git(["checkout", "--force", branch], dest, signal);
        await git(["reset", "--hard", `origin/${branch}`], dest, signal);
        checkedOutRef = branch;
    }
    await git(["clean", "-fdx"], dest, signal);
    const headSha = await git(["rev-parse", "HEAD"], dest, signal);
    const files = await git(["ls-files"], dest, signal);
    const paths = files.length === 0 ? [] : files.split("\n");
    const guidance = GUIDANCE_FILES.filter((name) => paths.includes(name));
    return {
        repo: repo.key,
        path: dest,
        headSha,
        ref: checkedOutRef,
        fileCount: paths.length,
        guidance,
        reusedClone,
    };
}
