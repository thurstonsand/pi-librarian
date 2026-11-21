import type { GitHubClientProvider } from "../github.ts";
import type { FetchSettings, LibrarianSettings } from "../settings.ts";
import type { LibrarianTool } from "../tool.ts";
import { createWebFetchTool, type fetchParameters, type WebFetchDetails } from "./fetch.ts";
import { createDirectFetcher } from "./fetchers/direct.ts";
import { createGitHubFetcher, type GitHubFetchHost } from "./fetchers/github/index.ts";
import { createLocalFetcher } from "./fetchers/local/local.ts";
import { createRehypeExtractor } from "./fetchers/local/local-extractor.ts";
import {
  createFetchWorkerClient,
  type FetchWorkerClient,
} from "./fetchers/local/worker-connection.ts";
import { createImageDownloader, createImageFetcher } from "./images.ts";
import { createParallelFetcher, hasParallelCredentials, ParallelClient } from "./parallel.ts";
import { createWebSearchTool, type searchParameters, type WebSearchDetails } from "./search.ts";

export interface WebTools {
  search: LibrarianTool<typeof searchParameters, WebSearchDetails | undefined> | undefined;
  fetch: LibrarianTool<typeof fetchParameters, WebFetchDetails | undefined>;
  worker: FetchWorkerClient;
}

// web_search exists only with a Parallel key; web_fetch always does, falling back to the local
// browser. GitHub URLs resolve through the same client, per source, as the repo tools.
export function createWebTools(
  settings: LibrarianSettings,
  github: Map<string, GitHubClientProvider>,
  // Read at every worker spawn, so a restarted browser picks up edited settings.
  loadFetchSettings: () => FetchSettings,
): WebTools {
  const hosts: GitHubFetchHost[] = settings.sources.flatMap((source) => {
    const client = github.get(source.name);
    return client ? [{ source: source.name, webUrl: source.url, client }] : [];
  });
  const parallel = hasParallelCredentials(settings.web.parallel)
    ? new ParallelClient(settings.web.parallel)
    : undefined;
  const worker = createFetchWorkerClient(loadFetchSettings);
  const downloadImage = createImageDownloader(worker);

  const fetch = createWebFetchTool(
    [
      createGitHubFetcher(hosts),
      createImageFetcher(),
      ...(parallel ? [createParallelFetcher(parallel)] : []),
      createLocalFetcher(worker, createRehypeExtractor()),
    ],
    [createDirectFetcher(), createLocalFetcher(worker, null)],
    settings.cacheDir,
  );
  return {
    search: parallel ? createWebSearchTool(parallel, downloadImage, settings.cacheDir) : undefined,
    fetch,
    worker,
  };
}
