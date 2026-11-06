#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { resolveGhCliToken } from "../core/github.ts";
import { librarianPaths, migrateFromPi, piLegacyPaths } from "../core/migrate.ts";
import { loadSettings } from "../core/settings.ts";
import { createRepoClients, createRepoTools } from "../core/tools/index.ts";
import { createWebTools } from "../core/web/index.ts";
import { getErrorMessage } from "../core/web/shared.ts";
import { setupCodex, uninstallCodex } from "./codex.ts";
import { createProgram } from "./program.ts";

try {
  for (const move of migrateFromPi(piLegacyPaths(process.env), librarianPaths(process.env))) {
    process.stderr.write(`librarian: moved its ${move}\n`);
  }
  const settings = loadSettings(process.env);
  const clients = createRepoClients(settings, resolveGhCliToken);
  const program = createProgram({
    settings,
    clients,
    repoTools: createRepoTools(settings, clients).tools,
    web: createWebTools(settings, clients.github, () => loadSettings(process.env).web.fetch),
    setupCodex: async () => setupCodex(process.env, settings.codex),
    uninstallCodex: () =>
      uninstallCodex(process.env, async (question) => {
        const prompt = createInterface({ input: process.stdin, output: process.stderr });
        // question() never settles when stdin ends unanswered; the interface closes instead.
        const closed = new Promise<string>((resolve) => prompt.once("close", () => resolve("")));
        const answer = await Promise.race([prompt.question(`${question} [y/N] `), closed]);
        prompt.close();
        return /^y(es)?$/i.test(answer.trim());
      }),
    write: (text) => process.stdout.write(text),
  });
  await program.parseAsync();
} catch (error) {
  process.stderr.write(`librarian: ${getErrorMessage(error)}\n`);
  process.exitCode = 1;
}
