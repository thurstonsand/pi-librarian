import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateDir } from "../core/paths.ts";
import type { CodexSettings, LibrarianSettings } from "../core/settings.ts";

// Two directories up from both src/cli and the dist/cli bundle.
const AGENT_PROMPT = fileURLToPath(new URL("../../plugin/agents/librarian.md", import.meta.url));

// Codex plugins cannot ship agents, so the role and the rule are files under CODEX_HOME. The rule
// matters as much as the role: under Codex's default workspace-write sandbox the librarian can
// neither write its cache nor reach the network, and Codex offers no unsandboxed retry. An allow
// rule runs a matching command outside the sandbox without asking.
const RULE = `# Written by \`librarian codex setup\`. The librarian role runs the librarian command, which
# writes its cache under ~/.cache/agents/librarian and reaches code hosts over the network; this
# rule runs it outside the sandbox without asking. \`librarian codex uninstall\` removes it.
prefix_rule(pattern=["librarian"], decision="allow")
`;

interface AgentPrompt {
  description: string;
  body: string;
}

function readAgentPrompt(): AgentPrompt {
  const match = /^---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(readFileSync(AGENT_PROMPT, "utf8"));
  const description = match?.[1]?.match(/^description: (".*")$/m)?.[1];
  if (!match?.[2] || !description) {
    throw new Error(`${AGENT_PROMPT} has no quoted description and body`);
  }
  return { description: JSON.parse(description) as string, body: match[2] };
}

// TOML basic strings take JSON's escapes; the prompt goes in a literal block to stay readable.
export function renderCodexRole(prompt: AgentPrompt, codex: CodexSettings): string {
  if (prompt.body.includes("'''")) throw new Error("the librarian prompt cannot contain '''");
  const description = `${prompt.description} Spawn it with fork_turns "none": it needs only the question, not this conversation.`;
  return [
    "# Written by `librarian codex setup`; rerun it after upgrading the librarian or editing its settings.",
    'name = "librarian"',
    `description = ${JSON.stringify(description)}`,
    ...(codex.model ? [`model = ${JSON.stringify(codex.model)}`] : []),
    ...(codex.reasoningEffort
      ? [`model_reasoning_effort = ${JSON.stringify(codex.reasoningEffort)}`]
      : []),
    `developer_instructions = '''\n${prompt.body}'''`,
    "",
  ].join("\n");
}

function write(file: string, content: string): "created" | "updated" | "unchanged" {
  const existing = existsSync(file) ? readFileSync(file, "utf8") : undefined;
  if (existing === content) return "unchanged";
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  return existing === undefined ? "created" : "updated";
}

// A managed Codex may force the sandbox on and refuse the rule; `codex --add-dir` still opens these
// directories, but only ones that exist when Codex starts. The state directory holds the fetch
// worker's socket, hence the same mode the worker creates it with.
function ensureDir(dir: string, mode: number): "created" | "unchanged" {
  if (existsSync(dir)) return "unchanged";
  mkdirSync(dir, { recursive: true, mode });
  return "created";
}

function capitalize(word: string): string {
  return `${word[0]?.toUpperCase()}${word.slice(1)}`;
}

function onPath(command: string, env: NodeJS.ProcessEnv): boolean {
  return (env.PATH ?? "")
    .split(path.delimiter)
    .some((dir) => dir.length > 0 && existsSync(path.join(dir, command)));
}

function codexFiles(env: NodeJS.ProcessEnv): { role: string; rule: string } {
  const home = env.CODEX_HOME?.trim() || path.join(os.homedir(), ".codex");
  return {
    role: path.join(home, "agents", "librarian.toml"),
    rule: path.join(home, "rules", "librarian.rules"),
  };
}

export function setupCodex(env: NodeJS.ProcessEnv, settings: LibrarianSettings): string {
  const { role, rule } = codexFiles(env);
  const roleState = write(role, renderCodexRole(readAgentPrompt(), settings.codex));
  const ruleState = write(rule, RULE);
  const state = stateDir(env);
  const cacheState = ensureDir(settings.cacheDir, 0o777);
  const stateState = ensureDir(state, 0o700);

  const lines = [
    `${capitalize(roleState)} ${role}: the librarian role.`,
    `${capitalize(ruleState)} ${rule}: lets the librarian command run without approval, outside Codex's sandbox.`,
    `${capitalize(cacheState)} ${settings.cacheDir}: the librarian's cache.`,
    `${capitalize(stateState)} ${state}: the librarian's state.`,
  ];
  if (roleState !== "unchanged" || ruleState !== "unchanged") {
    lines.push("Restart Codex to load them.");
  }
  if (!onPath("librarian", env)) {
    lines.push(
      "The librarian command is not on PATH, so the role cannot run it. Install it with `npm install --global @thurstonsand/pi-librarian`.",
    );
  }
  return lines.join("\n");
}

export async function uninstallCodex(
  env: NodeJS.ProcessEnv,
  confirm: (question: string) => Promise<boolean>,
): Promise<string> {
  const { role, rule } = codexFiles(env);
  const present = [role, rule].filter((file) => existsSync(file));
  if (present.length === 0) return `Nothing to remove: neither ${role} nor ${rule} exists.`;
  if (!(await confirm(`Remove ${present.join(" and ")}?`))) return "Removed nothing.";
  for (const file of present) rmSync(file);
  return [...present.map((file) => `Removed ${file}.`), "Restart Codex to unload them."].join("\n");
}
