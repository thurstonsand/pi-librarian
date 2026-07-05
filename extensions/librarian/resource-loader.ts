import {
  DefaultResourceLoader,
  getAgentDir,
  type LoadExtensionsResult,
} from "@earendil-works/pi-coding-agent";

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
  extensionPaths: string[];
  systemPromptOverride: (base: string | undefined) => string | undefined;
}

export function createLibrarianResourceLoader(
  options: LibrarianResourceLoaderOptions,
): DefaultResourceLoader {
  return new DefaultResourceLoader({
    cwd: options.cacheDir,
    agentDir: getAgentDir(),
    noExtensions: true,
    ...(options.extensionPaths.length > 0
      ? { additionalExtensionPaths: options.extensionPaths }
      : {}),
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    extensionsOverride: stripExtensionHooks,
    skillsOverride: () => ({ skills: [], diagnostics: [] }),
    systemPromptOverride: options.systemPromptOverride,
  });
}
