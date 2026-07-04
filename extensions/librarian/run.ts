import fs from "node:fs/promises";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import {
  createAgentSession,
  DefaultResourceLoader,
  getAgentDir,
  SessionManager,
} from "@earendil-works/pi-coding-agent";
import type { GitHubClientProvider } from "./github.ts";
import {
  buildLibrarianSystemPrompt,
  buildLibrarianUserPrompt,
  buildProvideResultsReminder,
} from "./prompt.ts";
import { renderFindingsMarkdown } from "./results.ts";
import type { LibrarianSettings } from "./settings.ts";
import { createCheckoutRepoTool } from "./tools/checkout-repo.ts";
import type { Findings } from "./tools/provide-results.ts";
import { createProvideResultsTool } from "./tools/provide-results.ts";
import { createReadGitHubFileTool } from "./tools/read-github-file.ts";
import { searchCodeTool } from "./tools/search-code.ts";
import { createSearchGitHubCodeTool } from "./tools/search-github-code.ts";
import { createSearchReposTool } from "./tools/search-repos.ts";
import { asRepoToolDetails, summarizeToolResult } from "./trace.ts";

const MAX_PROVIDE_RESULTS_REMINDERS = 3;
const HARDCODED_EXCLUDED_TOOLS = ["write", "edit"];

export type LibrarianRunStatus = "running" | "done" | "error" | "aborted";

export interface TraceCall {
  id: string;
  name: string;
  args: unknown;
  startedAt: number;
  endedAt?: number;
  isError?: boolean;
  resultSummary?: string;
}

export interface LibrarianRunDetails {
  status: LibrarianRunStatus;
  query: string;
  modelLabel: string;
  thinkingLevel: ThinkingLevel;
  trace: TraceCall[];
  findings?: Findings;
  checkouts: Record<string, string>;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

export interface LibrarianRunOptions {
  query: string;
  repos: string[];
  owners: string[];
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
  settings: LibrarianSettings;
  githubClient: GitHubClientProvider;
  signal: AbortSignal | undefined;
  onUpdate: ((details: LibrarianRunDetails) => void) | undefined;
}

export async function runLibrarian(
  options: LibrarianRunOptions,
): Promise<AgentToolResult<LibrarianRunDetails>> {
  const details: LibrarianRunDetails = {
    status: "running",
    query: options.query,
    modelLabel: `${options.model.provider}/${options.model.id}`,
    thinkingLevel: options.thinkingLevel,
    trace: [],
    checkouts: {},
    startedAt: Date.now(),
  };

  let lastEmit = 0;
  const emit = (force = false) => {
    const now = Date.now();
    if (!force && now - lastEmit < 120) {
      return;
    }
    lastEmit = now;
    options.onUpdate?.({ ...details, trace: [...details.trace] });
  };

  const finish = (
    status: LibrarianRunStatus,
    content: string,
    isError: boolean,
  ): AgentToolResult<LibrarianRunDetails> => {
    details.status = status;
    details.endedAt = Date.now();
    if (isError) {
      details.error = content.split("\n")[0] ?? content;
    }
    emit(true);
    return {
      content: [{ type: "text", text: content }],
      details: { ...details, trace: [...details.trace] },
      ...(isError ? { isError: true } : {}),
    };
  };

  await fs.mkdir(options.settings.cacheDir, { recursive: true });

  let findings: Findings | undefined;
  const repoTools = [
    createSearchReposTool(options.githubClient),
    searchCodeTool,
    createSearchGitHubCodeTool(options.githubClient),
    createCheckoutRepoTool(options.settings.cacheDir),
    createReadGitHubFileTool(options.githubClient),
    createProvideResultsTool((payload) => {
      findings = payload;
    }),
  ];

  const resourceLoader = new DefaultResourceLoader({
    cwd: options.settings.cacheDir,
    agentDir: getAgentDir(),
    noExtensions: true,
    ...(options.settings.extensions.length > 0
      ? { additionalExtensionPaths: options.settings.extensions }
      : {}),
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    systemPromptOverride: () => buildLibrarianSystemPrompt(options.settings.cacheDir),
    skillsOverride: () => ({ skills: [], diagnostics: [] }),
  });
  await resourceLoader.reload();

  emit(true);

  let session: AgentSession | undefined;
  let unsubscribe: (() => void) | undefined;
  let onAbort: (() => void) | undefined;

  try {
    const created = await createAgentSession({
      cwd: options.settings.cacheDir,
      resourceLoader,
      sessionManager: SessionManager.inMemory(options.settings.cacheDir),
      model: options.model,
      thinkingLevel: options.thinkingLevel,
      customTools: repoTools,
      excludeTools: [...HARDCODED_EXCLUDED_TOOLS, ...options.settings.disabledTools],
    });
    session = created.session;

    const excluded = new Set([...HARDCODED_EXCLUDED_TOOLS, ...options.settings.disabledTools]);
    const allToolNames = session
      .getAllTools()
      .map((tool) => tool.name)
      .filter((name) => !excluded.has(name));
    session.setActiveToolsByName(allToolNames);

    unsubscribe = session.subscribe((event: AgentSessionEvent) => {
      switch (event.type) {
        case "tool_execution_start": {
          details.trace.push({
            id: event.toolCallId,
            name: event.toolName,
            args: event.args,
            startedAt: Date.now(),
          });
          emit(true);
          break;
        }
        case "tool_execution_end": {
          const call = details.trace.find((traced) => traced.id === event.toolCallId);
          if (!call) {
            break;
          }
          call.endedAt = Date.now();
          if (event.isError) {
            call.isError = true;
          }
          const summary = summarizeToolResult(event.result, event.isError === true);
          if (summary !== undefined) {
            call.resultSummary = summary;
          }
          const repoDetails = asRepoToolDetails(event.result?.details);
          if (repoDetails?.kind === "checkout_repo" && !event.isError) {
            details.checkouts[repoDetails.repo] = repoDetails.headSha;
          }
          emit(true);
          break;
        }
        default:
          emit();
      }
    });

    if (options.signal?.aborted) {
      return finish("aborted", "Librarian run aborted before it started.", true);
    }

    const activeSession = session;
    onAbort = () => {
      void activeSession.abort();
    };
    options.signal?.addEventListener("abort", onAbort);

    await session.prompt(buildLibrarianUserPrompt(options.query, options.repos, options.owners), {
      expandPromptTemplates: false,
    });

    let reminders = 0;
    while (!findings && !options.signal?.aborted && reminders < MAX_PROVIDE_RESULTS_REMINDERS) {
      reminders += 1;
      await session.prompt(buildProvideResultsReminder(), { expandPromptTemplates: false });
    }

    if (options.signal?.aborted) {
      return finish("aborted", "Librarian run aborted.", true);
    }

    if (findings) {
      details.findings = findings;
      return finish("done", renderFindingsMarkdown(findings, details.checkouts), false);
    }

    const lastText = session.getLastAssistantText() ?? "";
    return finish(
      "error",
      `Librarian did not report structured findings after ${MAX_PROVIDE_RESULTS_REMINDERS} reminders.${lastText ? `\n\nRaw final message:\n${lastText}` : ""}`,
      true,
    );
  } catch (error) {
    if (options.signal?.aborted) {
      return finish("aborted", "Librarian run aborted.", true);
    }
    const message = error instanceof Error ? error.message : String(error);
    return finish("error", `Librarian run failed: ${message}`, true);
  } finally {
    if (onAbort) {
      options.signal?.removeEventListener("abort", onAbort);
    }
    unsubscribe?.();
    session?.dispose();
  }
}
