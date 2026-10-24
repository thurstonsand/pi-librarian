import { DefaultResourceLoader, type LoadExtensionsResult } from "@earendil-works/pi-coding-agent";

export function stripExtensionHooks(result: LoadExtensionsResult): LoadExtensionsResult {
  return {
    ...result,
    extensions: result.extensions.map((extension) => ({
      ...extension,
      handlers: new Map(),
    })),
  };
}

export interface LibrarianResourceLoaderOptions {
  cacheDir: string;
  agentDir: string;
  extensionPaths: string[];
  systemPromptOverride: (base: string | undefined) => string | undefined;
}

export function createLibrarianResourceLoader(
  options: LibrarianResourceLoaderOptions,
): DefaultResourceLoader {
  return new DefaultResourceLoader({
    cwd: options.cacheDir,
    agentDir: options.agentDir,
    noExtensions: true,
    ...(options.extensionPaths.length > 0
      ? { additionalExtensionPaths: options.extensionPaths }
      : {}),
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    // A research agent needs none of the user's personal instructions, and a published package
    // would otherwise carry every user's AGENTS.md and APPEND_SYSTEM.md into every run.
    noContextFiles: true,
    appendSystemPromptOverride: () => [],
    extensionsOverride: stripExtensionHooks,
    skillsOverride: () => ({ skills: [], diagnostics: [] }),
    systemPromptOverride: options.systemPromptOverride,
  });
}
