import { DefaultResourceLoader } from "@earendil-works/pi-coding-agent";
export function createLibrarianResourceLoader(options) {
    return new DefaultResourceLoader({
        cwd: options.cacheDir,
        agentDir: options.agentDir,
        noExtensions: true,
        noSkills: true,
        noPromptTemplates: true,
        noThemes: true,
        // A research agent needs none of the user's personal instructions, and a published package
        // would otherwise carry every user's AGENTS.md and APPEND_SYSTEM.md into every run.
        noContextFiles: true,
        appendSystemPromptOverride: () => [],
        skillsOverride: () => ({ skills: [], diagnostics: [] }),
        systemPromptOverride: options.systemPromptOverride,
    });
}
