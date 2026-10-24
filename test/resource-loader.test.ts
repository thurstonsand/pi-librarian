import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLibrarianResourceLoader } from "../extensions/librarian/resource-loader.ts";

describe("createLibrarianResourceLoader", () => {
  let agentDir: string;
  let cacheDir: string;

  beforeEach(async () => {
    agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "librarian-agent-"));
    cacheDir = await fs.mkdtemp(path.join(os.tmpdir(), "librarian-cache-"));
  });

  afterEach(async () => {
    await fs.rm(agentDir, { recursive: true, force: true });
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it("loads none of the user's prompt files into a run", async () => {
    await fs.writeFile(path.join(agentDir, "AGENTS.md"), "You are Unit 2B.");
    await fs.writeFile(path.join(agentDir, "APPEND_SYSTEM.md"), "Never stage files.");
    await fs.writeFile(path.join(cacheDir, "AGENTS.md"), "Cache-local instructions.");

    const loader = createLibrarianResourceLoader({
      cacheDir,
      agentDir,
      systemPromptOverride: () => "librarian prompt",
    });
    await loader.reload();

    expect(loader.getAgentsFiles().agentsFiles).toEqual([]);
    expect(loader.getAppendSystemPrompt()).toEqual([]);
    expect(loader.getSystemPrompt()).toBe("librarian prompt");
  });
});
