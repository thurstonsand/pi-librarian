import { type Static, Type } from "typebox";
import type { FetchedDocument } from "../../contract.ts";
import { writeDocumentBody } from "../../shared.ts";
import { type CappedResult, listWithCap } from "./pagination.ts";
import {
  escapeTableCell,
  GIT_ACTOR_SCHEMA,
  GITHUB_USER_SCHEMA,
  type GitHubFetchContext,
  truncateUtf8Bytes,
} from "./shared.ts";
import type { CommitTarget } from "./urls.ts";

const COMMIT_FILE_LIMIT = 300;
const COMMIT_COMMENT_LIMIT = 100;
const PATCH_TEXT_LIMIT = 400_000;

const COMMIT_FILE_SCHEMA = Type.Object({
  filename: Type.String(),
  status: Type.String(),
  additions: Type.Number(),
  deletions: Type.Number(),
  changes: Type.Number(),
  previous_filename: Type.Optional(Type.String()),
  patch: Type.Optional(Type.String()),
});

const COMMIT_SCHEMA = Type.Object({
  sha: Type.String(),
  html_url: Type.String(),
  author: GITHUB_USER_SCHEMA,
  committer: GITHUB_USER_SCHEMA,
  commit: Type.Object({
    message: Type.String(),
    author: GIT_ACTOR_SCHEMA,
    committer: GIT_ACTOR_SCHEMA,
    verification: Type.Optional(Type.Object({ verified: Type.Boolean() })),
  }),
  stats: Type.Optional(
    Type.Object({
      additions: Type.Optional(Type.Number()),
      deletions: Type.Optional(Type.Number()),
    }),
  ),
});

const COMMIT_FILES_PAGE_SCHEMA = Type.Object({
  files: Type.Optional(Type.Array(COMMIT_FILE_SCHEMA)),
});

const COMMIT_COMMENT_SCHEMA = Type.Object({
  user: GITHUB_USER_SCHEMA,
  created_at: Type.String(),
  body: Type.String(),
});

type CommitResponse = Static<typeof COMMIT_SCHEMA>;
type CommitComment = Static<typeof COMMIT_COMMENT_SCHEMA>;

interface CommitFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  previous_filename: string | undefined;
  patch: string | undefined;
  patch_truncated: boolean;
}

export async function fetchCommit(
  context: GitHubFetchContext,
  target: CommitTarget,
): Promise<FetchedDocument> {
  const [commit, files, comments] = await Promise.all([
    context.client.get(
      {
        route: "GET /repos/{owner}/{repo}/commits/{ref}",
        params: { owner: target.owner, repo: target.repo, ref: target.ref, per_page: 1 },
        operation: `commit ${target.owner}/${target.repo}@${target.ref}`,
        signal: context.signal,
      },
      COMMIT_SCHEMA,
    ),
    listCommitFiles(context, target),
    listWithCap(COMMIT_COMMENT_LIMIT, (page, perPage) =>
      context.client.get(
        {
          route: "GET /repos/{owner}/{repo}/commits/{commit_sha}/comments",
          params: {
            owner: target.owner,
            repo: target.repo,
            commit_sha: target.ref,
            page,
            per_page: perPage,
          },
          operation: `comments on ${target.owner}/${target.repo}@${target.ref}`,
          signal: context.signal,
        },
        Type.Array(COMMIT_COMMENT_SCHEMA),
      ),
    ),
  ]);
  const summary = commit.commit.message.split("\n", 1)[0] || commit.sha;
  const author = commit.author?.login ?? commit.commit.author?.name;

  return {
    kind: "github.commit",
    source: context.source,
    url: target.url,
    link: commit.html_url,
    title: `${target.owner}/${target.repo}@${commit.sha.slice(0, 12)}: ${summary}`,
    facts: [
      ...(author ? [`by ${author}`] : []),
      ...(commit.commit.author?.date ? [`authored ${commit.commit.author.date}`] : []),
      `+${commit.stats?.additions ?? 0} -${commit.stats?.deletions ?? 0}`,
      `${files.items.length} file${files.items.length === 1 ? "" : "s"}${files.truncated ? ` shown (capped at ${COMMIT_FILE_LIMIT})` : ""}`,
      `${comments.items.length} comment${comments.items.length === 1 ? "" : "s"}`,
      ...(commit.commit.verification?.verified ? ["verified signature"] : []),
    ],
    excerpt: commit.commit.message,
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "commit.md",
        renderCommitMarkdown(commit, files, comments),
      ),
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "diff.patch",
        renderCommitPatch(files),
      ),
    ],
  };
}

