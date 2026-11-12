import { createWebFetchTool } from "./fetch.js";
import { createGitHubFetcher } from "./fetchers/github/index.js";
import { createLocalFetcher } from "./fetchers/local/local.js";
import { createRehypeExtractor } from "./fetchers/local/local-extractor.js";
import { createFetchWorkerClient, } from "./fetchers/local/worker-connection.js";
import { createParallelFetcher, hasParallelCredentials, ParallelClient } from "./parallel.js";
import { createWebSearchTool } from "./search.js";
// web_search exists only with a Parallel key; web_fetch always does, falling back to the local
// browser. GitHub URLs resolve through the same client, per source, as the repo tools.
export function createWebTools(settings, github, 
// Read at every worker spawn, so a restarted browser picks up edited settings.
loadFetchSettings) {
    const hosts = settings.sources.flatMap((source) => {
        const client = github.get(source.name);
        return client ? [{ source: source.name, webUrl: source.url, client }] : [];
    });
    const parallel = hasParallelCredentials(settings.web.parallel)
        ? new ParallelClient(settings.web.parallel)
        : undefined;
    const worker = createFetchWorkerClient(loadFetchSettings);
    const fetch = createWebFetchTool([
        createGitHubFetcher(hosts),
        ...(parallel ? [createParallelFetcher(parallel)] : []),
        createLocalFetcher(worker, createRehypeExtractor()),
    ], settings.cacheDir);
    return { search: parallel ? createWebSearchTool(parallel) : undefined, fetch, worker };
}
