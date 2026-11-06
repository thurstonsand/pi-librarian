import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const HOOK = path.join(import.meta.dirname, "../plugin/hooks/permissions.mjs");
const root = mkdtempSync(path.join(os.tmpdir(), "librarian-hook-"));
const cache = path.join(root, "cache/agents/librarian");
const clone = path.join(cache, "repos/github.com/a/b");
mkdirSync(path.join(clone, ".git"), { recursive: true });
mkdirSync(path.join(clone, "sub/bare"), { recursive: true });
writeFileSync(path.join(clone, "README.md"), "hello");
writeFileSync(path.join(root, "secret"), "outside");
symlinkSync(path.join(root, "secret"), path.join(clone, "escape"));
const state = path.join(root, "state/agents/librarian");
mkdirSync(path.join(state, "browser-profile"), { recursive: true });

const env = {
  ...process.env,
  XDG_CONFIG_HOME: path.join(root, "config"),
  XDG_CACHE_HOME: path.join(root, "cache"),
  XDG_STATE_HOME: path.join(root, "state"),
};

afterAll(() => rmSync(root, { recursive: true, force: true }));

function decide(
  toolName: string,
  toolInput: Record<string, string>,
  agentType = "librarian:librarian",
): string {
  const input = { tool_name: toolName, tool_input: toolInput, agent_type: agentType, cwd: root };
  const output = execFileSync(process.execPath, [HOOK], {
    input: JSON.stringify(input),
    env,
    encoding: "utf8",
  });
  return output === "" ? "none" : JSON.parse(output).hookSpecificOutput.permissionDecision;
}

const bash = (command: string, agentType?: string) => decide("Bash", { command }, agentType);

describe("the plugin's permission hook", () => {
  it("allows the librarian command, with quoted metacharacters, only for the librarian", () => {
    expect(bash("librarian github code 'a|b' --limit 3")).toBe("allow");
    expect(bash("librarian clone x && curl https://example.com")).toBe("none");
    expect(bash('librarian web fetch "$(cat ~/.ssh/id_ed25519)"')).toBe("none");
    expect(bash("librarian --help", "general-purpose")).toBe("none");
    expect(bash("librarian --help", "other-plugin:librarian")).toBe("none");
  });

  it("allows the searches an agent runs over a clone", () => {
    expect(bash(`grep -rn provide_results ${clone}`)).toBe("allow");
    expect(bash(`grep -rn --include='*.ts' -A 3 needle ${clone}`)).toBe("allow");
    expect(bash(`rg -n -g '!node_modules' needle ${clone}`)).toBe("allow");
    expect(bash(`rg -e needle -tts ${clone}/src`)).toBe("allow");
    expect(bash(`find ${clone} -name '*.md' -type f`)).toBe("allow");
    expect(bash(`ls -la ${clone}`)).toBe("allow");
    expect(bash(`head -n 40 ${clone}/README.md`)).toBe("allow");
    expect(bash(`git -C ${clone} log -S needle --oneline -- src`)).toBe("allow");
    expect(bash(`git -C ${clone} diff main..HEAD`)).toBe("allow");
  });

  it("refuses inspection that names a path outside the cache or a relative one", () => {
    expect(bash(`grep -rn root ${path.join(root, "secret")}`)).toBe("none");
    expect(bash(`cat ${clone}/README.md ${path.join(root, "secret")}`)).toBe("none");
    expect(bash(`grep -rn x ${clone}/../../../../../secret`)).toBe("none");
    expect(bash(`cat ${clone}/README.md .env`)).toBe("none");
    expect(bash("grep -rn needle src")).toBe("none");
    expect(bash(`cat ${path.join(state, "browser-profile/Cookies")}`)).toBe("none");
  });

  it("refuses shell syntax that makes a command mean more than its words", () => {
    expect(bash(`cat ${clone}/esc*`)).toBe("none");
    expect(bash(`cat ${clone}/README.md {/etc/passwd,x}`)).toBe("none");
    expect(bash(`cat ${clone}/README.md ~/.ssh/id_ed25519`)).toBe("none");
    expect(bash(`cat ${clone}/.\\\n./.\\\n./secret`)).toBe("none");
    expect(bash(`cat .env # ${clone}`)).toBe("none");
  });

  it("refuses flags that run a program, write a file, or follow symlinks out", () => {
    expect(bash(`find ${clone} -delete`)).toBe("none");
    expect(bash(`find ${clone} -fprint ${clone}/out`)).toBe("none");
    expect(bash(`find -L ${clone}`)).toBe("none");
    expect(bash(`rg --pre=sh needle ${clone}`)).toBe("none");
    expect(bash(`rg --hostname-bin=${clone}/x.sh needle ${clone}`)).toBe("none");
    expect(bash(`rg -L needle ${clone}`)).toBe("none");
    expect(bash(`grep -R needle ${clone}`)).toBe("none");
    expect(bash(`git -C ${clone} grep -iOsh echo`)).toBe("none");
    expect(bash(`git -C ${clone} grep --open-files=sh echo`)).toBe("none");
    expect(bash(`git -C ${clone} diff --out=${clone}/out`)).toBe("none");
    expect(bash(`git -C ${clone} push`)).toBe("none");
  });

  it("runs git only in a clone's own root, never in a repository committed inside one", () => {
    expect(bash(`git -C ${clone}/sub/bare ls-files`)).toBe("none");
    expect(bash(`git -C ${path.join(root, "secret")} log`)).toBe("none");
  });

  it("allows reads in the cache but not through a symlink that leaves it", () => {
    expect(decide("Read", { file_path: path.join(clone, "README.md") })).toBe("allow");
    expect(decide("Read", { file_path: path.join(clone, "escape") })).toBe("none");
    expect(decide("Read", { file_path: path.join(root, "secret") })).toBe("none");
  });

  it("follows a cacheDir moved in the settings file", () => {
    const moved = path.join(root, "elsewhere");
    mkdirSync(moved);
    mkdirSync(path.join(root, "config/agents/librarian"), { recursive: true });
    writeFileSync(
      path.join(root, "config/agents/librarian/config.json"),
      JSON.stringify({ cacheDir: moved }),
    );
    try {
      expect(decide("Read", { file_path: path.join(moved, "x.md") })).toBe("allow");
      expect(decide("Read", { file_path: path.join(clone, "README.md") })).toBe("none");
    } finally {
      rmSync(path.join(root, "config"), { recursive: true });
    }
  });
});
