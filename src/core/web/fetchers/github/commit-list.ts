import { type Static, Type } from "typebox";
import { GitHubApiError, type GitHubRequest } from "../../../github.ts";
import type { FetchedDocument } from "../../contract.ts";
import { writeDocumentBody } from "../../shared.ts";
import { type CappedResult, listWithCap } from "./pagination.ts";
import {
  escapeTableCell,
  GIT_ACTOR_SCHEMA,
  GITHUB_USER_SCHEMA,
  type GitHubFetchContext,
} from "./shared.ts";
import type { CommitListTarget } from "./urls.ts";

const COMMIT_LIST_LIMIT = 100;
const EXCERPT_LIMIT = 20;

const COMMIT_LIST_ITEM_SCHEMA = Type.Object({
  sha: Type.String(),
  html_url: Type.String(),
  author: GITHUB_USER_SCHEMA,
  commit: Type.Object({ message: Type.String(), author: GIT_ACTOR_SCHEMA }),
});

const COMMIT_LIST_SCHEMA = Type.Array(COMMIT_LIST_ITEM_SCHEMA);

type CommitListItem = Static<typeof COMMIT_LIST_ITEM_SCHEMA>;

type ResolvedCommitList = {
  ref?: string | undefined;
  path?: string | undefined;
};

export async function fetchCommitList(
  context: GitHubFetchContext,
  target: CommitListTarget,
): Promise<FetchedDocument> {
  const resolved = await resolveCommitList(context, target);
  const commits = await listWithCap(COMMIT_LIST_LIMIT, (page, perPage) =>
    context.client.get(
      listCommitsRequest(context, target, resolved, page, perPage),
      COMMIT_LIST_SCHEMA,
    ),
  );

  const scope = [resolved.ref ?? "default branch", resolved.path].filter(Boolean).join(" ");
  const title = `${target.owner}/${target.repo} commits: ${scope}`;

  return {
    kind: "github.commit_list",
    source: context.source,
    url: target.url,
    title,
    facts: [
      `${commits.items.length} commit${commits.items.length === 1 ? "" : "s"}${commits.truncated ? ` shown (capped at ${COMMIT_LIST_LIMIT})` : ""}`,
      `ref: ${resolved.ref ?? "default branch"}`,
      ...(resolved.path ? [`path: ${resolved.path}`] : []),
    ],
    excerpt: renderCommitListExcerpt(commits.items),
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "commits.md",
        renderCommitListMarkdown(title, commits),
      ),
    ],
  };
}

// GitHub's commits URL packs ref and path into one slash-separated tail, and a
// ref may itself contain slashes, so the split is only knowable by asking the
// API which candidate yields commits.
async function resolveCommitList(
  context: GitHubFetchContext,
  target: CommitListTarget,
): Promise<ResolvedCommitList> {
  if (target.parts.length === 0) return {};
  if (target.parts.length === 1) return { ref: target.parts[0] };

  for (let index = 1; index <= target.parts.length; index += 1) {
    const candidate: ResolvedCommitList = {
      ref: target.parts.slice(0, index).join("/"),
      path: target.parts.slice(index).join("/") || undefined,
    };
    try {
      const commits = await context.client.get(
        listCommitsRequest(context, target, candidate, 1, 1),
        COMMIT_LIST_SCHEMA,
      );
      if (commits.length > 0) return candidate;
    } catch (error) {
      // A 404 means this split names no ref; the next one may.
      if (!(error instanceof GitHubApiError && error.status === 404)) throw error;
    }
  }
  throw new Error("Could not resolve GitHub commits URL ref/path split.");
}

function listCommitsRequest(
  context: GitHubFetchContext,
  target: CommitListTarget,
  resolved: ResolvedCommitList,
  page: number,
  perPage: number,
): GitHubRequest {
  return {
    route: "GET /repos/{owner}/{repo}/commits",
    params: {
      owner: target.owner,
      repo: target.repo,
      ...(resolved.ref ? { sha: resolved.ref } : {}),
      ...(resolved.path ? { path: resolved.path } : {}),
      page,
      per_page: perPage,
    },
    operation: `commit history of ${target.owner}/${target.repo}`,
    signal: context.signal,
  };
}

function renderCommitListExcerpt(items: CommitListItem[]): string | undefined {
  if (items.length === 0) return undefined;
  return items
    .slice(0, EXCERPT_LIMIT)
    .map((item) => `${item.sha.slice(0, 12)} ${commitSummary(item)}`)
    .join("\n");
}

function renderCommitListMarkdown(title: string, commits: CappedResult<CommitListItem>): string {
  const lines = [
    `# ${title}`,
    "",
    "| Commit | Summary | Author | Date | URL |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const item of commits.items) {
    lines.push(
      `| ${item.sha.slice(0, 12)} | ${escapeTableCell(commitSummary(item))} | ${escapeTableCell(
        item.author?.login ?? item.commit.author?.name ?? "unknown",
      )} | ${escapeTableCell(item.commit.author?.date ?? "unknown")} | ${escapeTableCell(item.html_url)} |`,
    );
  }
  if (commits.truncated) lines.push("", `[commits capped at ${COMMIT_LIST_LIMIT}]`);
  return `${lines.join("\n")}\n`;
}

function commitSummary(item: CommitListItem): string {
  return item.commit.message.split("\n", 1)[0] || item.sha;
}
