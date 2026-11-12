import { Type } from "typebox";
import { formatDigest, plural, writeSearchArtifact, } from "../delivery.js";
import { defineTool } from "../tool.js";
import { repoWebUrl } from "../web-urls.js";
import { LIBRARIAN_TOOL_NAMES } from "./names.js";
import { limitParameter, rejectUnsafeValue, resolveLimit, runRestSearch, selectInstance, sourceProperties, } from "./shared.js";
const BITBUCKET_MAX = 50;
export function createSearchReposBitbucketTool(instances, clients, cacheDir, search) {
    const Params = Type.Object({
        ...sourceProperties(instances, "Which Bitbucket to search"),
        name: Type.Optional(Type.String({ description: "Repositories whose name starts with this, case-insensitively." })),
        project: Type.Optional(Type.String({ description: "Restrict to a project key, e.g. PROJ." })),
        limit: limitParameter(BITBUCKET_MAX, search.defaultLimit),
    });
    return defineTool({
        name: LIBRARIAN_TOOL_NAMES.searchReposBitbucket,
        label: "Search Bitbucket repos",
        description: "Find repositories on a Bitbucket Server instance by the start of their name, optionally within one project. Bitbucket reports no total, only whether more exist.",
        parameters: Params,
        annotations: { readOnlyHint: true, openWorldHint: true },
        async execute(toolCallId, params, signal) {
            const instance = selectInstance(instances, params);
            const client = clients.get(instance.name);
            if (!client) {
                throw new Error(`No Bitbucket client for source "${instance.name}".`);
            }
            const limit = resolveLimit(params.limit, search, BITBUCKET_MAX);
            const project = params.project ? rejectUnsafeValue("project", params.project) : undefined;
            await client.authorize();
            const result = await runRestSearch(search, signal, "add project, or a longer name.", (searchSignal) => client.searchRepositories({ name: params.name?.trim() || undefined, project, limit }, searchSignal));
            if (result.repositories.length === 0 &&
                project &&
                !(await client.projectExists(project, signal))) {
                throw new Error(`No Bitbucket project ${project} on ${instance.name}, or it is not visible to this token.`);
            }
            const entries = result.repositories.map((repository) => {
                const url = repoWebUrl(instance, repository.repo);
                return {
                    label: repository.repo,
                    ...(url ? { url } : {}),
                    ...(repository.archived ? { meta: "archived" } : {}),
                    ...(repository.description ? { detail: repository.description } : {}),
                };
            });
            const artifact = await writeSearchArtifact(cacheDir, toolCallId, result.repositories.map((repository) => ({ source: instance.name, ...repository })));
            const count = result.repositories.length;
            return {
                content: [
                    {
                        type: "text",
                        text: formatDigest({
                            found: result.isLastPage
                                ? `${plural(count, "repository", "repositories")} match`
                                : `More than ${plural(count, "repository", "repositories")} match`,
                            source: instance.name,
                            complete: undefined,
                            incompleteReason: undefined,
                            fetchedCount: count,
                            limitHit: !result.isLastPage,
                            shownCount: entries.length,
                            artifact,
                        }, entries),
                    },
                ],
                details: {
                    kind: "search_repos_bitbucket",
                    source: instance.name,
                    matchCount: count,
                    fetchedCount: count,
                    shownCount: entries.length,
                    complete: undefined,
                    artifact,
                    entries,
                },
            };
        },
    });
}
