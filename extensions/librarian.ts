import type {
  ExtensionAPI,
  SessionStartEvent,
  SessionTreeEvent,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import {
  ATTACH_ENTRY_TYPE,
  type AttachEntryData,
  applyAttachState,
  readAttachState,
  renderAttachEntry,
  setAttachState,
} from "./librarian/attach.ts";
import { collectExtraToolWarnings, resolveExtraTools } from "./librarian/extra-tools.ts";
import { resolveGhCliToken } from "./librarian/github.ts";
import { resolveLibrarianModel } from "./librarian/model.ts";
import { createLibrarianModelRuntime } from "./librarian/model-runtime.ts";
import { type LibrarianRunDetails, runLibrarian, type TraceCall } from "./librarian/run.ts";
import { loadSettings } from "./librarian/settings.ts";
import { createRepoClients, createRepoTools } from "./librarian/tools/index.ts";
import {
  formatTraceLine,
  renderLibrarianCall,
  renderLibrarianResult,
  renderRepoToolResult,
  SPINNER_INTERVAL_MS,
  shorten,
  type TraceContext,
} from "./librarian/view.ts";

const LibrarianParams = Type.Object({
  query: Type.String({
    description:
      "The research question. Include everything you already know: symbols, error messages, desired output shape. Do not guess unknown details — say what is uncertain and let the librarian discover it.",
  }),
  repos: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional owner/repo scope for the research.",
      maxItems: 20,
    }),
  ),
  owners: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional owner/org scope for the research.",
      maxItems: 20,
    }),
  ),
  continue_from: Type.Optional(
    Type.String({
      description:
        "Run id from an earlier librarian result. Pass this for follow-up questions for that prior run.",
    }),
  ),
});

export default function librarianExtension(pi: ExtensionAPI): void {
  const settings = loadSettings();
  const { tools: repoTools, impliedSources } = createRepoTools(
    settings,
    createRepoClients(settings, resolveGhCliToken),
  );
  const repoToolNames = repoTools.map((tool) => tool.name);
  const traceContext: TraceContext = {
    cacheDir: settings.cacheDir,
    impliedSources,
    sources: settings.sources,
  };

  pi.registerEntryRenderer<AttachEntryData>(ATTACH_ENTRY_TYPE, (entry, { expanded }, theme) =>
    renderAttachEntry(entry.data, expanded, theme),
  );

  for (const tool of repoTools) {
    pi.registerTool({
      ...tool,
      defaultActive: false,
      // pi renders a result only once one exists, so a tool that sends no update until it finishes
      // would show nothing while it runs.
      execute(toolCallId, params, signal, onUpdate, ctx) {
        onUpdate?.({ content: [], details: undefined });
        return tool.execute(toolCallId, params, signal, onUpdate, ctx);
      },
      renderCall(args, theme) {
        const { verb, subject } = formatTraceLine(
          { name: tool.name, args, id: "", startedAt: 0 } satisfies TraceCall,
          traceContext,
        );
        return new Text(
          `${theme.fg("toolTitle", theme.bold(verb))} ${theme.fg("toolOutput", subject)}`,
          0,
          0,
        );
      },
      renderResult(result, options, theme, context) {
        return renderRepoToolResult(tool.name, result, options, theme, context);
      },
    });
  }

  pi.registerTool<typeof LibrarianParams, LibrarianRunDetails>({
    name: "librarian",
    label: "Librarian",
    description:
      "Understand complex, multi-repo codebases, exploring cross-repo relationships, analyzing architectural patterns, finding implementations across codebases, understanding code evolution/commit history, diving deep on specific code bases, getting comprehensive feature explanations, and exploring end-to-end system design across within or across repositories.",
    promptSnippet: "Research repositories and codebases, returning cited findings",
    promptGuidelines: [
      "Use librarian for deep, multi-step research across repos; for a single file or reference, prefer cheaper means (downloaded dependencies, web search or fetch).",
    ],
    parameters: LibrarianParams,
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const modelRuntime = await createLibrarianModelRuntime(ctx.modelRegistry);
      const thinkingLevel = settings.thinkingLevel ?? pi.getThinkingLevel();
      const resolution = resolveLibrarianModel(
        modelRuntime,
        ctx.model,
        settings.model,
        thinkingLevel,
      );
      if (resolution.warning) {
        ctx.ui.notify(resolution.warning, "warning");
      }

      const extraTools = resolveExtraTools(pi.getAllTools(), settings);

      return runLibrarian({
        query: params.query,
        repos: params.repos ?? [],
        owners: params.owners ?? [],
        continueFrom: params.continue_from,
        modelRuntime,
        model: resolution.model,
        thinkingLevel: resolution.thinkingLevel,
        settings,
        extraTools,
        repoTools,
        signal,
        onUpdate: onUpdate
          ? (details) => {
              onUpdate({
                content: [
                  {
                    type: "text",
                    text: `Researching: ${shorten(params.query, 80)}`,
                  },
                ],
                details,
              });
            }
          : undefined,
      });
    },

    renderCall(_args, theme) {
      return renderLibrarianCall(theme);
    },

    renderResult(result, options, theme, context) {
      // Live spinner/elapsed ticking, same pattern and cadence as pi's bash
      // tool and Working... loader: re-render on an interval while streaming.
      const state = context.state as { interval: NodeJS.Timeout | undefined };
      if (options.isPartial && !state.interval) {
        state.interval = setInterval(() => context.invalidate(), SPINNER_INTERVAL_MS);
      }
      if ((!options.isPartial || context.isError) && state.interval) {
        clearInterval(state.interval);
        state.interval = undefined;
      }
      return renderLibrarianResult(result, options, theme, traceContext, context);
    },
  });

  pi.registerCommand("librarian", {
    description: "Attach/detach the librarian's repository tools in this session (on|off|status)",
    getArgumentCompletions: (prefix) =>
      ["on", "off", "status"]
        .filter((option) => option.startsWith(prefix.trim()))
        .map((option) => ({ value: option, label: option })),
    async handler(args, ctx) {
      const argument = args.trim().toLowerCase();
      const currentlyAttached = readAttachState(ctx);

      if (argument === "status") {
        ctx.ui.notify(
          currentlyAttached
            ? `Librarian tools attached: ${repoToolNames.join(", ")}`
            : "Librarian tools not attached. Run /librarian to attach.",
          "info",
        );
        return;
      }

      const nextAttached =
        argument === "on" ? true : argument === "off" ? false : !currentlyAttached;
      if (nextAttached === currentlyAttached) {
        ctx.ui.notify(
          nextAttached ? "Librarian tools already attached." : "Librarian tools already detached.",
          "info",
        );
        return;
      }

      setAttachState(pi, nextAttached, repoToolNames);
    },
  });

  pi.on("session_tree", async (_event: SessionTreeEvent, ctx) => {
    applyAttachState(pi, readAttachState(ctx), repoToolNames);
  });

  pi.on("session_start", async (_event: SessionStartEvent, ctx) => {
    applyAttachState(pi, readAttachState(ctx), repoToolNames);

    const warnings = await collectExtraToolWarnings(pi.getAllTools(), settings);
    for (const warning of warnings) {
      ctx.ui.notify(warning.message, "warning");
    }
  });
}
