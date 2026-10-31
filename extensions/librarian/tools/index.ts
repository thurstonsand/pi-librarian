import type { ToolDefinition } from "@earendil-works/pi-coding-agent";
import { BitbucketClient, createBitbucketFileReader } from "../bitbucket.ts";
import { cloneSources } from "../checkout.ts";
import { runCredentialCommand } from "../credential-command.ts";
import {
  createGitHubClientProvider,
  createGitHubFileReader,
  type GitHubClientProvider,
} from "../github.ts";
import { createGitLabFileReader, GitLabClient } from "../gitlab.ts";
import type { RepoFileReader } from "../repo-entry.ts";
import type {
  LibrarianSettings,
  LibrarianSource,
  SourceKind,
  SourceRole,
  SourceToken,
} from "../settings.ts";
import { SourcegraphClient } from "../sourcegraph.ts";
import { createCheckoutRepoTool } from "./checkout-repo.ts";
import { createFindDefinitionTool } from "./find-definition.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";
import { createReadFileTool } from "./read-file.ts";
import { createSearchCodeBitbucketTool } from "./search-code-bitbucket.ts";
import { createSearchCodeGitHubTool } from "./search-code-github.ts";
import { createSearchCodeGitLabTool } from "./search-code-gitlab.ts";
import { createSearchCodeGrepAppTool } from "./search-code-grepapp.ts";
import { createSearchCodeSourcegraphTool } from "./search-code-sourcegraph.ts";
import { createSearchReposBitbucketTool } from "./search-repos-bitbucket.ts";
import { createSearchReposGitHubTool } from "./search-repos-github.ts";
import { createSearchReposGitLabTool } from "./search-repos-gitlab.ts";
import { createSearchReposSourcegraphTool } from "./search-repos-sourcegraph.ts";

// One explicit client per source. Each kind's clients share nothing with another kind's, so there
// is no common interface to put in a registry.
export interface RepoClients {
  github: Map<string, GitHubClientProvider>;
  sourcegraph: Map<string, SourcegraphClient>;
  gitlab: Map<string, GitLabClient>;
  bitbucket: Map<string, BitbucketClient>;
  readers: Map<string, RepoFileReader>;
}

export function sourcesWith(
  sources: LibrarianSource[],
  kind: SourceKind,
  role: SourceRole,
): LibrarianSource[] {
  return sources.filter((source) => source.kind === kind && source.roles.includes(role));
}

// A command's token is fetched once, on first use; a failure is not kept, so the next call retries.
function tokenResolver(source: LibrarianSource, token: SourceToken): () => Promise<string> {
  if (token.kind === "value") {
    return async () => token.value;
  }
  let resolved: Promise<string> | undefined;
  return () => {
    resolved ??= runCredentialCommand(
      token.command,
      `librarian.sources "${source.name}" tokenCommand`,
      undefined,
    ).catch((error: unknown) => {
      resolved = undefined;
      throw error;
    });
    return resolved;
  };
}

// ghCliToken is the built-in github source's fallback when no token variable is set.
export function createRepoClients(
  settings: LibrarianSettings,
  ghCliToken: () => Promise<string | undefined>,
): RepoClients {
  const github = new Map<string, GitHubClientProvider>();
  const sourcegraph = new Map<string, SourcegraphClient>();
  const gitlab = new Map<string, GitLabClient>();
  const bitbucket = new Map<string, BitbucketClient>();
  const readers = new Map<string, RepoFileReader>();

  for (const source of settings.sources) {
    switch (source.kind) {
      case "github": {
        const token = source.token;
        const provider = createGitHubClientProvider(
          token === undefined
            ? source.name === "github"
              ? ghCliToken
              : async () => undefined
            : tokenResolver(source, token),
          source.url,
        );
        github.set(source.name, provider);
        readers.set(source.name, createGitHubFileReader(provider));
        break;
      }
      case "sourcegraph":
        if (source.token) {
          sourcegraph.set(
            source.name,
            new SourcegraphClient(source.url, tokenResolver(source, source.token)),
          );
        }
        break;
      case "gitlab":
        if (source.token) {
          const client = new GitLabClient(
            source.url,
            tokenResolver(source, source.token),
            Date.now,
          );
          gitlab.set(source.name, client);
          readers.set(source.name, createGitLabFileReader(client));
        }
        break;
      case "bitbucket-server":
        if (source.token) {
          const client = new BitbucketClient(source.url, tokenResolver(source, source.token));
          bitbucket.set(source.name, client);
          readers.set(source.name, createBitbucketFileReader(client));
        }
        break;
    }
  }

  return { github, sourcegraph, gitlab, bitbucket, readers };
}

