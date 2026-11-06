import { Type } from "typebox";
import { formatCount, formatDigest, writeSearchArtifact, } from "../delivery.js";
import { GITHUB_LANGUAGES } from "../github-languages.js";
import { StringEnum } from "../string-enum.js";
import { defineTool } from "../tool.js";
import { LIBRARIAN_TOOL_NAMES } from "./names.js";
import { limitParameter, rejectUnsafeValue, resolveLimit, runRestSearch, selectInstance, sourceProperties, validateIsoDate, } from "./shared.js";
const GITHUB_REPO_SEARCH_MAX = 50;
// GitHub silently drops a language it does not know, widening the search to every language.
export function normalizeGitHubLanguage(language) {
    const normalized = language.trim().toLowerCase().replace(/\s+/g, "-");
    if (!GITHUB_LANGUAGES.has(normalized)) {
        throw new Error(`GitHub does not know the language "${language}", and would silently search every language instead. Use its GitHub name, e.g. typescript, c#, or jupyter-notebook.`);
    }
    return normalized;
}
export function buildGitHubRepoQuery(query) {
    const parts = [];
    const text = query.text?.trim();
    if (text) {
        const qualifier = /(^|\s)(-?[A-Za-z_]+):\S/.exec(text.replace(/"[^"]*"/g, " "));
        if (qualifier) {
            throw new Error(`text contains a qualifier "${qualifier[2]}:". Use the language, topics, min_stars, and pushed_after arguments instead.`);
        }
        parts.push(text);
        if (query.inReadme) {
            parts.push("in:readme");
        }
    }
    if (query.language) {
        parts.push(`language:${normalizeGitHubLanguage(query.language)}`);
    }
    for (const topic of query.topics) {
        parts.push(`topic:${rejectUnsafeValue("topics", topic)}`);
    }
    if (query.minStars !== undefined) {
        parts.push(`stars:>=${query.minStars}`);
    }
    if (query.pushedAfter) {
        parts.push(`pushed:>${validateIsoDate("pushed_after", query.pushedAfter)}`);
    }
    if (parts.length === 0) {
        throw new Error("Give at least one of text, language, topics, min_stars, or pushed_after; an empty query asks for all of GitHub.");
    }
    if (query.includeForks) {
        parts.push("fork:true");
    }
    if (!query.includeArchived) {
        parts.push("archived:false");
    }
    return parts.join(" ");
}
function repoMeta(hit) {
    const meta = [`★${hit.stars}`];
    if (hit.language) {
        meta.push(hit.language);
    }
    if (hit.pushedAt) {
        meta.push(`last modified ${hit.pushedAt.slice(0, 10)}`);
    }
    if (hit.archived) {
        meta.push("archived");
    }
    if (hit.fork) {
        meta.push("fork");
    }
    return meta.join(" · ");
}
function repoDetail(hit) {
    const lines = [
        ...(hit.description ? [hit.description] : []),
        ...(hit.topics.length > 0 ? [`topics: ${hit.topics.join(", ")}`] : []),
    ];
    return lines.length > 0 ? lines.join("\n") : undefined;
}
export function createSearchReposGitHubTool(instances, clients, cacheDir, search) {
    const maximum = GITHUB_REPO_SEARCH_MAX;
    const Params = Type.Object({
        ...sourceProperties(instances, "Which GitHub to search"),
        text: Type.Optional(Type.String({ description: "Terms matched against name, description, and topics." })),
        in_readme: Type.Optional(Type.Boolean({
            description: "Search README text instead of name and description — far broader. Default: false.",
        })),
        language: Type.Optional(Type.String({ description: "Restrict to a primary language, e.g. typescript." })),
        topics: Type.Optional(Type.Array(Type.String(), {
            description: "Only repos tagged with every one of these topics.",
            maxItems: 10,
        })),
        min_stars: Type.Optional(Type.Integer({ minimum: 0, description: "Only repos with at least this many stars." })),
        pushed_after: Type.Optional(Type.String({ description: "Only repos pushed to after this date, YYYY-MM-DD." })),
        include_forks: Type.Optional(Type.Boolean({ description: "Include forks. Default: false." })),
        include_archived: Type.Optional(Type.Boolean({ description: "Include archived repos. Default: true." })),
        sort: Type.Optional(StringEnum(["best-match", "stars", "updated"], {
            description: "Ordering. Use stars to find what is popular. Default: best-match.",
        })),
        limit: limitParameter(maximum, search.defaultLimit),
    });
    return defineTool({
        name: LIBRARIAN_TOOL_NAMES.searchReposGitHub,
        label: "Search GitHub repos",
        description: "Find GitHub repositories by name, description, topics, language, stars, and recent activity. Returns repositories with their metadata, ranked by relevance or stars.",
        parameters: Params,
        annotations: { readOnlyHint: true, openWorldHint: true },
        async execute(toolCallId, params, signal) {
            const instance = selectInstance(instances, params);
            const provider = clients.get(instance.name);
            if (!provider) {
                throw new Error(`No GitHub client for source "${instance.name}".`);
            }
            const query = buildGitHubRepoQuery({
                text: params.text,
                inReadme: params.in_readme ?? false,
                language: params.language,
                topics: params.topics ?? [],
                minStars: params.min_stars,
                pushedAfter: params.pushed_after,
                includeForks: params.include_forks ?? false,
                includeArchived: params.include_archived ?? true,
            });
            const limit = resolveLimit(params.limit, search, maximum);
            const client = await provider();
            const result = await runRestSearch(search, signal, "add language, topics, or min_stars.", (searchSignal) => client.searchRepositories({
                query,
                sort: params.sort ?? "best-match",
                limit,
                signal: searchSignal,
            }));
            if (result.incompleteResults && result.hits.length === 0) {
                throw new Error("GitHub could not finish this repository search and found nothing before it stopped. This is not an empty result; narrow it and retry.");
            }
            const complete = result.incompleteResults ? false : undefined;
            const entries = result.hits.map((hit) => {
                const detail = repoDetail(hit);
                return {
                    label: hit.repo,
                    url: hit.url,
                    meta: repoMeta(hit),
                    ...(detail ? { detail } : {}),
                };
            });
            const artifact = await writeSearchArtifact(cacheDir, toolCallId, result.hits.map((hit) => ({ source: instance.name, ...hit })));
            return {
                content: [
                    {
                        type: "text",
                        text: formatDigest({
                            found: `${formatCount(result.totalCount)} repositories match`,
                            source: instance.name,
                            complete,
                            incompleteReason: "GitHub did not finish searching every repository",
                            fetchedCount: result.hits.length,
                            limitHit: result.hits.length < result.totalCount,
                            shownCount: entries.length,
                            artifact,
                        }, entries),
                    },
                ],
                details: {
                    kind: "search_repos_github",
                    source: instance.name,
                    matchCount: result.totalCount,
                    fetchedCount: result.hits.length,
                    shownCount: entries.length,
                    complete,
                    artifact,
                    entries,
                },
            };
        },
    });
}
