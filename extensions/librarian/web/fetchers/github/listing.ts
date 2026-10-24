import { type Static, Type } from "typebox";
import type { FetchedDocument } from "../../contract.ts";
import { writeDocumentBody } from "../../shared.ts";
import {
  escapeTableCell,
  formatState,
  GITHUB_USER_SCHEMA,
  type GitHubFetchContext,
} from "./shared.ts";
import type { ListTarget } from "./urls.ts";

const LISTING_LIMIT = 100;

const SEARCH_ISSUE_ITEM_SCHEMA = Type.Object({
  number: Type.Number(),
  title: Type.String(),
  state: Type.String(),
  state_reason: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  draft: Type.Optional(Type.Boolean()),
  pull_request: Type.Optional(
    Type.Object({ merged_at: Type.Optional(Type.Union([Type.String(), Type.Null()])) }),
  ),
  user: GITHUB_USER_SCHEMA,
  labels: Type.Array(Type.Object({ name: Type.String() })),
  comments: Type.Number(),
  updated_at: Type.String(),
  html_url: Type.String(),
});

const SEARCH_ISSUES_SCHEMA = Type.Object({
  total_count: Type.Number(),
  items: Type.Array(SEARCH_ISSUE_ITEM_SCHEMA),
});

type SearchIssueItem = Static<typeof SEARCH_ISSUE_ITEM_SCHEMA>;

export async function fetchListing(
  context: GitHubFetchContext,
  target: ListTarget,
): Promise<FetchedDocument> {
  const query = buildListQuery(target);
  const response = await context.client.get(
    {
      route: "GET /search/issues",
      params: { q: query, per_page: LISTING_LIMIT },
      operation: "issue search",
      signal: context.signal,
    },
    SEARCH_ISSUES_SCHEMA,
  );
  const items = response.items;
  const title = `${target.owner}/${target.repo} ${target.tab}: ${query}`;
  const total = response.total_count;
  const capped = total > items.length;

  return {
    kind: target.tab === "issues" ? "github.issue_list" : "github.pull_request_list",
    source: context.source,
    url: target.url,
    title,
    facts: [
      capped ? `${total} matches, showing first ${items.length}` : `${total} matches`,
      `query: ${query}`,
    ],
    excerpt: renderListingExcerpt(items),
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "listing.md",
        renderListingMarkdown(title, items),
      ),
    ],
  };
}

function renderListingExcerpt(items: SearchIssueItem[]): string | undefined {
  if (items.length === 0) return undefined;
  return items
    .map(
      (item) =>
        `#${item.number} [${formatState(item)}] ${item.title} (${item.comments} comment${item.comments === 1 ? "" : "s"})`,
    )
    .join("\n");
}

function renderListingMarkdown(title: string, items: SearchIssueItem[]): string {
  const lines = [
    `# ${title}`,
    "",
    "| Number | Title | State | Author | Labels | Comments | Updated | URL |",
    "| --- | --- | --- | --- | --- | ---: | --- | --- |",
  ];
  for (const item of items) {
    lines.push(
      `| #${item.number} | ${escapeTableCell(item.title)} | ${escapeTableCell(formatState(item))} | ${escapeTableCell(item.user?.login ?? "")} | ${escapeTableCell(
        item.labels.map((label) => label.name).join(", "),
      )} | ${item.comments} | ${escapeTableCell(item.updated_at)} | ${escapeTableCell(item.html_url)} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function buildListQuery(target: ListTarget): string {
  const repoQualifier = `repo:${target.owner}/${target.repo}`;
  const userQuery = target.q?.trim();
  if (!userQuery) {
    return `${repoQualifier} ${target.tab === "issues" ? "is:issue" : "is:pr"} state:open`;
  }

  const typeQualifier = hasTypeQualifier(userQuery)
    ? undefined
    : target.tab === "issues"
      ? "is:issue"
      : "is:pr";
  return [repoQualifier, typeQualifier, userQuery].filter(isPresent).join(" ");
}

function hasTypeQualifier(query: string): boolean {
  return /(?:^|\s)(?:is:(?:issue|pr)|type:(?:issue|pr))(?:\s|$)/i.test(query);
}

function isPresent(value: string | undefined): value is string {
  return value !== undefined;
}
