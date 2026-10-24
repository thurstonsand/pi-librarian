import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runLibrarian } from "../extensions/librarian/run.ts";
import type { LibrarianSettings } from "../extensions/librarian/settings.ts";
import { createRepoClients, createRepoTools } from "../extensions/librarian/tools/index.ts";

const { createAgentSession } = vi.hoisted(() => ({
  createAgentSession: vi.fn(),
}));

vi.mock("@earendil-works/pi-coding-agent", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@earendil-works/pi-coding-agent")>()),
  createAgentSession,
}));

interface TestTool {
  name: string;
  execute(toolCallId: string, params: unknown): Promise<unknown>;
}

interface TestSessionOptions {
  modelRuntime: ModelRuntime;
  customTools: TestTool[];
}

const temporaryDirectories: string[] = [];

afterEach(async () => {
  createAgentSession.mockReset();
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true })),
  );
});

describe("runLibrarian", () => {
  it("uses the propagated model runtime for the nested librarian session", async () => {
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-librarian-runtime-test-"));
    temporaryDirectories.push(cacheDir);
    const modelRuntime = {} as ModelRuntime;
    const model = { provider: "anthropic", id: "claude-sonnet" } as Model<Api>;

    const setActiveToolsByName = vi.fn();
    createAgentSession.mockImplementation(async (options: TestSessionOptions) => {
      const provideResults = options.customTools.find((tool) => tool.name === "provide_results");
      if (!provideResults) {
        throw new Error("provide_results tool missing");
      }
      return {
        session: {
          setActiveToolsByName,
          subscribe: vi.fn(() => vi.fn()),
          prompt: vi.fn(async () => {
            await provideResults.execute("provide-results", {
              summary: "Runtime propagated.",
              locations: [],
            });
          }),
          getLastAssistantText: vi.fn(() => ""),
          abort: vi.fn(),
          dispose: vi.fn(),
        },
      };
    });

    const settings: LibrarianSettings = {
      model: undefined,
      thinkingLevel: undefined,
      extensions: [],
      search: { timeoutSeconds: 15, defaultLimit: 10 },
      tools: { extra: ["search_web"], disabled: ["bash", "search_code_grepapp", "search_web"] },
      sources: [
        {
          name: "github",
          url: "https://github.com",
          kind: "github",
          roles: ["clone", "code-search", "repo-search"],
          token: undefined,
          advancedSearch: false,
        },
      ],
      cacheDir,
      debug: { persistRuns: false },
    };
    const result = await runLibrarian({
      query: "Verify runtime propagation",
      repos: [],
      owners: [],
      continueFrom: undefined,
      modelRuntime,
      model,
      thinkingLevel: "off",
      settings,
      extraTools: { extensionPaths: [], toolNames: ["search_web"] },
      repoTools: createRepoTools(
        settings,
        createRepoClients(settings, async () => undefined),
      ).tools,
      signal: undefined,
      onUpdate: undefined,
    });

    expect(createAgentSession).toHaveBeenCalledOnce();
    expect(createAgentSession.mock.calls[0]?.[0].modelRuntime).toBe(modelRuntime);
    const activeTools = setActiveToolsByName.mock.calls[0]?.[0] as string[];
    expect(activeTools).not.toContain("bash");
    expect(activeTools).not.toContain("search_code_grepapp");
    expect(activeTools).not.toContain("search_web");
    expect(activeTools).toContain("checkout_repo");
    expect(result.content[0]).toEqual({
      type: "text",
      text: expect.stringContaining("Runtime propagated."),
    });
    expect(result.details.status).toBe("done");
  });
});
