import fs from "node:fs/promises";
import path from "node:path";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { AgentSession, AgentSessionEvent } from "@earendil-works/pi-coding-agent";
import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";
import { type ExtraToolsResolution, LIBRARIAN_BASELINE_TOOL_NAMES } from "./extra-tools.ts";
import type { GitHubClientProvider } from "./github.ts";
import {
  buildLibrarianSystemPrompt,
  buildLibrarianUserPrompt,
  buildProvideResultsReminder,
} from "./prompt.ts";
import { createLibrarianResourceLoader } from "./resource-loader.ts";
import { renderFindingsMarkdown } from "./results.ts";
import type { LibrarianSettings } from "./settings.ts";
import { createCheckoutRepoTool } from "./tools/checkout-repo.ts";
import { LIBRARIAN_RUN_TOOL_NAMES } from "./tools/names.ts";
import type { Findings } from "./tools/provide-results.ts";
import { createProvideResultsTool } from "./tools/provide-results.ts";
import { createReadGitHubFileTool } from "./tools/read-github-file.ts";
import { searchCodeTool } from "./tools/search-code.ts";
import { createSearchGitHubCodeTool } from "./tools/search-github-code.ts";
import { createSearchReposTool } from "./tools/search-repos.ts";
import { asRepoToolDetails, summarizeToolResult } from "./trace.ts";

const MAX_PROVIDE_RESULTS_REMINDERS = 3;
const DEFAULT_EXCLUDED_TOOLS = ["write", "edit"];

class LibrarianRunError extends Error {}

export type LibrarianRunStatus = "running" | "done" | "error" | "aborted";
type FailedLibrarianRunStatus = "error" | "aborted";

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
  runId?: string;
  debugSessionPath?: string;
  startedAt: number;
  endedAt?: number;
}

export interface LibrarianRunOptions {
  query: string;
  repos: string[];
  owners: string[];
  continueFrom: string | undefined;
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
  settings: LibrarianSettings;
  extraTools: ExtraToolsResolution;
  githubClient: GitHubClientProvider;
  signal: AbortSignal | undefined;
  onUpdate: ((details: LibrarianRunDetails) => void) | undefined;
}

async function openContinuedSession(
  runId: string,
  sessionsDir: string,
  cacheDir: string,
  fail: (status: FailedLibrarianRunStatus, content: string) => never,
): Promise<SessionManager> {
  const sessions = await SessionManager.listAll(sessionsDir);
  const sessionFile = sessions.find((candidate) => candidate.id === runId)?.path;
  if (!sessionFile) {
    fail("error", `Librarian run not found: ${runId}`);
  }
  return SessionManager.open(sessionFile, sessionsDir, cacheDir);
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

  const finalizeDetails = (status: LibrarianRunStatus, content: string): string => {
    const suffixes = [
      ...(details.runId ? [`run: ${details.runId}`] : []),
      ...(details.debugSessionPath ? [`debug_session: ${details.debugSessionPath}`] : []),
    ];
    const resultContent = suffixes.length > 0 ? `${content}\n\n${suffixes.join("\n")}` : content;
    details.status = status;
    details.endedAt = Date.now();
    if (status !== "done") {
      details.error = content.split("\n")[0] ?? content;
    }
    emit(true);
    return resultContent;
  };

  const finish = (
    status: LibrarianRunStatus,
    content: string,
  ): AgentToolResult<LibrarianRunDetails> => ({
    content: [{ type: "text", text: finalizeDetails(status, content) }],
    details: { ...details, trace: [...details.trace] },
  });

  const fail = (status: FailedLibrarianRunStatus, content: string): never => {
    throw new LibrarianRunError(finalizeDetails(status, content));
  };

  await fs.mkdir(options.settings.cacheDir, { recursive: true });

  const sessionsDir = path.join(options.settings.cacheDir, "sessions");
  const sessionManager = options.continueFrom
    ? await openContinuedSession(options.continueFrom, sessionsDir, options.settings.cacheDir, fail)
    : SessionManager.create(options.settings.cacheDir, sessionsDir);
  details.runId = sessionManager.getSessionId();
  const debugSessionPath = sessionManager.getSessionFile();
  if (options.settings.debug.persistRuns && debugSessionPath) {
    details.debugSessionPath = debugSessionPath;
  }

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

  const resourceLoader = createLibrarianResourceLoader({
    cacheDir: options.settings.cacheDir,
    extensionPaths: options.extraTools.extensionPaths,
    systemPromptOverride: () => buildLibrarianSystemPrompt(options.settings.cacheDir),
  });
  await resourceLoader.reload();

  const extensionLoadErrors = resourceLoader.getExtensions().errors;
  for (const [index, error] of extensionLoadErrors.entries()) {
    const now = Date.now();
    details.trace.push({
      id: `extension-load-${index}`,
      name: "load_extension",
      args: { path: error.path },
      startedAt: now,
      endedAt: now,
      isError: true,
      resultSummary: error.error,
    });
  }

  emit(true);

  let session: AgentSession | undefined;
  let unsubscribe: (() => void) | undefined;
  let onAbort: (() => void) | undefined;

  try {
    const created = await createAgentSession({
      cwd: options.settings.cacheDir,
      resourceLoader,
      sessionManager,
      model: options.model,
      thinkingLevel: options.thinkingLevel,
      customTools: repoTools,
      excludeTools: DEFAULT_EXCLUDED_TOOLS.filter(
        (toolName) => !options.extraTools.toolNames.includes(toolName),
      ),
    });
    session = created.session;

    session.setActiveToolsByName([
      ...LIBRARIAN_BASELINE_TOOL_NAMES,
      ...LIBRARIAN_RUN_TOOL_NAMES,
      ...options.extraTools.toolNames,
    ]);

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
      fail("aborted", "Librarian run aborted before it started.");
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
      await session.prompt(buildProvideResultsReminder(), {
        expandPromptTemplates: false,
      });
    }

    if (options.signal?.aborted) {
      fail("aborted", "Librarian run aborted.");
    }

    if (findings) {
      details.findings = findings;
      return finish("done", renderFindingsMarkdown(findings, details.checkouts));
    }

    const lastText = session.getLastAssistantText() ?? "";
    fail(
      "error",
      `Librarian did not report structured findings after ${MAX_PROVIDE_RESULTS_REMINDERS} reminders.${lastText ? `\n\nRaw final message:\n${lastText}` : ""}`,
    );
  } catch (error) {
    if (error instanceof LibrarianRunError) {
      throw error;
    }
    if (options.signal?.aborted) {
      fail("aborted", "Librarian run aborted.");
    }
    const message = error instanceof Error ? error.message : String(error);
    fail("error", `Librarian run failed: ${message}`);
  } finally {
    if (onAbort) {
      options.signal?.removeEventListener("abort", onAbort);
    }
    unsubscribe?.();
    session?.dispose();
  }

  throw new Error("Unreachable librarian run state.");
}
