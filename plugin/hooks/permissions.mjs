// PreToolUse hook. For the librarian subagent only, it allows what Claude Code would otherwise
// prompt for or refuse: running the `librarian` command, and reading and searching the librarian's
// cache, which lies outside the workspace. Claude Code has no search tool of its own, and refuses a
// shell search outside the workspace unless a hook allows it. Anything else, and every other agent,
// gets no decision, so Claude Code's own permission rules apply.
//
// The cache holds repositories anyone can publish, and the agent reads them, so a command here may
// have been written by whoever wrote a cloned file. Inspection is therefore an allowlist: a fixed
// set of programs, each with the flags known to only read, over absolute paths inside the cache.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";

function xdgDir(variable, fallback) {
  const base = process.env[variable]?.trim() || path.join(os.homedir(), ...fallback);
  return path.join(base, "agents", "librarian");
}

// Mirrors the CLI's settings resolution for the one key that moves the cache.
function cacheDir() {
  const settings = path.join(xdgDir("XDG_CONFIG_HOME", [".config"]), "config.json");
  let configured;
  try {
    configured = JSON.parse(readFileSync(settings, "utf8")).cacheDir?.trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (!configured) return xdgDir("XDG_CACHE_HOME", [".cache"]);
  return configured === "~" || configured.startsWith("~/")
    ? path.join(os.homedir(), configured.slice(2))
    : configured;
}

// Real paths, so a symlink inside a clone cannot lead a read out of the cache.
function real(target) {
  try {
    return realpathSync(target);
  } catch (error) {
    if (error.code === "ENOENT") return target;
    throw error;
  }
}

function insideCache(target) {
  const relative = path.relative(real(cacheDir()), real(target));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

// The words of one simple command, or null when the shell could make it mean more than its words:
// an operator, redirection, substitution, expansion, unquoted glob, comment, or line continuation.
function words(command) {
  const result = [];
  let word = null;
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (char === "\\" && command[index + 1] === "\n") return null;
    if (quote === "'") {
      if (char === "'") quote = null;
      else word += char;
    } else if (quote === '"') {
      if (char === '"') quote = null;
      else if (char === "$" || char === "`") return null;
      else if (char === "\\" && index + 1 < command.length) word += command[++index];
      else word += char;
    } else if (char === "'" || char === '"') {
      quote = char;
      word ??= "";
    } else if (char === "\\" && index + 1 < command.length) {
      word = (word ?? "") + command[++index];
    } else if (char === " " || char === "\t") {
      if (word !== null) result.push(word);
      word = null;
    } else if (";&|<>()`$\n{}~*?[]!".includes(char) || (char === "#" && word === null)) {
      return null;
    } else {
      word = (word ?? "") + char;
    }
  }
  if (quote !== null) return null;
  if (word !== null) result.push(word);
  return result;
}

// Per program: the short flags that may be grouped (`-rn`), the short flags that take a value
// (`-A 3` or `-A3`), and the long flags, with `=` marking those that take one. Anything else is
// refused, including flags that follow symlinks, run another program, or write a file.
const PROGRAMS = {
  grep: {
    flags: "rnilcwFEHhosvxLZ",
    valued: "ABCme",
    long: [
      "recursive",
      "line-number",
      "ignore-case",
      "files-with-matches",
      "count",
      "word-regexp",
      "fixed-strings",
      "extended-regexp",
      "only-matching",
      "invert-match",
      "include=",
      "exclude=",
      "exclude-dir=",
      "context=",
      "after-context=",
      "before-context=",
      "max-count=",
    ],
    pattern: true,
  },
  rg: {
    flags: "nilcwFSsuvxoHINUq",
    valued: "ABCmegtTM",
    long: [
      "line-number",
      "ignore-case",
      "smart-case",
      "case-sensitive",
      "files-with-matches",
      "count",
      "word-regexp",
      "fixed-strings",
      "only-matching",
      "invert-match",
      "multiline",
      "hidden",
      "no-ignore",
      "files",
      "json",
      "glob=",
      "iglob=",
      "type=",
      "type-not=",
      "context=",
      "after-context=",
      "before-context=",
      "max-count=",
      "max-columns=",
      "max-depth=",
    ],
    pattern: true,
  },
  find: { flags: "", valued: "", long: [], primaries: true },
  ls: { flags: "aAlhR1tSrdF", valued: "", long: [] },
  cat: { flags: "n", valued: "", long: [] },
  head: { flags: "", valued: "nc", long: [] },
  tail: { flags: "", valued: "nc", long: [] },
  wc: { flags: "lwcm", valued: "", long: [] },
};

// find's expression, none of which runs, writes, or follows a symlink.
const FIND_VALUED = new Set([
  "-name",
  "-iname",
  "-path",
  "-ipath",
  "-type",
  "-maxdepth",
  "-mindepth",
  "-size",
]);
const FIND_BARE = new Set(["-print", "-not", "-o", "-a", "-empty"]);

// git reads committed history, which a repository cannot turn into a command; its configuration is
// the one the clone was created with. Long options are refused by unique prefix too, as git
// accepts abbreviations.
const GIT_READS = new Set([
  "log",
  "show",
  "blame",
  "diff",
  "grep",
  "ls-files",
  "ls-tree",
  "rev-parse",
  "cat-file",
]);
const GIT_UNSAFE_LONG = ["output", "ext-diff", "open-files-in-pager", "no-index", "textconv"];

// An absolute path must lie in the cache; a relative one only names something inside the program's
// own directory, which for these programs is the workspace, so it is refused.
function pathArgument(argument) {
  return argument.startsWith("/") && insideCache(argument);
}

function isInspection(argv) {
  const [program, ...rest] = argv;
  const spec = PROGRAMS[program];
  if (!spec) return false;
  let targetsCache = false;
  let patternSeen = !spec.pattern;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (spec.primaries && argument.startsWith("-")) {
      if (FIND_VALUED.has(argument)) index += 1;
      else if (!FIND_BARE.has(argument)) return false;
      continue;
    }
    if (argument.startsWith("--")) {
      const [name, value] = argument.slice(2).split(/=(.*)/s);
      if (spec.long.includes(name) && value === undefined) continue;
      if (spec.long.includes(`${name}=`) && value !== undefined) continue;
      if (spec.long.includes(`${name}=`)) {
        index += 1;
        continue;
      }
      return false;
    }
    if (argument.startsWith("-") && argument.length > 1) {
      for (let at = 1; at < argument.length; at += 1) {
        const flag = argument[at];
        if (spec.valued.includes(flag)) {
          if (at === argument.length - 1) index += 1;
          if (flag === "e") patternSeen = true;
          break;
        }
        if (!spec.flags.includes(flag) && !/^\d$/.test(flag)) return false;
      }
      continue;
    }
    if (!patternSeen) {
      patternSeen = true;
      continue;
    }
    if (!pathArgument(argument)) return false;
    targetsCache = true;
  }
  return targetsCache;
}

