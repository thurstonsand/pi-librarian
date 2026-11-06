import { type Static, Type } from "typebox";
import type { FetchedDocument } from "../../contract.ts";
import { writeDocumentBody } from "../../shared.ts";
import { GITHUB_USER_SCHEMA, type GitHubFetchContext } from "./shared.ts";
import type { DiscussionTarget } from "./urls.ts";

const DISCUSSION_COMMENT_LIMIT = 100;
const DISCUSSION_REPLY_LIMIT = 100;

const PAGE_INFO_SCHEMA = Type.Object({ hasNextPage: Type.Boolean() });

const DISCUSSION_REPLY_SCHEMA = Type.Object({
  author: GITHUB_USER_SCHEMA,
  body: Type.String(),
  createdAt: Type.String(),
});

const DISCUSSION_COMMENT_SCHEMA = Type.Object({
  author: GITHUB_USER_SCHEMA,
  body: Type.String(),
  createdAt: Type.String(),
  isAnswer: Type.Boolean(),
  replies: Type.Object({
    nodes: Type.Array(DISCUSSION_REPLY_SCHEMA),
    pageInfo: PAGE_INFO_SCHEMA,
  }),
});

const DISCUSSION_SCHEMA = Type.Object({
  title: Type.String(),
  number: Type.Number(),
  url: Type.String(),
  body: Type.String(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  answerChosenAt: Type.Union([Type.String(), Type.Null()]),
  author: GITHUB_USER_SCHEMA,
  category: Type.Object({ name: Type.String() }),
  labels: Type.Object({ nodes: Type.Array(Type.Object({ name: Type.String() })) }),
  comments: Type.Object({
    nodes: Type.Array(DISCUSSION_COMMENT_SCHEMA),
    pageInfo: PAGE_INFO_SCHEMA,
  }),
});

const DISCUSSION_QUERY_SCHEMA = Type.Object({
  repository: Type.Union([
    Type.Object({ discussion: Type.Union([DISCUSSION_SCHEMA, Type.Null()]) }),
    Type.Null(),
  ]),
});

type Discussion = Static<typeof DISCUSSION_SCHEMA>;

const DISCUSSION_QUERY = `
  query Discussion($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      discussion(number: $number) {
        title
        number
        url
        body
        createdAt
        updatedAt
        answerChosenAt
        author { login }
        category { name }
        labels(first: 100) { nodes { name } }
        comments(first: ${DISCUSSION_COMMENT_LIMIT}) {
          nodes {
            author { login }
            body
            createdAt
            updatedAt
            isAnswer
            replies(first: ${DISCUSSION_REPLY_LIMIT}) {
              nodes {
                author { login }
                body
                createdAt
                updatedAt
              }
              pageInfo { hasNextPage }
            }
          }
          pageInfo { hasNextPage }
        }
      }
    }
  }
`;

export async function fetchDiscussion(
  context: GitHubFetchContext,
  target: DiscussionTarget,
): Promise<FetchedDocument> {
  const response = await context.client.graphql(
    DISCUSSION_QUERY,
    { owner: target.owner, repo: target.repo, number: target.number },
    DISCUSSION_QUERY_SCHEMA,
    `discussion ${target.owner}/${target.repo}#${target.number}`,
    context.signal,
  );
  const discussion = response.repository?.discussion;
  if (!discussion) {
    throw new Error(`GitHub discussion #${target.number} was not found.`);
  }
  const repliesTruncated = discussion.comments.nodes.some(
    (comment) => comment.replies.pageInfo.hasNextPage,
  );
  const commentsTruncated = discussion.comments.pageInfo.hasNextPage;

  return {
    kind: "github.discussion",
    source: context.source,
    url: target.url,
    link: discussion.url,
    title: `${target.owner}/${target.repo}#${discussion.number}: ${discussion.title}`,
    facts: [
      `category ${discussion.category.name}`,
      ...(discussion.author?.login ? [`by ${discussion.author.login}`] : []),
      discussion.answerChosenAt ? "answered" : "unanswered",
      `${discussion.comments.nodes.length} comment${discussion.comments.nodes.length === 1 ? "" : "s"}`,
      ...(discussion.labels.nodes.length > 0
        ? [`labels ${discussion.labels.nodes.map((label) => label.name).join(", ")}`]
        : []),
      ...(commentsTruncated || repliesTruncated ? ["conversation capped; see discussion.md"] : []),
    ],
    excerpt: discussion.body || discussion.comments.nodes[0]?.body,
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "discussion.md",
        renderDiscussionMarkdown(discussion, commentsTruncated),
      ),
    ],
  };
}

function renderDiscussionMarkdown(discussion: Discussion, commentsTruncated: boolean): string {
  const lines = [
    `# ${discussion.title}`,
    "",
    `- Author: ${discussion.author?.login ?? "unknown"}`,
    `- Category: ${discussion.category.name}`,
    `- Created: ${discussion.createdAt}`,
    `- Updated: ${discussion.updatedAt}`,
    `- Answered: ${discussion.answerChosenAt ? `yes, at ${discussion.answerChosenAt}` : "no"}`,
    `- URL: ${discussion.url}`,
    "",
    "## Body",
    "",
    discussion.body || "(no body)",
    "",
    "## Comments",
  ];

  if (discussion.comments.nodes.length === 0) lines.push("", "(none)");
  for (const comment of discussion.comments.nodes) {
    lines.push(
      "",
      `### ${comment.author?.login ?? "unknown"} at ${comment.createdAt}${comment.isAnswer ? " (answer)" : ""}`,
      "",
      comment.body,
    );
    for (const reply of comment.replies.nodes) {
      lines.push(
        "",
        `#### Reply from ${reply.author?.login ?? "unknown"} at ${reply.createdAt}`,
        "",
        reply.body,
      );
    }
    if (comment.replies.pageInfo.hasNextPage) {
      lines.push("", `[replies capped at ${DISCUSSION_REPLY_LIMIT}]`);
    }
  }
  if (commentsTruncated) lines.push("", `[comments capped at ${DISCUSSION_COMMENT_LIMIT}]`);
  return `${lines.join("\n")}\n`;
}
