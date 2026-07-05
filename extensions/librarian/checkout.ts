import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const FETCH_DEBOUNCE_MS = 15 * 60 * 1000;

export class CheckoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutError";
  }
}

export interface CheckoutResult {
  repo: string;
  path: string;
  headSha: string;
  ref: string;
  fileCount: number;
  reusedClone: boolean;
}

interface RepoReference {
  key: string;
  cloneUrls: string[];
}

export function repoCachePath(cacheDir: string, repo: string): string {
  return path.join(cacheDir, "repos", ...repo.split("/"));
}

function isGitHubHost(host: string): boolean {
  return host === "github.com" || host === "www.github.com";
}

function normalizeRepoPath(rawPath: string): string | undefined {
  const repoPath = rawPath.replace(/^\/+/, "").replace(/\.git$/, "");
  const parts = repoPath.split("/");
  if (parts.length < 2 || parts.some((part) => !/^[\w.-]+$/.test(part))) {
    return undefined;
  }
  return parts.join("/");
}

function cloneKey(host: string, repoPath: string): string {
  return isGitHubHost(host) ? repoPath : `${host}/${repoPath}`;
}

function parseRepoReference(input: string): RepoReference {
  const trimmed = input.trim().replace(/\/+$/, "");
  const githubPath = normalizeRepoPath(trimmed);
  if (githubPath && githubPath.split("/").length === 2) {
    return {
      key: githubPath,
      cloneUrls: [`https://github.com/${githubPath}.git`, `git@github.com:${githubPath}.git`],
    };
  }

  const scpMatch = /^(?<user>[\w.-]+)@(?<host>[\w.-]+):(?<path>[\w./-]+?)(?:\.git)?$/.exec(trimmed);
  if (scpMatch?.groups) {
    const user = scpMatch.groups.user;
    const host = scpMatch.groups.host;
    const repoPath = scpMatch.groups.path ? normalizeRepoPath(scpMatch.groups.path) : undefined;
    if (user && host && repoPath && (!isGitHubHost(host) || repoPath.split("/").length === 2)) {
      return {
        key: cloneKey(host, repoPath),
        cloneUrls: [`${user}@${host}:${repoPath}.git`],
      };
    }
  }

  let url: URL;
  try {
    url = new URL(trimmed.replace(/\.git$/, ""));
  } catch {
    throw new CheckoutError(
      `Invalid repository "${input}". Use owner/repo or an HTTPS/SSH repository URL.`,
    );
  }

  if (url.protocol !== "https:" && url.protocol !== "ssh:") {
    throw new CheckoutError(
      `Invalid repository "${input}". Use owner/repo or an HTTPS/SSH repository URL.`,
    );
  }

  const repoPath = normalizeRepoPath(url.pathname);
  if (!repoPath || (isGitHubHost(url.hostname) && repoPath.split("/").length !== 2)) {
    throw new CheckoutError(
      `Invalid repository "${input}". Use owner/repo or an HTTPS/SSH repository URL.`,
    );
  }

  const key = cloneKey(url.hostname, repoPath);
  if (url.protocol === "ssh:") {
    const user = url.username || "git";
    return { key, cloneUrls: [`ssh://${user}@${url.hostname}/${repoPath}.git`] };
  }

  if (isGitHubHost(url.hostname)) {
    return {
      key,
      cloneUrls: [`https://github.com/${repoPath}.git`, `git@github.com:${repoPath}.git`],
    };
  }

  return {
    key,
    cloneUrls: [`https://${url.hostname}/${repoPath}.git`, `git@${url.hostname}:${repoPath}.git`],
  };
}

export function parseRepoName(input: string): string {
  return parseRepoReference(input).key;
}

async function git(
  args: string[],
  cwd: string | undefined,
  signal: AbortSignal | undefined,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", args, {
      ...(cwd ? { cwd } : {}),
      ...(signal ? { signal } : {}),
      timeout: 300_000,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    return stdout.trim();
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message = stderr.trim() || (error instanceof Error ? error.message : String(error));
    throw new CheckoutError(`git ${args[0]} failed: ${message.slice(0, 500)}`);
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function currentRemoteKey(
  dest: string,
  signal: AbortSignal | undefined,
): Promise<string | undefined> {
  try {
    return parseRepoReference(await git(["remote", "get-url", "origin"], dest, signal)).key;
  } catch {
    return undefined;
  }
}

async function clone(
  reference: RepoReference,
  dest: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  await fs.mkdir(path.dirname(dest), { recursive: true });

  let lastError: unknown;
  for (const url of reference.cloneUrls) {
    try {
      await git(["clone", "--filter=blob:none", url, dest], undefined, signal);
      return;
    } catch (error) {
      lastError = error;
      await fs.rm(dest, { recursive: true, force: true });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new CheckoutError(`Failed to clone ${reference.key}.`);
}

async function fetchIfStale(dest: string, signal: AbortSignal | undefined): Promise<void> {
  let lastFetched = 0;
  try {
    const stat = await fs.stat(path.join(dest, ".git", "FETCH_HEAD"));
    lastFetched = stat.mtimeMs;
  } catch {
    // Never fetched since clone; the clone itself counts only via HEAD age, so fetch.
  }

  if (Date.now() - lastFetched < FETCH_DEBOUNCE_MS) {
    return;
  }

  await git(["fetch", "origin", "--prune"], dest, signal);
}

async function defaultBranch(dest: string, signal: AbortSignal | undefined): Promise<string> {
  try {
    const ref = await git(["symbolic-ref", "refs/remotes/origin/HEAD"], dest, signal);
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    await git(["remote", "set-head", "origin", "--auto"], dest, signal);
    const ref = await git(["symbolic-ref", "refs/remotes/origin/HEAD"], dest, signal);
    return ref.replace("refs/remotes/origin/", "");
  }
}

export async function checkoutRepo(
  repoInput: string,
  ref: string | undefined,
  cacheDir: string,
  signal: AbortSignal | undefined,
): Promise<CheckoutResult> {
  const repo = parseRepoReference(repoInput);
  const dest = repoCachePath(cacheDir, repo.key);

  const reusedClone =
    (await pathExists(path.join(dest, ".git"))) &&
    (await currentRemoteKey(dest, signal)) === repo.key;
  if (!reusedClone) {
    await fs.rm(dest, { recursive: true, force: true });
  }

  if (reusedClone) {
    await fetchIfStale(dest, signal);
  } else {
    await clone(repo, dest, signal);
  }

  let checkedOutRef: string;
  if (ref) {
    try {
      await git(["fetch", "origin", ref], dest, signal);
      await git(["checkout", "--force", "--detach", "FETCH_HEAD"], dest, signal);
    } catch {
      // Refs already fetched (e.g. a sha reachable from an earlier fetch) check out directly.
      await git(["checkout", "--force", "--detach", ref], dest, signal);
    }
    await git(["reset", "--hard", "HEAD"], dest, signal);
    checkedOutRef = ref;
  } else {
    const branch = await defaultBranch(dest, signal);
    await git(["checkout", "--force", branch], dest, signal);
    await git(["reset", "--hard", `origin/${branch}`], dest, signal);
    checkedOutRef = branch;
  }

  await git(["clean", "-fdx"], dest, signal);

  const headSha = await git(["rev-parse", "HEAD"], dest, signal);
  const files = await git(["ls-files"], dest, signal);
  const fileCount = files.length === 0 ? 0 : files.split("\n").length;

  return { repo: repo.key, path: dest, headSha, ref: checkedOutRef, fileCount, reusedClone };
}
