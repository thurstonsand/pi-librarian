import type { ExtensionAPI, SessionStartEvent } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { applyAttachState, readAttachState, setAttachState } from "./librarian/attach.ts";
import { createGitHubClientProvider } from "./librarian/github.ts";
import { resolveLibrarianModel } from "./librarian/model.ts";
import { type LibrarianRunDetails, runLibrarian, type TraceCall } from "./librarian/run.ts";
import { loadSettings } from "./librarian/settings.ts";
import { createCheckoutRepoTool } from "./librarian/tools/checkout-repo.ts";
import { ATTACHABLE_TOOL_NAMES } from "./librarian/tools/names.ts";
import { createReadGitHubFileTool } from "./librarian/tools/read-github-file.ts";
import { searchCodeTool } from "./librarian/tools/search-code.ts";
import { createSearchGitHubCodeTool } from "./librarian/tools/search-github-code.ts";
import { createSearchReposTool } from "./librarian/tools/search-repos.ts";
import {
  formatTraceLine,
  renderLibrarianCall,
  renderLibrarianResult,
  shorten,
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
});

export default function librarianExtension(pi: ExtensionAPI): void {
  const settings = loadSettings();
  const githubClient = createGitHubClientProvider();

  const attachableTools = [
    createSearchReposTool(githubClient),
    searchCodeTool,
    createSearchGitHubCodeTool(githubClient),
    createCheckoutRepoTool(settings.cacheDir),
    createReadGitHubFileTool(githubClient),
  ];

  for (const tool of attachableTools) {
    pi.registerTool({
      ...tool,
      description: `${tool.description} (Librarian tool, attached via /librarian: use for quick single lookups; delegate multi-step research to the librarian tool.)`,
      renderCall(args, theme) {
        const { verb, subject } = formatTraceLine(
          { name: tool.name, args, id: "", startedAt: 0 } satisfies TraceCall,
          settings.cacheDir,
        );
        return new Text(
          `${theme.fg("toolTitle", theme.bold(verb))} ${theme.fg("toolOutput", subject)}`,
          0,
          0,
        );
      },
    });
  }

  pi.registerTool<typeof LibrarianParams, LibrarianRunDetails>({
    name: "librarian",
    label: "Librarian",
    description:
      "Understand complex, multi-repo codebases, exploring cross-repo relationships, analyzing architectural patterns, finding implementations across codebases, understanding code evolution/commit history, diving deep on specific code bases, getting comprehensive feature explanations, and exploring end-to-end system design across within or across repositories.",
    promptSnippet:
      "librarian: research GitHub repos (implementation questions, ecosystem comparisons, usage examples) and return cited findings",
    promptGuidelines: [
      "If a single file or reference must be located, you may use other means (search for downloaded dependencies, web search, etc), but for deeper queries that will take multiple steps to resolve, prefer the librarian.",
    ],
    parameters: LibrarianParams,

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const thinkingLevel = settings.thinkingLevel ?? pi.getThinkingLevel();
      const resolution = resolveLibrarianModel(ctx, settings.model, thinkingLevel);
      if (!resolution) {
        return {
          content: [
            {
              type: "text",
              text: "No model available for the librarian. Configure librarian.model or select a session model.",
            },
          ],
          details: {
            status: "error",
            query: params.query,
            modelLabel: "(none)",
            thinkingLevel,
            trace: [],
            checkouts: {},
            startedAt: Date.now(),
            endedAt: Date.now(),
            error: "No model available.",
          } satisfies LibrarianRunDetails,
          isError: true,
        };
      }

      return runLibrarian({
        query: params.query,
        repos: params.repos ?? [],
        owners: params.owners ?? [],
        model: resolution.model,
        thinkingLevel: resolution.thinkingLevel,
        settings,
        githubClient,
        signal,
        onUpdate: onUpdate
          ? (details) => {
              onUpdate({
                content: [{ type: "text", text: `Researching: ${shorten(params.query, 80)}` }],
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
      return renderLibrarianResult(result, options, theme, settings.cacheDir, context);
    },
  });

  pi.registerCommand("librarian", {
    description: "Attach/detach the librarian's GitHub tools in this session (on|off|status)",
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
            ? `Librarian tools attached: ${ATTACHABLE_TOOL_NAMES.join(", ")}`
            : "Librarian tools not attached. Run /librarian to attach.",
          "info",
        );
        return;
      }

      const nextAttached =
        argument === "on" ? true : argument === "off" ? false : !currentlyAttached;
      if (nextAttached === currentlyAttached) {
        ctx.ui.notify(
          nextAttached ? "Librarian tools already attached." : "Librarian tools not attached.",
          "info",
        );
        return;
      }

      setAttachState(pi, nextAttached);
      ctx.ui.notify(
        nextAttached
          ? `Attached librarian tools: ${ATTACHABLE_TOOL_NAMES.join(", ")}`
          : "Detached librarian tools.",
        "info",
      );
    },
  });

  pi.on("session_start", async (_event: SessionStartEvent, ctx) => {
    applyAttachState(pi, readAttachState(ctx));
  });
}
