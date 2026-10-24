import { type Static, Type } from "typebox";
import type { FetchedDocument } from "../../contract.ts";
import { writeDocumentBody } from "../../shared.ts";
import { escapeTableCell, GITHUB_USER_SCHEMA, type GitHubFetchContext } from "./shared.ts";
import type { GitHubRepo, ReleaseTarget } from "./urls.ts";

export const RELEASE_SCHEMA = Type.Object({
  name: Type.Union([Type.String(), Type.Null()]),
  tag_name: Type.String(),
  html_url: Type.String(),
  target_commitish: Type.String(),
  draft: Type.Boolean(),
  prerelease: Type.Boolean(),
  author: GITHUB_USER_SCHEMA,
  created_at: Type.String(),
  published_at: Type.Union([Type.String(), Type.Null()]),
  body: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  assets: Type.Array(
    Type.Object({
      name: Type.String(),
      content_type: Type.String(),
      size: Type.Number(),
      download_count: Type.Number(),
      browser_download_url: Type.String(),
    }),
  ),
});

export type GitHubRelease = Static<typeof RELEASE_SCHEMA>;

export async function fetchRelease(
  context: GitHubFetchContext,
  target: ReleaseTarget,
): Promise<FetchedDocument> {
  const release = await context.client.get(
    {
      route: "GET /repos/{owner}/{repo}/releases/tags/{tag}",
      params: { owner: target.owner, repo: target.repo, tag: target.tag },
      operation: `release ${target.tag} of ${target.owner}/${target.repo}`,
      signal: context.signal,
    },
    RELEASE_SCHEMA,
  );
  return await buildReleaseDocument(context, target, release);
}

export async function fetchLatestRelease(
  context: GitHubFetchContext,
  target: GitHubRepo & { url: string },
): Promise<FetchedDocument> {
  const release = await context.client.get(
    {
      route: "GET /repos/{owner}/{repo}/releases/latest",
      params: { owner: target.owner, repo: target.repo },
      operation: `latest release of ${target.owner}/${target.repo}`,
      signal: context.signal,
    },
    RELEASE_SCHEMA,
  );
  return await buildReleaseDocument(context, target, release);
}

async function buildReleaseDocument(
  context: GitHubFetchContext,
  target: GitHubRepo & { url: string },
  release: GitHubRelease,
): Promise<FetchedDocument> {
  const title = release.name || release.tag_name;
  return {
    kind: "github.release",
    source: context.source,
    url: target.url,
    link: release.html_url,
    title: `${target.owner}/${target.repo} ${title}`,
    facts: [
      `tag ${release.tag_name}`,
      ...(release.draft ? ["draft"] : []),
      ...(release.prerelease ? ["prerelease"] : []),
      ...(release.author?.login ? [`by ${release.author.login}`] : []),
      ...(release.published_at ? [`published ${release.published_at}`] : []),
      `${release.assets.length} asset${release.assets.length === 1 ? "" : "s"}`,
    ],
    excerpt: release.body ?? undefined,
    bodies: [
      await writeDocumentBody(
        context.artifactDir,
        target.url,
        "release.md",
        renderReleaseMarkdown(release),
      ),
    ],
  };
}

function renderReleaseMarkdown(release: GitHubRelease): string {
  const lines = [
    `# ${release.name || release.tag_name}`,
    "",
    `- Tag: ${release.tag_name}`,
    `- Target: ${release.target_commitish}`,
    `- Author: ${release.author?.login ?? "unknown"}`,
    `- Created: ${release.created_at}`,
    `- Published: ${release.published_at ?? "not published"}`,
    `- Draft: ${release.draft ? "yes" : "no"}`,
    `- Prerelease: ${release.prerelease ? "yes" : "no"}`,
    `- URL: ${release.html_url}`,
    "",
    "## Release notes",
    "",
    release.body ?? "(no release notes)",
    "",
    "## Assets",
    "",
  ];

  if (release.assets.length === 0) {
    lines.push("(none)");
    return lines.join("\n");
  }

  lines.push(
    "| Name | Content type | Size | Downloads | URL |",
    "| --- | --- | ---: | ---: | --- |",
  );
  for (const asset of release.assets) {
    lines.push(
      `| ${escapeTableCell(asset.name)} | ${escapeTableCell(asset.content_type)} | ${asset.size} | ${asset.download_count} | ${escapeTableCell(asset.browser_download_url)} |`,
    );
  }
  return lines.join("\n");
}