function isClone(directory) {
  return (
    directory.startsWith("/") && insideCache(directory) && existsSync(path.join(directory, ".git"))
  );
}

function isGitRead(argv) {
  if (argv[0] !== "git" || argv[1] !== "-C" || !isClone(argv[2] ?? "")) return false;
  if (!GIT_READS.has(argv[3] ?? "")) return false;
  return argv.slice(4).every((argument) => {
    if (argument.split(/[/=]/).includes("..")) return false;
    if (argument.startsWith("--")) {
      const name = argument.slice(2).split("=")[0];
      return name.length === 0 || !GIT_UNSAFE_LONG.some((unsafe) => unsafe.startsWith(name));
    }
    if (/^-[^-]*O/.test(argument)) return false;
    return !argument.startsWith("/") || insideCache(argument);
  });
}

function allowed(input) {
  const tool = input.tool_input ?? {};
  if (input.tool_name === "Bash") {
    const argv = words(tool.command ?? "");
    if (argv === null || argv.length === 0) return false;
    return argv[0] === "librarian" || isInspection(argv) || isGitRead(argv);
  }
  const target = tool.file_path;
  if (typeof target !== "string" || target.length === 0) return false;
  return insideCache(path.resolve(input.cwd ?? process.cwd(), target));
}

// The plugin's agent, or the same prompt installed as a user agent.
const input = JSON.parse(readFileSync(0, "utf8"));
if (["librarian:librarian", "librarian"].includes(input.agent_type) && allowed(input)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: "The librarian runs its own command and reads its own cache.",
      },
    }),
  );
}
