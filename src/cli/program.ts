import { randomUUID } from "node:crypto";
import { Command, InvalidArgumentError, Option } from "commander";
import { cloneSources } from "../core/checkout.ts";
import type { LibrarianSettings, LibrarianSource, SourceKind } from "../core/settings.ts";
import type { LibrarianTool } from "../core/tool.ts";
import { type RepoClients, readableSources, sourcesWith } from "../core/tools/index.ts";
import { LIBRARIAN_TOOL_NAMES } from "../core/tools/names.ts";
import { parseTypeBoxValue } from "../core/typebox.ts";
import type { WebTools } from "../core/web/index.ts";

export interface ProgramInput {
  settings: LibrarianSettings;
  clients: RepoClients;
  repoTools: LibrarianTool[];
  web: WebTools;
  setupCodex: () => Promise<string>;
  uninstallCodex: () => Promise<string>;
  write: (text: string) => void;
}

const GLOBAL_COMMANDS = new Set(["grepapp", "clone", "web", "codex", "help"]);

const CODE_TOOLS: Record<SourceKind, string> = {
  github: LIBRARIAN_TOOL_NAMES.searchCodeGitHub,
  gitlab: LIBRARIAN_TOOL_NAMES.searchCodeGitLab,
  "bitbucket-server": LIBRARIAN_TOOL_NAMES.searchCodeBitbucket,
  sourcegraph: LIBRARIAN_TOOL_NAMES.searchCodeSourcegraph,
};

const REPO_TOOLS: Record<SourceKind, { tool: string; query: string }> = {
  github: { tool: LIBRARIAN_TOOL_NAMES.searchReposGitHub, query: "text" },
  gitlab: { tool: LIBRARIAN_TOOL_NAMES.searchReposGitLab, query: "name" },
  "bitbucket-server": { tool: LIBRARIAN_TOOL_NAMES.searchReposBitbucket, query: "name" },
  sourcegraph: { tool: LIBRARIAN_TOOL_NAMES.searchReposSourcegraph, query: "name" },
};

// The JSON Schema TypeBox emits for a tool's parameters, as far as the CLI reads it.
interface PropertySchema {
  type?: string;
  enum?: string[];
  description?: string;
}

interface ParametersSchema {
  properties: Record<string, PropertySchema>;
  required?: string[];
}

function kebab(key: string): string {
  return key.replaceAll("_", "-");
}

function parseNumber(value: string): number {
  if (!/^-?\d+(\.\d+)?$/.test(value)) throw new InvalidArgumentError("Not a number.");
  return Number(value);
}

// Repeated rather than variadic, so an array option cannot swallow the positional after it.
function collect(value: string, previous: string[] | undefined): string[] {
  return [...(previous ?? []), value];
}

// A tool's options come from its own parameter schema, so flags and their help never drift from
// what the pi tool documents. Positional arguments and the source are declared per command.
function toolCommand(
  name: string,
  tool: LibrarianTool,
  positionals: string[],
  fixed: Record<string, string>,
  write: (text: string) => void,
): Command {
  const schema = tool.parameters as unknown as ParametersSchema;
  const required = new Set(schema.required);
  const command = new Command(name)
    .summary(tool.label)
    .description(tool.description)
    .showHelpAfterError();

  for (const key of positionals) {
    const property = schema.properties[key];
    if (!property) throw new Error(`${tool.name} has no parameter ${key}`);
    const label = property.type === "array" ? `${kebab(key)}...` : kebab(key);
    command.argument(required.has(key) ? `<${label}>` : `[${label}]`, property.description);
  }

  const options = new Map<string, Option>();
  for (const [key, property] of Object.entries(schema.properties)) {
    if (positionals.includes(key) || key in fixed) continue;
    const flag = `--${kebab(key)}`;
    let option: Option;
    if (property.type === "boolean") {
      option = new Option(flag, property.description);
      command.addOption(new Option(`--no-${kebab(key)}`, `Negates ${flag}.`));
    } else if (property.type === "array") {
      option = new Option(
        `${flag} <value>`,
        `${property.description ?? ""} Repeat for several.`.trim(),
      ).argParser(collect);
    } else if (property.type === "integer" || property.type === "number") {
      option = new Option(`${flag} <n>`, property.description).argParser(parseNumber);
    } else {
      option = new Option(`${flag} <value>`, property.description);
      if (property.enum) option.choices(property.enum);
    }
    if (required.has(key)) option.makeOptionMandatory();
    command.addOption(option);
    options.set(key, option);
  }

  command.action(async () => {
    const params: Record<string, unknown> = { ...fixed };
    positionals.forEach((key, index) => {
      const value: unknown = command.processedArgs[index];
      if (value !== undefined) params[key] = value;
    });
    for (const [key, option] of options) {
      const value: unknown = command.getOptionValue(option.attributeName());
      if (value !== undefined) params[key] = value;
    }
    const checked = parseTypeBoxValue(tool.parameters, params, "Invalid arguments");
    const result = await tool.execute(randomUUID(), checked, undefined);
    write(`${result.content.map((part) => part.text).join("\n")}\n`);
  });
  return command;
}

