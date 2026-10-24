import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import type { GitHubClientProvider } from "../github.ts";
import { type LibrarianSettings, loadSettings } from "../settings.ts";
import { createWebFetchTool } from "./fetch.ts";
import { createGitHubFetcher, type GitHubFetchHost } from "./fetchers/github/index.ts";
import { createLocalFetcher } from "./fetchers/local/local.ts";
import { createRehypeExtractor } from "./fetchers/local/local-extractor.ts";
import {
  createFetchWorkerClient,
  type FetchWorkerClient,
} from "./fetchers/local/worker-connection.ts";
import { createParallelFetcher, hasParallelCredentials, ParallelClient } from "./parallel.ts";
import { createWebSearchTool } from "./search.ts";

export interface WebTools {
  tools: ToolDefinition[];
  worker: FetchWorkerClient;
}

// web_search exists only with a Parallel key; web_fetch always does, falling back to the local
// browser. GitHub URLs resolve through the same client, per source, as the repo tools.
export function createWebTools(
  settings: LibrarianSettings,
  github: Map<string, GitHubClientProvider>,
): WebTools {
  const hosts: GitHubFetchHost[] = settings.sources.flatMap((source) => {
    const client = github.get(source.name);
    return client ? [{ source: source.name, webUrl: source.url, client }] : [];
  });
  const parallel = hasParallelCredentials(settings.web.parallel)
    ? new ParallelClient(settings.web.parallel)
    : undefined;
  // Read at every worker spawn, so /browser restart applies edited settings.
  const worker = createFetchWorkerClient(() => loadSettings().web.fetch);

  const fetch = createWebFetchTool(
    [
      createGitHubFetcher(hosts),
      ...(parallel ? [createParallelFetcher(parallel)] : []),
      createLocalFetcher(worker, createRehypeExtractor()),
    ],
    settings.cacheDir,
  );
  return {
    tools: [...(parallel ? [createWebSearchTool(parallel)] : []), fetch],
    worker,
  };
}
