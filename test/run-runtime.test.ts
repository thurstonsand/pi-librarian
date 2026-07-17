import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runLibrarian } from "../extensions/librarian/run.ts";

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

    createAgentSession.mockImplementation(async (options: TestSessionOptions) => {
      const provideResults = options.customTools.find((tool) => tool.name === "provide_results");
      if (!provideResults) {
        throw new Error("provide_results tool missing");
      }
      return {
        session: {
          setActiveToolsByName: vi.fn(),
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

    const result = await runLibrarian({
      query: "Verify runtime propagation",
      repos: [],
      owners: [],
      continueFrom: undefined,
      modelRuntime,
      model,
      thinkingLevel: "off",
      settings: {
        model: undefined,
        thinkingLevel: undefined,
        extensions: [],
        tools: [],
        cacheDir,
        debug: { persistRuns: false },
      },
      extraTools: { extensionPaths: [], toolNames: [] },
      githubClient: async () => {
        throw new Error("GitHub client should not be used");
      },
      signal: undefined,
      onUpdate: undefined,
    });

    expect(createAgentSession).toHaveBeenCalledOnce();
    expect(createAgentSession.mock.calls[0]?.[0].modelRuntime).toBe(modelRuntime);
    expect(result.content[0]).toEqual({
      type: "text",
      text: expect.stringContaining("Runtime propagated."),
    });
    expect(result.details.status).toBe("done");
  });
});
