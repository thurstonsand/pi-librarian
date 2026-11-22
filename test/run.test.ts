import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type AssistantMessage, createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { describe, expect, it, vi } from "vitest";
import { resolveLibrarianSettings } from "../src/core/settings.ts";
import { renderFindingsMarkdown } from "../src/pi/results.ts";
import { type LibrarianRunOptions, runLibrarian } from "../src/pi/run.ts";

const { sources } = resolveLibrarianSettings(
  {
    sources: [
      { name: "example-gl", url: "https://gitlab.example.com", kind: "gitlab" },
      { name: "example-bb", url: "https://git.example.com", kind: "bitbucket-server" },
    ],
  },
  {},
);

describe("runLibrarian", () => {
  it("quotes only text written during a failed continuation", async () => {
    const cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-librarian-continuation-"));
    vi.stubEnv("PI_CODING_AGENT_DIR", path.join(cacheDir, "agent"));
    try {
      const modelRuntime = await ModelRuntime.create({ modelsPath: null, refreshOnCreate: false });
      const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      let reply: AssistantMessage["content"] = [
        {
          type: "toolCall",
          id: "publish-findings",
          name: "provide_results",
          arguments: { summary: "The initial invocation succeeded.", locations: [] },
        },
      ];
      let failure = false;
      modelRuntime.registerProvider("fixture", {
        baseUrl: "http://127.0.0.1:1",
        api: "fixture-api",
        apiKey: "fixture",
        models: [
          {
            id: "scripted",
            name: "Scripted",
            reasoning: false,
            input: ["text"],
            cost,
            contextWindow: 32000,
            maxTokens: 4000,
          },
        ],
        streamSimple(model, context) {
          const stream = createAssistantMessageEventStream();
          const afterTool = context.messages.at(-1)?.role === "toolResult";
          const reason = afterTool ? "stop" : "toolUse";
          const message: AssistantMessage = {
            role: "assistant",
            api: model.api,
            provider: model.provider,
            model: model.id,
            content: afterTool
              ? [{ type: "text", text: "Text from an earlier invocation." }]
              : reply,
            usage: { ...cost, totalTokens: 0, cost: { ...cost, total: 0 } },
            stopReason: failure ? "error" : reason,
            timestamp: Date.now(),
          };
          if (failure) {
            reply = [];
            stream.push({ type: "error", reason: "error", error: message });
          } else {
            stream.push({ type: "done", reason, message });
          }
          stream.end();
          return stream;
        },
      });
      const model = modelRuntime.getModel("fixture", "scripted");
      if (!model) throw new Error("Missing fixture model");
      const options: LibrarianRunOptions = {
        query: "Initial research",
        continueFrom: undefined,
        modelRuntime,
        model,
        thinkingLevel: "off",
        settings: resolveLibrarianSettings({ cacheDir }, {}),
        tools: [],
        signal: undefined,
        onUpdate: undefined,
      };
      const initial = await runLibrarian(options);
      const runId = initial.details.runId;
      expect(initial.details.findings?.summary).toBe("The initial invocation succeeded.");
      if (!runId) throw new Error("Initial invocation did not return a run ID");

      failure = true;
      reply = [];
      await expect(
        runLibrarian({ ...options, query: "Silent failure", continueFrom: runId }),
      ).rejects.toThrow(`Librarian was not able to report findings.\n\nrun: ${runId}`);

      reply = [{ type: "text", text: "Current invocation made partial progress." }];
      await expect(
        runLibrarian({ ...options, query: "Failure with text", continueFrom: runId }),
      ).rejects.toThrow(
        `Librarian was not able to report findings.\n\nRaw final message:\nCurrent invocation made partial progress.\n\nrun: ${runId}`,
      );
    } finally {
      vi.unstubAllEnvs();
      await fs.rm(cacheDir, { recursive: true });
    }
  });
});

describe("renderFindingsMarkdown", () => {
  it("names each location's source and links it at the commit that was checked out", () => {
    const markdown = renderFindingsMarkdown(
      {
        summary: "Two services disagree on jitter.",
        locations: [
          {
            source: "github",
            repo: "drizzle-team/drizzle-orm",
            file: "drizzle-orm/src/d1/session.ts",
            lines: "50-72",
            note: "prepareQuery implementation",
          },
          {
            source: "example-gl",
            repo: "platform/widget-sdk",
            file: "src/retry.ts",
            lines: "29-44",
            note: "full jitter",
          },
          {
            source: "example-bb",
            repo: "CORE/deploy-cli",
            file: "internal/backoff.go",
            lines: "12",
            note: "no jitter",
          },
          {
            source: "codeberg.org",
            repo: "acme/retry-kit",
            file: "retry.go",
            note: "cloned by URL from an undeclared host",
          },
        ],
        description: "## Flow\n1. build query",
      },
      {
        "github.com/drizzle-team/drizzle-orm": "48e5406027103a9fca6eb66417187c4a8b5c6aa3",
        "gitlab.example.com/platform/widget-sdk": "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678",
      },
      sources,
    );

    expect(markdown).toBe(`Two services disagree on jitter.

## Locations

- \`github:drizzle-team/drizzle-orm/drizzle-orm/src/d1/session.ts:50-72\` — prepareQuery implementation
  https://github.com/drizzle-team/drizzle-orm/blob/48e540602710/drizzle-orm/src/d1/session.ts#L50-L72
- \`example-gl:platform/widget-sdk/src/retry.ts:29-44\` — full jitter
  https://gitlab.example.com/platform/widget-sdk/-/blob/a1b2c3d4e5f6/src/retry.ts#L29-44
- \`example-bb:CORE/deploy-cli/internal/backoff.go:12\` — no jitter
  https://git.example.com/projects/CORE/repos/deploy-cli/browse/internal/backoff.go#12
- \`codeberg.org:acme/retry-kit/retry.go\` — cloned by URL from an undeclared host

## Flow
1. build query`);
  });

  it("omits the locations section when empty", () => {
    const markdown = renderFindingsMarkdown(
      { summary: "Nothing found.", locations: [] },
      {},
      sources,
    );
    expect(markdown).toBe("Nothing found.");
  });
});
