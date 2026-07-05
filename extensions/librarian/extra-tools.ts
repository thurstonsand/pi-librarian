import type { ToolInfo } from "@earendil-works/pi-coding-agent";
import { createLibrarianResourceLoader } from "./resource-loader.ts";
import type { LibrarianSettings } from "./settings.ts";
import { LIBRARIAN_RUN_TOOL_NAMES } from "./tools/names.ts";

export const LIBRARIAN_BASELINE_TOOL_NAMES = ["read", "grep", "find", "ls", "bash"] as const;

const LIBRARIAN_SELF_TOOL_NAMES = new Set<string>(["librarian", ...LIBRARIAN_RUN_TOOL_NAMES]);

export type ExtraToolWarningReason = "self" | "unresolved" | "extensionLoad";

export interface ExtraToolWarning {
  toolName: string;
  reason: ExtraToolWarningReason;
  message: string;
}

export interface ExtraToolsResolution {
  extensionPaths: string[];
  toolNames: string[];
}

interface ExtraToolsValidation {
  resolution: ExtraToolsResolution;
  warnings: ExtraToolWarning[];
  unresolvedToolNames: string[];
}

function resolveExtraToolsForValidation(
  toolInfos: ToolInfo[],
  settings: LibrarianSettings,
): ExtraToolsValidation {
  const toolInfosByName = new Map(toolInfos.map((toolInfo) => [toolInfo.name, toolInfo]));
  const extensionPaths = new Set(settings.extensions);
  const toolNames = new Set<string>();
  const warnings: ExtraToolWarning[] = [];
  const unresolvedToolNames: string[] = [];

  for (const toolName of settings.tools) {
    if (LIBRARIAN_SELF_TOOL_NAMES.has(toolName)) {
      warnings.push({
        toolName,
        reason: "self",
        message: `librarian.tools includes ${toolName}, but librarian's own tools cannot be opted into librarian runs. Remove it from librarian.tools.`,
      });
      continue;
    }

    const toolInfo = toolInfosByName.get(toolName);
    if (!toolInfo) {
      toolNames.add(toolName);
      unresolvedToolNames.push(toolName);
      warnings.push({
        toolName,
        reason: "unresolved",
        message: `librarian.tools includes ${toolName}, but no loaded pi tool has that name.`,
      });
      continue;
    }

    toolNames.add(toolName);
    if (toolInfo.sourceInfo.source !== "builtin") {
      extensionPaths.add(toolInfo.sourceInfo.path);
    }
  }

  return {
    resolution: {
      extensionPaths: [...extensionPaths],
      toolNames: [...toolNames],
    },
    warnings,
    unresolvedToolNames,
  };
}

export function resolveExtraTools(
  toolInfos: ToolInfo[],
  settings: LibrarianSettings,
): ExtraToolsResolution {
  return resolveExtraToolsForValidation(toolInfos, settings).resolution;
}

export async function collectExtraToolWarnings(
  toolInfos: ToolInfo[],
  settings: LibrarianSettings,
): Promise<ExtraToolWarning[]> {
  const validation = resolveExtraToolsForValidation(toolInfos, settings);
  const nonUnresolvedWarnings = validation.warnings.filter(
    (warning) => warning.reason !== "unresolved",
  );

  if (validation.unresolvedToolNames.length === 0 || settings.extensions.length === 0) {
    return validation.warnings;
  }

  const resourceLoader = createLibrarianResourceLoader({
    cacheDir: settings.cacheDir,
    extensionPaths: settings.extensions,
    systemPromptOverride: () => undefined,
  });
  await resourceLoader.reload();

  const extensionsResult = resourceLoader.getExtensions();
  const escapeHatchToolNames = new Set<string>();
  for (const extension of extensionsResult.extensions) {
    for (const toolName of extension.tools.keys()) {
      escapeHatchToolNames.add(toolName);
    }
  }

  const loaderWarnings = extensionsResult.errors.map((error) => ({
    toolName: error.path,
    reason: "extensionLoad" as const,
    message: `librarian.extensions failed to load ${error.path}: ${error.error}`,
  }));

  const unresolvedWarnings = validation.unresolvedToolNames
    .filter((toolName) => !escapeHatchToolNames.has(toolName))
    .map((toolName) => ({
      toolName,
      reason: "unresolved" as const,
      message:
        loaderWarnings.length > 0
          ? `librarian.tools includes ${toolName}, but it was not found in the main session or successfully loaded escape-hatch tools. Fix librarian.extensions load errors or the tool name.`
          : `librarian.tools includes ${toolName}, but no loaded pi tool or escape-hatch extension tool has that name.`,
    }));

  return [...nonUnresolvedWarnings, ...loaderWarnings, ...unresolvedWarnings];
}