export function readableSources(
  settings: LibrarianSettings,
  clients: RepoClients,
): LibrarianSource[] {
  return settings.sources.filter(
    (source) => source.roles.includes("clone") && clients.readers.has(source.name),
  );
}

export interface RepoToolSet {
  tools: ToolDefinition[];
  // Tools over a single instance take no source argument; this names the source each one implies.
  impliedSources: Map<string, string>;
}

// Operator notes ride in the tool description rather than the librarian's prompt, so attached
// tools carry them too.
function withSourceNotes(tool: ToolDefinition, instances: LibrarianSource[]): ToolDefinition {
  const notes = instances.flatMap((instance) =>
    instance.description === undefined ? [] : [`- ${instance.name}: ${instance.description}`],
  );
  return notes.length === 0
    ? tool
    : { ...tool, description: `${tool.description}\n\nNotes on its sources:\n${notes.join("\n")}` };
}

// The repository tools a session can use, built from configuration: an engine with no instance
// contributes no tool.
export function createRepoTools(settings: LibrarianSettings, clients: RepoClients): RepoToolSet {
  const { cacheDir, search, sources } = settings;
  const tools: ToolDefinition[] = [];
  const impliedSources = new Map<string, string>([
    [LIBRARIAN_TOOL_NAMES.searchCodeGrepApp, "grep.app"],
  ]);
  const add = (tool: ToolDefinition, instances: LibrarianSource[]) => {
    tools.push(withSourceNotes(tool, instances));
    if (instances.length === 1 && instances[0]) {
      impliedSources.set(tool.name, instances[0].name);
    }
  };

  const githubCode = sourcesWith(sources, "github", "code-search");
  if (githubCode.length > 0) {
    add(createSearchCodeGitHubTool(githubCode, clients.github, cacheDir, search), githubCode);
  }
  tools.push(createSearchCodeGrepAppTool(cacheDir, search));

  const gitlabCode = sourcesWith(sources, "gitlab", "code-search");
  if (gitlabCode.length > 0) {
    add(createSearchCodeGitLabTool(gitlabCode, clients.gitlab, cacheDir, search), gitlabCode);
  }

  const bitbucketCode = sourcesWith(sources, "bitbucket-server", "code-search");
  if (bitbucketCode.length > 0) {
    add(
      createSearchCodeBitbucketTool(bitbucketCode, clients.bitbucket, cacheDir, search),
      bitbucketCode,
    );
  }

  const clonable = cloneSources(sources);
  const sourcegraphCode = sourcesWith(sources, "sourcegraph", "code-search");
  if (sourcegraphCode.length > 0) {
    add(
      createSearchCodeSourcegraphTool(
        sourcegraphCode,
        clients.sourcegraph,
        clonable,
        cacheDir,
        search,
      ),
      sourcegraphCode,
    );
    add(
      createFindDefinitionTool(sourcegraphCode, clients.sourcegraph, clonable, cacheDir, search),
      sourcegraphCode,
    );
  }

  const githubRepos = sourcesWith(sources, "github", "repo-search");
  if (githubRepos.length > 0) {
    add(createSearchReposGitHubTool(githubRepos, clients.github, cacheDir, search), githubRepos);
  }
  const gitlabRepos = sourcesWith(sources, "gitlab", "repo-search");
  if (gitlabRepos.length > 0) {
    add(createSearchReposGitLabTool(gitlabRepos, clients.gitlab, cacheDir, search), gitlabRepos);
  }
  const bitbucketRepos = sourcesWith(sources, "bitbucket-server", "repo-search");
  if (bitbucketRepos.length > 0) {
    add(
      createSearchReposBitbucketTool(bitbucketRepos, clients.bitbucket, cacheDir, search),
      bitbucketRepos,
    );
  }
  const sourcegraphRepos = sourcesWith(sources, "sourcegraph", "repo-search");
  if (sourcegraphRepos.length > 0) {
    add(
      createSearchReposSourcegraphTool(
        sourcegraphRepos,
        clients.sourcegraph,
        clonable,
        cacheDir,
        search,
      ),
      sourcegraphRepos,
    );
  }

  const readable = readableSources(settings, clients);
  if (readable.length > 0) {
    add(createReadFileTool(readable, clients.readers), readable);
  }
  tools.push(withSourceNotes(createCheckoutRepoTool(cacheDir, sources), clonable));

  return { tools, impliedSources };
}