async function listCommitFiles(
  context: GitHubFetchContext,
  target: CommitTarget,
): Promise<CappedResult<CommitFile>> {
  let patchBytes = 0;
  return await listWithCap(COMMIT_FILE_LIMIT, async (page, perPage) => {
    const response = await context.client.get(
      {
        route: "GET /repos/{owner}/{repo}/commits/{ref}",
        params: {
          owner: target.owner,
          repo: target.repo,
          ref: target.ref,
          page,
          per_page: perPage,
        },
        operation: `files of ${target.owner}/${target.repo}@${target.ref}`,
        signal: context.signal,
      },
      COMMIT_FILES_PAGE_SCHEMA,
    );
    return (response.files ?? []).map((file) => {
      const patch = file.patch;
      let cappedPatch = patch;
      let patchTruncated = false;
      if (patch) {
        const remaining = PATCH_TEXT_LIMIT - patchBytes;
        if (remaining <= 0) {
          cappedPatch = undefined;
          patchTruncated = true;
        } else if (Buffer.byteLength(patch, "utf8") > remaining) {
          cappedPatch = truncateUtf8Bytes(patch, remaining);
          patchBytes = PATCH_TEXT_LIMIT;
          patchTruncated = true;
        } else {
          patchBytes += Buffer.byteLength(patch, "utf8");
        }
      }
      return {
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        previous_filename: file.previous_filename,
        patch: cappedPatch,
        patch_truncated: patchTruncated,
      };
    });
  });
}

function renderCommitMarkdown(
  commit: CommitResponse,
  files: CappedResult<CommitFile>,
  comments: CappedResult<CommitComment>,
): string {
  const lines = [
    `# ${commit.commit.message.split("\n", 1)[0] || commit.sha}`,
    "",
    `- Commit: ${commit.sha}`,
    `- Author: ${commit.author?.login ?? commit.commit.author?.name ?? "unknown"}`,
    `- Authored: ${commit.commit.author?.date ?? "unknown"}`,
    `- Committer: ${commit.committer?.login ?? commit.commit.committer?.name ?? "unknown"}`,
    `- Committed: ${commit.commit.committer?.date ?? "unknown"}`,
    `- URL: ${commit.html_url}`,
    "",
    "## Message",
    "",
    commit.commit.message,
    "",
    "## Files",
    "",
    "| File | Status | Additions | Deletions | Changes |",
    "| --- | --- | ---: | ---: | ---: |",
  ];
  for (const file of files.items) {
    lines.push(
      `| ${escapeTableCell(file.filename)} | ${file.status} | ${file.additions} | ${file.deletions} | ${file.changes} |`,
    );
  }
  if (files.truncated) lines.push("", `[files capped at ${COMMIT_FILE_LIMIT}]`);

  lines.push("", "## Comments");
  if (comments.items.length === 0) lines.push("", "(none)");
  for (const comment of comments.items) {
    lines.push(
      "",
      `### ${comment.user?.login ?? "unknown"} at ${comment.created_at}`,
      "",
      comment.body,
    );
  }
  if (comments.truncated) lines.push("", `[comments capped at ${COMMIT_COMMENT_LIMIT}]`);
  return `${lines.join("\n")}\n`;
}

function renderCommitPatch(files: CappedResult<CommitFile>): string {
  const lines: string[] = [];
  for (const file of files.items) {
    lines.push(
      `diff --git a/${file.previous_filename ?? file.filename} b/${file.filename}`,
      `# status: ${file.status}; additions: ${file.additions}; deletions: ${file.deletions}`,
    );
    if (file.patch) lines.push(file.patch);
    else lines.push("[patch unavailable]");
    if (file.patch_truncated) lines.push("[patch truncated]");
    lines.push("");
  }
  if (files.truncated) lines.push(`[files capped at ${COMMIT_FILE_LIMIT}]`, "");
  return lines.join("\n");
}
