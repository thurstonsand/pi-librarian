import { Type } from "typebox";
import { parseTypeBoxValue } from "../../../typebox.js";
import { writeDocumentBody } from "../../shared.js";
import { listWithCap } from "./pagination.js";
import { formatState, GITHUB_USER_SCHEMA } from "./shared.js";
export const ISSUE_COMMENT_LIMIT = 200;
const TIMELINE_LIMIT = 300;
const ISSUE_SCHEMA = Type.Object({
    title: Type.String(),
    html_url: Type.String(),
    state: Type.String(),
    state_reason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    user: GITHUB_USER_SCHEMA,
    created_at: Type.String(),
    updated_at: Type.String(),
    body: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    comments: Type.Number(),
    labels: Type.Array(Type.Object({ name: Type.String() })),
});
const ISSUE_COMMENT_SCHEMA = Type.Object({
    user: GITHUB_USER_SCHEMA,
    body: Type.Optional(Type.String()),
    created_at: Type.String(),
});
// Timeline items share only `event`; each kept kind is validated by its own schema below.
const TIMELINE_ITEM_SCHEMA = Type.Object({ event: Type.String() });
const COMMIT_EVENT_SCHEMA = Type.Object({
    actor: GITHUB_USER_SCHEMA,
    created_at: Type.String(),
    commit_id: Type.Union([Type.String(), Type.Null()]),
    commit_url: Type.Union([Type.String(), Type.Null()]),
    state_reason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});
