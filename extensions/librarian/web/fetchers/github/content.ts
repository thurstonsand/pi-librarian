import { type Static, Type } from "typebox";
import { GitHubApiError, type GitHubRequest } from "../../../github.ts";
import type { FetchedDocument } from "../../contract.ts";
import { writeDocumentBody } from "../../shared.ts";
import { escapeTableCell, type GitHubFetchContext } from "./shared.ts";
import type { DirectoryTarget, FileTarget, GitHubRepo, RefPathTarget } from "./urls.ts";

const DIRECTORY_LIMIT = 1000;
const RAW_CONTENT_LIMIT = 100 * 1024 * 1024;

const CONTENT_FILE_SCHEMA = Type.Object({
  type: Type.String(),
  name: Type.String(),
  path: Type.String(),
  size: Type.Number(),
  content: Type.Optional(Type.String()),
  encoding: Type.Optional(Type.String()),
  html_url: Type.Union([Type.String(), Type.Null()]),
});

type ContentFile = Static<typeof CONTENT_FILE_SCHEMA>;

const DIRECTORY_ENTRY_SCHEMA = Type.Object({
  type: Type.String(),
  name: Type.String(),
  path: Type.String(),
  size: Type.Number(),
});

// The object media type answers a directory with its entries wrapped, rather than a bare array.
const DIRECTORY_SCHEMA = Type.Object({
  type: Type.Literal("dir"),
  html_url: Type.Union([Type.String(), Type.Null()]),
  entries: Type.Array(DIRECTORY_ENTRY_SCHEMA),
});

type DirectoryEntry = Static<typeof DIRECTORY_ENTRY_SCHEMA>;

const CONTENT_TYPE_SCHEMA = Type.Object({ type: Type.String() });

function contentsRequest(
  context: GitHubFetchContext,
  target: GitHubRepo & { path: string; ref?: string | undefined },
): GitHubRequest {
  return {
    route: "GET /repos/{owner}/{repo}/contents/{path}",
    params: {
      owner: target.owner,
      repo: target.repo,
      path: target.path,
      ...(target.ref ? { ref: target.ref } : {}),
      mediaType: { format: "object" },
    },
    operation: `read ${target.owner}/${target.repo}/${target.path}`,
    signal: context.signal,
  };
}

export async function fetchFile(
  context: GitHubFetchContext,
  target: FileTarget,
): Promise<FetchedDocument> {
  const item = await context.client.get(contentsRequest(context, target), CONTENT_FILE_SCHEMA);
  if (item.type === "dir") {
    throw new Error(`Expected file but GitHub returned a directory: ${target.path}`);
  }
  return buildFileDocument(context, "github.file", target, item);
}

export async function fetchReadme(
  context: GitHubFetchContext,
  target: GitHubRepo & { url: string },
): Promise<FetchedDocument> {
  const item = await context.client.get(
    {
      route: "GET /repos/{owner}/{repo}/readme",
      params: { owner: target.owner, repo: target.repo, mediaType: { format: "object" } },
      operation: `README of ${target.owner}/${target.repo}`,
      signal: context.signal,
    },
    CONTENT_FILE_SCHEMA,
  );
  return buildFileDocument(context, "github.readme", target, item);
}

async function buildFileDocument(
  context: GitHubFetchContext,
  kind: "github.file" | "github.readme",
  target: GitHubRepo & { url: string; ref?: string | undefined },
  item: ContentFile,
): Promise<FetchedDocument> {
  const content = await readContentFile(context, target, item);
  const body = await writeDocumentBody(context.artifactDir, target.url, item.name, content);
  return {
    kind,
    source: context.source,
    url: target.url,
    link: item.html_url ?? undefined,
    title:
      kind === "github.readme"
        ? `${target.owner}/${target.repo} README`
        : `${target.owner}/${target.repo}:${item.path}`,
    facts: [
      `repo ${target.owner}/${target.repo}`,
      ...(target.ref ? [`ref ${target.ref}`] : []),
      `path ${item.path}`,
      ...(Buffer.isBuffer(content) ? ["binary"] : []),
      ...(kind === "github.readme"
        ? [`whole repository: git clone ${context.webUrl}/${target.owner}/${target.repo}.git`]
        : []),
    ],
    excerpt: Buffer.isBuffer(content) ? undefined : content,
    bodies: [body],
  };
}

