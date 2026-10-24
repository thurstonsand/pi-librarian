import fs from "node:fs/promises";
import path from "node:path";
import type { AgentToolResult, ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type {
  AgentSession,
  AgentSessionEvent,
  ModelRuntime,
} from "@earendil-works/pi-coding-agent";
import {
  createAgentSession,
  getAgentDir,
  SessionManager,
  type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { cloneSources } from "./checkout.ts";
import {
  buildLibrarianSystemPrompt,
  buildLibrarianUserPrompt,
  buildProvideResultsReminder,
} from "./prompt.ts";
import { createLibrarianResourceLoader } from "./resource-loader.ts";
import { renderFindingsMarkdown } from "./results.ts";
import type { LibrarianSettings } from "./settings.ts";
import type { Findings } from "./tools/provide-results.ts";
import { createProvideResultsTool } from "./tools/provide-results.ts";
import { asRepoToolDetails, summarizeToolResult } from "./trace.ts";
import { appendSearchUsage } from "./usage.ts";

const MAX_PROVIDE_RESULTS_REMINDERS = 3;
const INHERITED_TOOL_NAMES = ["read", "grep", "find", "ls", "bash"];
const EXCLUDED_TOOL_NAMES = ["write", "edit"];

class LibrarianRunError extends Error {}

export type LibrarianRunStatus = "running" | "done" | "error" | "aborted";
type FailedLibrarianRunStatus = "error" | "aborted";

export interface TraceCall {
  id: string;
  name: string;
  args: unknown;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
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
  modelRuntime: ModelRuntime;
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
  settings: LibrarianSettings;
  // Repo tools plus web tools; provide_results is added per run.
  tools: ToolDefinition[];
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
  const disabledTools = new Set(options.settings.tools.disabled);
  const tools = [
    ...options.tools,
    createProvideResultsTool(
      cloneSources(options.settings.sources).map((source) => source.name),
      (payload) => {
        findings = payload;
      },
    ),
  ].filter((tool) => !disabledTools.has(tool.name));

  const resourceLoader = createLibrarianResourceLoader({
    cacheDir: options.settings.cacheDir,
    agentDir: getAgentDir(),
    systemPromptOverride: () => buildLibrarianSystemPrompt(options.settings.cacheDir, tools),
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
      sessionManager,
      modelRuntime: options.modelRuntime,
      model: options.model,
      thinkingLevel: options.thinkingLevel,
      customTools: tools,
      excludeTools: EXCLUDED_TOOL_NAMES,
    });
    session = created.session;

    session.setActiveToolsByName(
      [...INHERITED_TOOL_NAMES, ...tools.map((tool) => tool.name)].filter(
        (toolName) => !disabledTools.has(toolName),
      ),
    );

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
          if (event.durationMs !== undefined) {
            call.durationMs = event.durationMs;
          }
          if (event.isError) {
            call.isError = true;
          }
          const summary = summarizeToolResult(event.result, event.isError === true);
          if (summary !== undefined) {
            call.resultSummary = summary;
          }
          const repoDetails = asRepoToolDetails(event.result?.details);
          if (repoDetails?.kind === "checkout_repo" && !event.isError) {
            details.checkouts[repoDetails.identity] = repoDetails.headSha;
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
      return finish(
        "done",
        renderFindingsMarkdown(findings, details.checkouts, options.settings.sources),
      );
    }

    const lastText = session.getLastAssistantText() ?? "";
    fail(
      "error",
      `Librarian was not able to report findings.${lastText ? `\n\nRaw final message:\n${lastText}` : ""}`,
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
    if (details.runId) {
      await appendSearchUsage(options.settings.cacheDir, details.runId, details.trace);
    }
  }

  throw new Error("Unreachable librarian run state.");
}
