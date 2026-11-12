import type { Command } from "commander";
import { describe, expect, it } from "vitest";
import { createProgram } from "../src/cli/program.ts";
import { resolveLibrarianSettings } from "../src/core/settings.ts";
import { createRepoClients, createRepoTools } from "../src/core/tools/index.ts";
import { createWebTools } from "../src/core/web/index.ts";

function commandTree(disabled: string[]): Record<string, string[]> {
  const settings = resolveLibrarianSettings({ tools: { disabled } }, {});
  const clients = createRepoClients(settings, async () => undefined);
  const program = createProgram({
    settings,
    clients,
    repoTools: createRepoTools(settings, clients).tools,
    web: createWebTools(settings, clients.github, () => settings.web.fetch),
    setupCodex: async () => "",
    uninstallCodex: async () => "",
    write: () => {},
  });
  return Object.fromEntries(
    program.commands.map((command: Command) => [
      command.name(),
      command.commands.map((child) => child.name()),
    ]),
  );
}

describe("createProgram", () => {
  it("leaves out the commands of disabled tools", () => {
    expect(commandTree([])).toEqual({
      github: ["code", "repos", "read", "clone"],
      grepapp: [],
      clone: [],
      web: ["fetch"],
      codex: ["setup", "uninstall"],
    });
    expect(commandTree(["checkout_repo", "search_code_grepapp", "web_fetch", "bash"])).toEqual({
      github: ["code", "repos", "read"],
      codex: ["setup", "uninstall"],
    });
  });
});
