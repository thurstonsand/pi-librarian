import { type Static, Type } from "typebox";
import type { GitHubRequest } from "../../../github.ts";
import type { FetchedDocument } from "../../contract.ts";
import { writeDocumentBody } from "../../shared.ts";
import {
  appendIssueComments,
  appendTimeline,
  type GitHubIssueComment,
  ISSUE_COMMENT_LIMIT,
  type IssueTimeline,
  listIssueComments,
  listIssueTimeline,
} from "./issue.ts";
import { type CappedResult, listWithCap } from "./pagination.ts";
import {
  escapeTableCell,
  GITHUB_USER_SCHEMA,
  type GitHubFetchContext,
  truncateUtf8Bytes,
} from "./shared.ts";
import type { PullRequestTarget } from "./urls.ts";

const PR_REVIEW_LIMIT = 100;
const PR_REVIEW_COMMENT_LIMIT = 200;
const PR_FILE_LIMIT = 300;
const PATCH_TEXT_LIMIT = 400_000;

const PULL_REQUEST_SCHEMA = Type.Object({
  title: Type.String(),
  html_url: Type.String(),
  state: Type.String(),
  user: GITHUB_USER_SCHEMA,
  draft: Type.Optional(Type.Boolean()),
  merged: Type.Boolean(),
  base: Type.Object({ label: Type.String() }),
  head: Type.Object({ label: Type.String() }),
  additions: Type.Number(),
  deletions: Type.Number(),
  changed_files: Type.Number(),
  commits: Type.Number(),
  body: Type.Union([Type.String(), Type.Null()]),
});

const REVIEW_SCHEMA = Type.Object({
  user: GITHUB_USER_SCHEMA,
  body: Type.String(),
  state: Type.String(),
});

type GitHubReview = Static<typeof REVIEW_SCHEMA>;

const REVIEW_COMMENT_SCHEMA = Type.Object({
  user: GITHUB_USER_SCHEMA,
  body: Type.String(),
  path: Type.String(),
  diff_hunk: Type.String(),
});

type GitHubReviewComment = Static<typeof REVIEW_COMMENT_SCHEMA>;

const PULL_REQUEST_FILE_SCHEMA = Type.Object({
  filename: Type.String(),
  status: Type.String(),
  additions: Type.Number(),
  deletions: Type.Number(),
  previous_filename: Type.Optional(Type.String()),
  patch: Type.Optional(Type.String()),
});

interface GitHubPullRequestFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  previous_filename: string | undefined;
  patch: string | undefined;
  patch_truncated: boolean;
}

type GitHubPullRequestRenderModel = {
  issue_comments_truncated: boolean;
  reviews_truncated: boolean;
  review_comments_truncated: boolean;
  files_truncated: boolean;
  title: string;
  html_url: string;
  state: string;
  author: string | undefined;
  draft: boolean;
  merged: boolean;
  base: string;
  head: string;
  additions: number;
  deletions: number;
  changed_files: number;
  commits: number;
  body: string | null;
  timeline: IssueTimeline;
  issue_comments: GitHubIssueComment[];
  reviews: GitHubReview[];
  review_comments: GitHubReviewComment[];
  files: GitHubPullRequestFile[];
};

export async function fetchPullRequest(
  context: GitHubFetchContext,
  target: PullRequestTarget,
): Promise<FetchedDocument> {
  const pr = await context.client.get(
    {
      route: "GET /repos/{owner}/{repo}/pulls/{pull_number}",
      params: {
        owner: target.owner,
        repo: target.repo,
        pull_number: target.number,
        mediaType: { format: "full" },
      },
      operation: `pull request ${target.owner}/${target.repo}#${target.number}`,
      signal: context.signal,
    },
    PULL_REQUEST_SCHEMA,
  );
  const [timeline, issueComments, reviews, reviewComments, files] = await Promise.all([
    listIssueTimeline(context, target),
    listIssueComments(context, target, ISSUE_COMMENT_LIMIT),
    listWithCap(PR_REVIEW_LIMIT, (page, perPage) =>
      context.client.get(
        pullRequestListRequest(context, target, "reviews", page, perPage),
        Type.Array(REVIEW_SCHEMA),
      ),
    ),
    listWithCap(PR_REVIEW_COMMENT_LIMIT, (page, perPage) =>
      context.client.get(
        pullRequestListRequest(context, target, "comments", page, perPage),
        Type.Array(REVIEW_COMMENT_SCHEMA),
      ),
    ),
    listPullRequestFiles(context, target),
  ]);
  const model: GitHubPullRequestRenderModel = {
    issue_comments_truncated: issueComments.truncated,
    reviews_truncated: reviews.truncated,
    review_comments_truncated: reviewComments.truncated,
    files_truncated: files.truncated,
    title: `${target.owner}/${target.repo}#${target.number}: ${pr.title}`,
    html_url: pr.html_url,
    state: pr.state,
    author: pr.user?.login,
    draft: pr.draft ?? false,
    merged: pr.merged,
    base: pr.base.label,
    head: pr.head.label,
    additions: pr.additions,
    deletions: pr.deletions,
    changed_files: pr.changed_files,
    commits: pr.commits,
    body: pr.body,
    timeline,
    issue_comments: issueComments.items,
    reviews: reviews.items,
    review_comments: reviewComments.items,
    files: files.items,
  };
  return {
    kind: "github.pull_request",
    source: context.source,
    url: target.url,
    link: pr.html_url,
    title: model.title,
    facts: [
      `${pr.state}${pr.draft ? " draft" : ""}${pr.merged ? " merged" : ""}`,
      ...(pr.user?.login ? [`by ${pr.user.login}`] : []),
      `+${pr.additions} -${pr.deletions}`,
      `${pr.changed_files} file${pr.changed_files === 1 ? "" : "s"}`,
      `${issueComments.items.length} issue comment${issueComments.items.length === 1 ? "" : "s"}`,
      `${reviews.items.length} review${reviews.items.length === 1 ? "" : "s"}`,
      ...(issueComments.truncated ||
      reviews.truncated ||
      reviewComments.truncated ||
      files.truncated ||
      timeline.truncated
        ? ["some lists capped; see conversation.md markers"]
        : []),
    ],
    excerpt: pr.body ?? issueComments.items[0]?.body ?? undefined,
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "conversation.md",
        renderPullRequestMarkdown(model),
      ),
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "diff.patch",
        renderPullRequestPatch(files.items),
      ),
    ],
  };
}