function sourceDescription(source: LibrarianSource): string {
  return source.description ?? `${source.kind} at ${new URL(source.url).host}`;
}

// Commands exist only for what is configured: a source without a search credential has no search
// commands, and an engine with no instance has no source command at all.
export function createProgram(input: ProgramInput): Command {
  const { settings, clients, repoTools, web, write } = input;
  const tool = (name: string): LibrarianTool => {
    const found = repoTools.find((candidate) => candidate.name === name);
    if (!found) throw new Error(`no ${name} tool`);
    return found;
  };
  const includes = (list: LibrarianSource[], source: LibrarianSource) =>
    list.some((candidate) => candidate.name === source.name);
  // A tool over one instance takes no source argument; one over several needs it named.
  const sourceArgument = (name: string, source: LibrarianSource): Record<string, string> =>
    "source" in (tool(name).parameters as unknown as ParametersSchema).properties
      ? { source: source.name }
      : {};

  const program = new Command("librarian")
    .description(
      "Research code and documentation outside this workspace. Commands exist only for configured sources; run `librarian <command> --help` for each one's arguments and query syntax.",
    )
    .showHelpAfterError();

  const readable = readableSources(settings, clients);
  const clonable = cloneSources(settings.sources);
  for (const source of settings.sources) {
    if (GLOBAL_COMMANDS.has(source.name)) {
      throw new Error(`Source "${source.name}" collides with librarian's own command; rename it.`);
    }
    const command = new Command(source.name).description(sourceDescription(source));

    if (includes(sourcesWith(settings.sources, source.kind, "code-search"), source)) {
      const name = CODE_TOOLS[source.kind];
      command.addCommand(
        toolCommand("code", tool(name), ["pattern"], sourceArgument(name, source), write),
      );
    }
    if (includes(sourcesWith(settings.sources, source.kind, "repo-search"), source)) {
      const { tool: name, query } = REPO_TOOLS[source.kind];
      command.addCommand(
        toolCommand("repos", tool(name), [query], sourceArgument(name, source), write),
      );
    }
    if (includes(readable, source)) {
      const name = LIBRARIAN_TOOL_NAMES.readFile;
      command.addCommand(
        toolCommand("read", tool(name), ["repo", "path"], sourceArgument(name, source), write),
      );
    }
    if (includes(clonable, source)) {
      command.addCommand(
        toolCommand(
          "clone",
          tool(LIBRARIAN_TOOL_NAMES.checkoutRepo),
          ["repo"],
          { source: source.name },
          write,
        ),
      );
    }
    if (
      source.kind === "sourcegraph" &&
      includes(sourcesWith(settings.sources, "sourcegraph", "code-search"), source)
    ) {
      const name = LIBRARIAN_TOOL_NAMES.findDefinition;
      command.addCommand(
        toolCommand("definition", tool(name), ["symbol"], sourceArgument(name, source), write),
      );
    }
    if (command.commands.length > 0) program.addCommand(command);
  }

  program.addCommand(
    toolCommand("grepapp", tool(LIBRARIAN_TOOL_NAMES.searchCodeGrepApp), ["pattern"], {}, write),
  );
  program.addCommand(
    toolCommand("clone", tool(LIBRARIAN_TOOL_NAMES.checkoutRepo), ["repo"], {}, write)
      .summary("Clone a repository by its full HTTPS or SSH URL")
      .description(
        "Clone a repository by its full HTTPS or SSH URL into the shared cache and check out a branch, tag, or commit, returning its path for grep, read, and git log, blame, and diff. Clones are reused across calls. To clone by repository path, use `librarian <source> clone`.",
      ),
  );

  const webCommand = new Command("web").description("Search the web and fetch pages");
  if (web.search) {
    webCommand.addCommand(toolCommand("search", web.search, ["objective"], {}, write));
  }
  webCommand.addCommand(toolCommand("fetch", web.fetch, ["urls"], {}, write));
  program.addCommand(webCommand);

  program.addCommand(
    new Command("codex")
      .description("Install the librarian into Codex, or remove it")
      .addCommand(
        new Command("setup")
          .description(
            "Write the librarian role to ~/.codex/agents and allow the librarian command in ~/.codex/rules",
          )
          .action(async () => write(`${await input.setupCodex()}\n`)),
      )
      .addCommand(
        new Command("uninstall")
          .description("Remove the librarian role and rule that `codex setup` wrote, after asking")
          .action(async () => write(`${await input.uninstallCodex()}\n`)),
      ),
  );

  return program;
}
