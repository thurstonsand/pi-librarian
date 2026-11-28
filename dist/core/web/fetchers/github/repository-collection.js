import { Type } from "typebox";
import { writeDocumentBody } from "../../shared.js";
import { listWithCap } from "./pagination.js";
import { RELEASE_SCHEMA } from "./release.js";
import { escapeTableCell } from "./shared.js";
const COLLECTION_LIMIT = 100;
const TAG_SCHEMA = Type.Object({
    name: Type.String(),
    commit: Type.Object({ sha: Type.String() }),
    zipball_url: Type.String(),
});
const BRANCH_SCHEMA = Type.Object({
    name: Type.String(),
    commit: Type.Object({ sha: Type.String() }),
    protected: Type.Boolean(),
});
export async function fetchRepositoryCollection(context, target) {
    function listPage(page, perPage) {
        return {
            route: `GET /repos/{owner}/{repo}/${target.collection}`,
            params: { owner: target.owner, repo: target.repo, page, per_page: perPage },
            operation: `${target.collection} of ${target.owner}/${target.repo}`,
            signal: context.signal,
        };
    }
    switch (target.collection) {
        case "releases":
            return await fetchCollection(context, target, {
                kind: "github.release_list",
                fetchPage: (page, perPage) => context.client.get(listPage(page, perPage), Type.Array(RELEASE_SCHEMA)),
                excerpt: (release) => release.name || release.tag_name,
                render: (releases, truncated) => renderReleases(target, releases, truncated),
            });
        case "tags":
            return await fetchCollection(context, target, {
                kind: "github.tag_list",
                fetchPage: (page, perPage) => context.client.get(listPage(page, perPage), Type.Array(TAG_SCHEMA)),
                excerpt: (tag) => tag.name,
                render: (tags, truncated) => renderTags(target, tags, truncated),
            });
        case "branches":
            return await fetchCollection(context, target, {
                kind: "github.branch_list",
                fetchPage: (page, perPage) => context.client.get(listPage(page, perPage), Type.Array(BRANCH_SCHEMA)),
                excerpt: (branch) => branch.name,
                render: (branches, truncated) => renderBranches(target, branches, truncated),
            });
    }
}
async function fetchCollection(context, target, spec) {
    const result = await listWithCap(COLLECTION_LIMIT, spec.fetchPage);
    return {
        kind: spec.kind,
        source: context.source,
        url: target.url,
        title: `${target.owner}/${target.repo} ${target.collection}`,
        facts: [
            `${result.items.length} ${target.collection}${result.truncated ? ` shown (capped at ${COLLECTION_LIMIT})` : ""}`,
        ],
        excerpt: result.items.map(spec.excerpt).join("\n") || undefined,
        bodies: [
            await writeDocumentBody(context.artifactDir, target.url, "listing.md", spec.render(result.items, result.truncated)),
        ],
    };
}
function renderReleases(target, releases, truncated) {
    const lines = [
        `# ${target.owner}/${target.repo} releases`,
        "",
        "| Name | Tag | State | Published | Author | Assets | URL |",
        "| --- | --- | --- | --- | --- | ---: | --- |",
    ];
    for (const release of releases) {
        const state = release.draft ? "draft" : release.prerelease ? "prerelease" : "published";
        lines.push(`| ${escapeTableCell(release.name ?? "")} | ${escapeTableCell(release.tag_name)} | ${state} | ${release.published_at ?? ""} | ${escapeTableCell(release.author?.login ?? "")} | ${release.assets.length} | ${escapeTableCell(release.html_url)} |`);
    }
    appendCap(lines, truncated);
    return `${lines.join("\n")}\n`;
}
function renderTags(target, tags, truncated) {
    const lines = [
        `# ${target.owner}/${target.repo} tags`,
        "",
        "| Tag | Commit | Archive |",
        "| --- | --- | --- |",
    ];
    for (const tag of tags) {
        lines.push(`| ${escapeTableCell(tag.name)} | ${tag.commit.sha} | ${escapeTableCell(tag.zipball_url)} |`);
    }
    appendCap(lines, truncated);
    return `${lines.join("\n")}\n`;
}
function renderBranches(target, branches, truncated) {
    const lines = [
        `# ${target.owner}/${target.repo} branches`,
        "",
        "| Branch | Commit | Protected |",
        "| --- | --- | --- |",
    ];
    for (const branch of branches) {
        lines.push(`| ${escapeTableCell(branch.name)} | ${branch.commit.sha} | ${branch.protected ? "yes" : "no"} |`);
    }
    appendCap(lines, truncated);
    return `${lines.join("\n")}\n`;
}
function appendCap(lines, truncated) {
    if (truncated)
        lines.push("", `[listing capped at ${COLLECTION_LIMIT} items]`);
}
