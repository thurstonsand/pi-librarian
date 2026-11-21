import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { resolveGhCliToken } from "../core/github.js";
import { librarianPaths, migrateFromPi, piLegacyPaths } from "../core/migrate.js";
import { loadSettings } from "../core/settings.js";
import { createRepoClients, createRepoTools } from "../core/tools/index.js";
import { createWebTools } from "../core/web/index.js";
import { getErrorMessage } from "../core/web/shared.js";
import { ATTACH_ENTRY_TYPE, applyAttachState, readAttachState, renderAttachEntry, setAttachState, } from "./attach.js";
import { resolveLibrarianModel } from "./model.js";
import { createLibrarianModelRuntime } from "./model-runtime.js";
import { runLibrarian } from "./run.js";
import { formatTraceLine, renderLibrarianCall, renderLibrarianResult, renderRepoToolResult, SPINNER_INTERVAL_MS, shorten, } from "./view.js";
import { withWebFetchRendering, withWebSearchRendering } from "./web-render.js";
const LibrarianParams = Type.Object({
    query: Type.String({
        description: "The research question. Include everything you already know: symbols, error messages, the repositories involved and the source they live on, desired output shape. Do not guess unknown details — say what is uncertain and let the librarian discover it.",
    }),
    continue_from: Type.Optional(Type.String({
        description: "Run id from an earlier librarian result. Pass this for follow-up questions for that prior run.",
    })),
});
export default function librarianExtension(pi) {
    const migrated = migrateFromPi(piLegacyPaths(process.env), librarianPaths(process.env));
    const settings = loadSettings(process.env);
    const clients = createRepoClients(settings, resolveGhCliToken);
    const { tools: repoTools, impliedSources } = createRepoTools(settings, clients);
    const web = createWebTools(settings, clients.github, () => loadSettings(process.env).web.fetch);
    const webTools = [
        ...(web.search ? [withWebSearchRendering(web.search)] : []),
        withWebFetchRendering(web.fetch),
    ];
    const repoToolNames = repoTools.map((tool) => tool.name);
    const traceContext = {
        cacheDir: settings.cacheDir,
        impliedSources,
        sources: settings.sources,
    };
    pi.registerEntryRenderer(ATTACH_ENTRY_TYPE, (entry, { expanded }, theme) => renderAttachEntry(entry.data, expanded, theme));
    for (const tool of repoTools) {
        pi.registerTool({
            ...tool,
            defaultActive: false,
            // pi renders a result only once one exists, so a tool that sends no update until it finishes
            // would show nothing while it runs.
            execute(toolCallId, params, signal, onUpdate) {
                onUpdate?.({ content: [], details: undefined });
                return tool.execute(toolCallId, params, signal, onUpdate);
            },
            renderCall(args, theme) {
                const { verb, subject } = formatTraceLine({ name: tool.name, args, id: "", startedAt: 0 }, traceContext);
                return new Text(`${theme.fg("toolTitle", theme.bold(verb))} ${theme.fg("toolOutput", subject)}`, 0, 0);
            },
            renderResult(result, options, theme, context) {
                return renderRepoToolResult(tool.name, result, options, theme, context);
            },
        });
    }
    for (const tool of webTools) {
        pi.registerTool(tool);
    }
    pi.registerTool({
        name: "librarian",
        label: "Librarian",
        description: "Understand complex, multi-repo codebases, exploring cross-repo relationships, analyzing architectural patterns, finding implementations across codebases, understanding code evolution/commit history, diving deep on specific code bases, getting comprehensive feature explanations, and exploring end-to-end system design across within or across repositories.",
        promptSnippet: "Research repositories and codebases, returning cited findings",
        promptGuidelines: [
            "Use librarian for deep, multi-step research across repos; for a single file or reference, prefer cheaper means (downloaded dependencies, web search or fetch).",
        ],
        parameters: LibrarianParams,
        annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
        async execute(_toolCallId, params, signal, onUpdate, ctx) {
            const modelRuntime = await createLibrarianModelRuntime(ctx.modelRegistry);
            const thinkingLevel = settings.pi.thinkingLevel ?? pi.getThinkingLevel();
            const resolution = resolveLibrarianModel(modelRuntime, ctx.model, settings.pi.model, thinkingLevel);
            if (resolution.warning) {
                ctx.ui.notify(resolution.warning, "warning");
            }
            return runLibrarian({
                query: params.query,
                continueFrom: params.continue_from,
                modelRuntime,
                model: resolution.model,
                thinkingLevel: resolution.thinkingLevel,
                settings,
                tools: [...repoTools, ...webTools],
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
            const state = context.state;
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
        getArgumentCompletions: (prefix) => ["on", "off", "status"]
            .filter((option) => option.startsWith(prefix.trim()))
            .map((option) => ({ value: option, label: option })),
        async handler(args, ctx) {
            const argument = args.trim().toLowerCase();
            const currentlyAttached = readAttachState(ctx);
            if (argument === "status") {
                ctx.ui.notify(currentlyAttached
                    ? `Librarian tools attached: ${repoToolNames.join(", ")}`
                    : "Librarian tools not attached. Run /librarian to attach.", "info");
                return;
            }
            const nextAttached = argument === "on" ? true : argument === "off" ? false : !currentlyAttached;
            if (nextAttached === currentlyAttached) {
                ctx.ui.notify(nextAttached ? "Librarian tools already attached." : "Librarian tools already detached.", "info");
                return;
            }
            setAttachState(pi, nextAttached, repoToolNames);
        },
    });
    pi.registerCommand("browser", {
        description: "Fetch browser: `open` for interactive login, `restart` to apply settings",
        getArgumentCompletions: (prefix) => ["open", "restart"]
            .filter((option) => option.startsWith(prefix.trim()))
            .map((option) => ({ value: option, label: option })),
        async handler(args, ctx) {
            try {
                switch (args.trim() || "open") {
                    case "open":
                        await web.worker.openBrowser();
                        ctx.ui.notify("Interactive browser open — log in as needed, then quit Chrome to resume fetching", "info");
                        break;
                    case "restart":
                        await web.worker.restart();
                        ctx.ui.notify("Fetch worker stopped — the next fetch relaunches it with current settings", "info");
                        break;
                    default:
                        ctx.ui.notify("usage: /browser [open|restart]", "error");
                }
            }
            catch (error) {
                ctx.ui.notify(`browser command failed: ${getErrorMessage(error)}`, "error");
            }
        },
    });
    pi.on("session_tree", async (_event, ctx) => {
        applyAttachState(pi, readAttachState(ctx), repoToolNames);
    });
    pi.on("session_start", async (_event, ctx) => {
        applyAttachState(pi, readAttachState(ctx), repoToolNames);
        for (const move of migrated.splice(0)) {
            ctx.ui.notify(`Librarian moved its ${move}`, "info");
        }
    });
}