export async function fetchDirectory(
  context: GitHubFetchContext,
  target: DirectoryTarget,
): Promise<FetchedDocument> {
  const directory = await context.client.get(contentsRequest(context, target), DIRECTORY_SCHEMA);
  const entries = directory.entries;
  const likelyIncomplete = entries.length >= DIRECTORY_LIMIT;
  const title = `${target.owner}/${target.repo}:${target.path || "/"}`;
  return {
    kind: "github.directory",
    source: context.source,
    url: target.url,
    title,
    link: directory.html_url ?? undefined,
    facts: [
      `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`,
      ...(likelyIncomplete ? ["listing may be incomplete"] : []),
    ],
    excerpt: entries
      .map((entry) => (entry.type === "dir" ? `${entry.name}/` : entry.name))
      .join(", "),
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "listing.md",
        renderDirectoryMarkdown(title, entries, likelyIncomplete),
      ),
    ],
  };
}

// Above 1 MB the object form returns 200 with empty content; only the raw media type serves it.
async function readContentFile(
  context: GitHubFetchContext,
  target: GitHubRepo & { ref?: string | undefined },
  item: ContentFile,
): Promise<string | Buffer> {
  if (item.encoding === "base64" && item.content) {
    return decodeTextOrBuffer(Buffer.from(item.content.replace(/\n/g, ""), "base64"));
  }
  if (item.content) return item.content;
  if (item.size > RAW_CONTENT_LIMIT) {
    throw new Error(`GitHub raw file exceeds ${RAW_CONTENT_LIMIT} byte limit.`);
  }
  return decodeTextOrBuffer(
    await context.client.getRaw(
      contentsRequest(context, {
        owner: target.owner,
        repo: target.repo,
        path: item.path,
        ref: target.ref,
      }),
    ),
  );
}

function decodeTextOrBuffer(buffer: Buffer): string | Buffer {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return buffer;
  }
}

export async function resolveRefPath(
  context: GitHubFetchContext,
  target: RefPathTarget,
  expected: "file" | "directory",
): Promise<GitHubRepo & { ref: string; path: string }> {
  for (let index = 1; index < target.parts.length; index += 1) {
    const ref = target.parts.slice(0, index).join("/");
    const contentPath = target.parts.slice(index).join("/");
    try {
      const content = await context.client.get(
        contentsRequest(context, {
          owner: target.owner,
          repo: target.repo,
          path: contentPath,
          ref,
        }),
        CONTENT_TYPE_SCHEMA,
      );
      const isDirectory = content.type === "dir";
      if ((expected === "directory" && isDirectory) || (expected === "file" && !isDirectory)) {
        return { owner: target.owner, repo: target.repo, ref, path: contentPath };
      }
    } catch (error) {
      // A 404 means this split names no ref or no path; the next one may.
      if (!(error instanceof GitHubApiError && error.status === 404)) throw error;
    }
  }
  throw new Error(`Could not resolve GitHub ${target.marker} URL ref/path split.`);
}

function renderDirectoryMarkdown(
  title: string,
  entries: DirectoryEntry[],
  incomplete: boolean,
): string {
  const lines = [`# ${title}`, "", "| Type | Path | Size |", "| --- | --- | --- |"];
  for (const entry of entries) {
    lines.push(
      `| ${escapeTableCell(entry.type)} | ${escapeTableCell(entry.path)} | ${entry.size} |`,
    );
  }
  if (incomplete) lines.push("", "[listing may be incomplete: GitHub returned 1,000 entries]");
  return lines.join("\n");
}