const PLAIN_EVENT_SCHEMA = Type.Object({
    actor: GITHUB_USER_SCHEMA,
    created_at: Type.String(),
});
const CROSS_REFERENCED_EVENT_SCHEMA = Type.Object({
    actor: Type.Optional(GITHUB_USER_SCHEMA),
    created_at: Type.String(),
    source: Type.Object({
        issue: Type.Object({
            number: Type.Number(),
            title: Type.String(),
            state: Type.String(),
            state_reason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
            draft: Type.Optional(Type.Boolean()),
            repository_url: Type.String(),
            pull_request: Type.Optional(Type.Object({ merged_at: Type.Optional(Type.Union([Type.String(), Type.Null()])) })),
        }),
    }),
});
export async function fetchIssue(context, target) {
    const issue = await context.client.get({
        route: "GET /repos/{owner}/{repo}/issues/{issue_number}",
        params: {
            owner: target.owner,
            repo: target.repo,
            issue_number: target.number,
            mediaType: { format: "full" },
        },
        operation: `issue ${target.owner}/${target.repo}#${target.number}`,
        signal: context.signal,
    }, ISSUE_SCHEMA);
    const [comments, timeline] = await Promise.all([
        listIssueComments(context, target, ISSUE_COMMENT_LIMIT),
        listIssueTimeline(context, target),
    ]);
    const labels = issue.labels.map((label) => label.name);
    const closingCommit = issue.state === "closed" && !timeline.truncated ? timeline.closingCommit : undefined;
    const model = {
        title: `${target.owner}/${target.repo}#${target.number}: ${issue.title}`,
        html_url: issue.html_url,
        state: issue.state,
        state_reason: issue.state_reason,
        author: issue.user?.login,
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        body: issue.body,
        timeline,
        comments: comments.items,
        comments_truncated: comments.truncated,
    };
    return {
        kind: "github.issue",
        source: context.source,
        url: target.url,
        link: issue.html_url,
        title: model.title,
        facts: [
            `${issue.state}${issue.state_reason ? ` (${issue.state_reason})` : ""}`,
            ...(closingCommit ? [`closed by commit ${closingCommit.slice(0, 7)}`] : []),
            ...(issue.user?.login ? [`by ${issue.user.login}`] : []),
            `${issue.comments} comment${issue.comments === 1 ? "" : "s"}`,
            ...(comments.truncated ? [`comments capped at ${ISSUE_COMMENT_LIMIT}`] : []),
            ...(timeline.truncated ? [`timeline capped at ${TIMELINE_LIMIT} events`] : []),
            ...(labels.length > 0 ? [`labels ${labels.join(", ")}`] : []),
        ],
        excerpt: issue.body ?? comments.items[0]?.body ?? undefined,
        bodies: [
            await writeDocumentBody(context.artifactDir, target.url, "conversation.md", renderIssueMarkdown(model)),
        ],
    };
}
export async function listIssueComments(context, target, limit) {
    return listWithCap(limit, (page, perPage) => context.client.get({
        route: "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
        params: {
            owner: target.owner,
            repo: target.repo,
            issue_number: target.number,
            page,
            per_page: perPage,
            mediaType: { format: "full" },
        },
        operation: `comments on ${target.owner}/${target.repo}#${target.number}`,
        signal: context.signal,
    }, Type.Array(ISSUE_COMMENT_SCHEMA)));
}
// A raw timeline is mostly noise (subscriptions, mentions, labels); only the events that say how an
// issue was resolved, or what referenced it, are kept.
export async function listIssueTimeline(context, target) {
    const operation = `timeline of ${target.owner}/${target.repo}#${target.number}`;
    const items = await listWithCap(TIMELINE_LIMIT, (page, perPage) => context.client.get({
        route: "GET /repos/{owner}/{repo}/issues/{issue_number}/timeline",
        params: {
            owner: target.owner,
            repo: target.repo,
            issue_number: target.number,
            page,
            per_page: perPage,
        },
        operation,
        signal: context.signal,
    }, Type.Array(TIMELINE_ITEM_SCHEMA)));
    const repo = `${target.owner}/${target.repo}`;
    const entries = [];
    let closingCommit;
    for (const item of items.items) {
        const what = `GitHub ${operation}: ${item.event} event`;
        switch (item.event) {
            case "closed":
            case "merged":
            case "referenced": {
                const event = parseTypeBoxValue(COMMIT_EVENT_SCHEMA, item, what);
                if (item.event === "closed")
                    closingCommit = event.commit_id ?? undefined;
                entries.push({
                    createdAt: event.created_at,
                    actor: event.actor?.login,
                    event: item.event,
                    detail: commitEventDetail(repo, COMMIT_PREPOSITIONS[item.event], event),
                });
                break;
            }
            case "reopened":
            case "connected": {
                const event = parseTypeBoxValue(PLAIN_EVENT_SCHEMA, item, what);
                entries.push({
                    createdAt: event.created_at,
                    actor: event.actor?.login,
                    event: item.event,
                    detail: undefined,
                });
                break;
            }
            case "cross-referenced": {
                const event = parseTypeBoxValue(CROSS_REFERENCED_EVENT_SCHEMA, item, what);
                const issue = event.source.issue;
                entries.push({
                    createdAt: event.created_at,
                    actor: event.actor?.login,
                    event: item.event,
                    detail: `from ${issue.pull_request ? "PR" : "issue"} ${repositoryName(issue.repository_url)}#${issue.number} [${formatState(issue)}] ${issue.title}`,
                });
                break;
            }
        }
    }
    return { entries, truncated: items.truncated, closingCommit };
}
const COMMIT_PREPOSITIONS = { closed: "by", merged: "as", referenced: "from" };
// A `referenced` commit often lives in a fork or a downstream packaging repo, which says nothing
// about a fix here, so a foreign repository is named.
function commitEventDetail(repo, preposition, event) {
    const parts = [];
    if (event.commit_id) {
        const commitRepo = event.commit_url
            ? /\/repos\/([^/]+\/[^/]+)\/commits\//.exec(event.commit_url)?.[1]
            : undefined;
        const foreign = commitRepo && commitRepo.toLowerCase() !== repo.toLowerCase();
        parts.push(`${preposition} commit ${event.commit_id.slice(0, 7)}${foreign ? ` in ${commitRepo}` : ""}`);
    }
    if (event.state_reason)
        parts.push(`(${event.state_reason})`);
    return parts.length > 0 ? parts.join(" ") : undefined;
}
function repositoryName(repositoryUrl) {
    return new URL(repositoryUrl).pathname.split("/").slice(-2).join("/");
}
function renderIssueMarkdown(issue) {
    const lines = [
        `# ${issue.title}`,
        "",
        `- State: ${issue.state}${issue.state_reason ? ` (${issue.state_reason})` : ""}`,
        `- Author: ${issue.author ?? "unknown"}`,
        `- Created: ${issue.created_at}`,
        `- Updated: ${issue.updated_at}`,
        `- URL: ${issue.html_url}`,
        "",
        "## Body",
        "",
        issue.body ?? "(no body)",
    ];
    appendTimeline(lines, issue.timeline);
    appendIssueComments(lines, issue.comments, issue.comments_truncated);
    return lines.join("\n");
}
export function appendTimeline(lines, timeline) {
    lines.push("", "## Timeline", "");
    if (timeline.entries.length === 0)
        lines.push("(none)");
    for (const entry of timeline.entries) {
        lines.push(`- ${entry.createdAt.slice(0, 10)} ${entry.actor ?? "unknown"} ${entry.event}${entry.detail ? ` ${entry.detail}` : ""}`);
    }
    if (timeline.truncated)
        lines.push("", `[timeline capped at ${TIMELINE_LIMIT} events]`);
}
export function appendIssueComments(lines, comments, truncated, title = "Comments") {
    lines.push("", `## ${title}`);
    if (comments.length === 0) {
        lines.push("", "(none)");
    }
    for (const comment of comments) {
        lines.push("", `### ${comment.user?.login ?? "unknown"} at ${comment.created_at}`, "", comment.body ?? "");
    }
    if (truncated)
        lines.push("", "[comments truncated]");
}
