import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { setupCodex, uninstallCodex } from "../src/cli/codex.ts";

let home: string;

afterEach(() => rmSync(home, { recursive: true, force: true }));

describe("codex setup and uninstall", () => {
  it("writes the role with the codex model settings, and reports what changed", () => {
    home = mkdtempSync(path.join(os.tmpdir(), "librarian-codex-"));
    const env = { CODEX_HOME: home, PATH: "" };

    const first = setupCodex(env, { model: "gpt-6-sol", reasoningEffort: "low" });
    const role = readFileSync(path.join(home, "agents/librarian.toml"), "utf8");
    expect(role).toContain('model = "gpt-6-sol"\nmodel_reasoning_effort = "low"\n');
    expect(role).toContain("developer_instructions = '''\nYou are the Librarian");
    expect(readFileSync(path.join(home, "rules/librarian.rules"), "utf8")).toContain(
      'prefix_rule(pattern=["librarian"], decision="allow")',
    );
    expect(first).toContain(`Created ${path.join(home, "agents/librarian.toml")}`);
    expect(first).toContain("Restart Codex");
    expect(first).toContain("not on PATH");

    const inherited = setupCodex(env, { model: undefined, reasoningEffort: undefined });
    expect(inherited).toContain(`Updated ${path.join(home, "agents/librarian.toml")}`);
    expect(inherited).toContain(`Unchanged ${path.join(home, "rules/librarian.rules")}`);
    expect(readFileSync(path.join(home, "agents/librarian.toml"), "utf8")).not.toMatch(/^model/m);
  });

  it("removes only the files that exist, and only once the user agrees", async () => {
    home = mkdtempSync(path.join(os.tmpdir(), "librarian-codex-"));
    const env = { CODEX_HOME: home, PATH: "" };
    const role = path.join(home, "agents/librarian.toml");
    const rule = path.join(home, "rules/librarian.rules");
    const questions: string[] = [];

    expect(await uninstallCodex(env, async () => true)).toBe(
      `Nothing to remove: neither ${role} nor ${rule} exists.`,
    );

    setupCodex(env, { model: undefined, reasoningEffort: undefined });
    rmSync(rule);
    const declined = await uninstallCodex(env, async (question) => {
      questions.push(question);
      return false;
    });
    expect(declined).toBe("Removed nothing.");
    expect(questions).toEqual([`Remove ${role}?`]);
    expect(existsSync(role)).toBe(true);

    writeFileSync(rule, 'prefix_rule(pattern=["librarian"], decision="allow")\n');
    const accepted = await uninstallCodex(env, async (question) => {
      questions.push(question);
      return true;
    });
    expect(questions[1]).toBe(`Remove ${role} and ${rule}?`);
    expect(accepted).toBe(`Removed ${role}.\nRemoved ${rule}.\nRestart Codex to unload them.`);
    expect(existsSync(role) || existsSync(rule)).toBe(false);
  });
});