function pullRequestListRequest(
  context: GitHubFetchContext,
  target: PullRequestTarget,
  list: "reviews" | "comments" | "files",
  page: number,
  perPage: number,
): GitHubRequest {
  return {
    route: `GET /repos/{owner}/{repo}/pulls/{pull_number}/${list}`,
    params: {
      owner: target.owner,
      repo: target.repo,
      pull_number: target.number,
      page,
      per_page: perPage,
      ...(list === "files" ? {} : { mediaType: { format: "full" } }),
    },
    operation: `${list === "comments" ? "review comments" : list} of ${target.owner}/${target.repo}#${target.number}`,
    signal: context.signal,
  };
}

async function listPullRequestFiles(
  context: GitHubFetchContext,
  target: PullRequestTarget,
): Promise<CappedResult<GitHubPullRequestFile>> {
  let patchBytes = 0;
  return listWithCap(PR_FILE_LIMIT, async (page, perPage) => {
    const files = await context.client.get(
      pullRequestListRequest(context, target, "files", page, perPage),
      Type.Array(PULL_REQUEST_FILE_SCHEMA),
    );
    return files.map((file) => {
      const patch = file.patch;
      let patch_truncated = false;
      let cappedPatch = patch;
      if (patch) {
        const remaining = PATCH_TEXT_LIMIT - patchBytes;
        if (remaining <= 0) {
          cappedPatch = undefined;
          patch_truncated = true;
        } else if (Buffer.byteLength(patch, "utf8") > remaining) {
          cappedPatch = truncateUtf8Bytes(patch, remaining);
          patch_truncated = true;
          patchBytes = PATCH_TEXT_LIMIT;
        } else {
          patchBytes += Buffer.byteLength(patch, "utf8");
        }
      }
      return {
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        previous_filename: file.previous_filename,
        patch_truncated,
        patch: cappedPatch,
      };
    });
  });
}

function renderPullRequestMarkdown(pr: GitHubPullRequestRenderModel): string {
  const lines = [
    `# ${pr.title}`,
    "",
    `- State: ${pr.state}${pr.draft ? " (draft)" : ""}${pr.merged ? " (merged)" : ""}`,
    `- Author: ${pr.author ?? "unknown"}`,
    `- Base: ${pr.base}`,
    `- Head: ${pr.head}`,
    `- Changes: +${pr.additions} -${pr.deletions} across ${pr.changed_files} file(s)`,
    `- Commits: ${pr.commits}`,
    `- URL: ${pr.html_url}`,
    "",
    "## Body",
    "",
    pr.body ?? "(no body)",
  ];

  appendTimeline(lines, pr.timeline);
  appendIssueComments(lines, pr.issue_comments, pr.issue_comments_truncated, "Issue comments");
  appendReviews(lines, pr.reviews, pr.reviews_truncated);
  appendReviewComments(lines, pr.review_comments, pr.review_comments_truncated);
  appendPullRequestFiles(lines, pr.files, pr.files_truncated);
  return lines.join("\n");
}

function appendReviews(lines: string[], reviews: GitHubReview[], truncated: boolean): void {
  lines.push("", "## Reviews");
  if (reviews.length === 0) lines.push("", "(none)");
  for (const review of reviews) {
    lines.push("", `### ${review.state} by ${review.user?.login ?? "unknown"}`, "", review.body);
  }
  if (truncated) lines.push("", "[reviews truncated]");
}

function appendReviewComments(
  lines: string[],
  comments: GitHubReviewComment[],
  truncated: boolean,
): void {
  lines.push("", "## Review comments");
  if (comments.length === 0) lines.push("", "(none)");
  for (const comment of comments) {
    lines.push(
      "",
      `### ${comment.path} by ${comment.user?.login ?? "unknown"}`,
      "",
      comment.diff_hunk ? `\`\`\`diff\n${comment.diff_hunk}\n\`\`\`\n` : "",
      comment.body,
    );
  }
  if (truncated) lines.push("", "[review comments truncated]");
}

function renderPullRequestPatch(files: GitHubPullRequestFile[]): string {
  return files
    .flatMap((file) => {
      if (!file.patch) return [];
      const oldPath = file.previous_filename ?? file.filename;
      return [
        `diff --git a/${oldPath} b/${file.filename}`,
        `--- a/${oldPath}`,
        `+++ b/${file.filename}`,
        file.patch,
        file.patch_truncated ? "[patch truncated]" : "",
      ];
    })
    .filter(Boolean)
    .join("\n");
}

function appendPullRequestFiles(
  lines: string[],
  files: GitHubPullRequestFile[],
  truncated: boolean,
): void {
  lines.push("", "## Files", "", "| Status | File | + | - |", "| --- | --- | ---: | ---: |");
  for (const file of files) {
    lines.push(
      `| ${escapeTableCell(file.status)} | ${escapeTableCell(file.filename)} | ${file.additions} | ${file.deletions} |`,
    );
  }
  if (truncated) lines.push("", "[files truncated]");
}
