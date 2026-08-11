import os from "node:os";
import path from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { StringEnum } from "@earendil-works/pi-ai";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";
import { parseTypeBoxValue } from "../shared/typebox.ts";

const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const satisfies readonly ThinkingLevel[];

const THINKING_LEVEL_SCHEMA = Type.Union([
  Type.Literal(THINKING_LEVELS[0]),
  Type.Literal(THINKING_LEVELS[1]),
  Type.Literal(THINKING_LEVELS[2]),
  Type.Literal(THINKING_LEVELS[3]),
  Type.Literal(THINKING_LEVELS[4]),
  Type.Literal(THINKING_LEVELS[5]),
  Type.Literal(THINKING_LEVELS[6]),
]);

export const SOURCE_KINDS = ["github", "gitlab", "bitbucket-server", "sourcegraph"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export const CLONE_SOURCE_KINDS = ["github", "gitlab", "bitbucket-server"] as const;
export type CloneSourceKind = (typeof CLONE_SOURCE_KINDS)[number];

export const SOURCE_ROLES = ["clone", "code-search", "repo-search"] as const;
export type SourceRole = (typeof SOURCE_ROLES)[number];

const SOURCE_KIND_SCHEMA = StringEnum(SOURCE_KINDS);
const SOURCE_ROLE_SCHEMA = StringEnum(SOURCE_ROLES);

const SOURCE_SCHEMA = Type.Object({
  name: Type.String({ minLength: 1 }),
  url: Type.String({ minLength: 1 }),
  kind: SOURCE_KIND_SCHEMA,
  disabled: Type.Optional(Type.Array(SOURCE_ROLE_SCHEMA, { uniqueItems: true })),
});

const LIBRARIAN_FILE_SETTINGS_SCHEMA = Type.Object({
  model: Type.Optional(Type.String()),
  thinkingLevel: Type.Optional(THINKING_LEVEL_SCHEMA),
  extensions: Type.Optional(Type.Array(Type.String())),
  tools: Type.Optional(
    Type.Object({
      extra: Type.Optional(Type.Array(Type.String())),
      disabled: Type.Optional(Type.Array(Type.String())),
    }),
  ),
  sources: Type.Optional(Type.Array(SOURCE_SCHEMA)),
  cacheDir: Type.Optional(Type.String()),
  debug: Type.Optional(
    Type.Object({
      persistRuns: Type.Optional(Type.Boolean()),
    }),
  ),
});

const ROOT_SETTINGS_SCHEMA = Type.Object({
  librarian: Type.Optional(LIBRARIAN_FILE_SETTINGS_SCHEMA),
});

type LibrarianFileSettings = Static<typeof LIBRARIAN_FILE_SETTINGS_SCHEMA>;

type LibrarianFileSource = Static<typeof SOURCE_SCHEMA>;

export class ModelReference {
  constructor(
    readonly provider: string | undefined,
    readonly modelId: string,
  ) {}

  toString(): string {
    return this.provider ? `${this.provider}/${this.modelId}` : this.modelId;
  }
}

export interface LibrarianSource {
  name: string;
  url: string;
  kind: SourceKind;
  roles: SourceRole[];
}

export interface CloneSource {
  name: string;
  url: string;
  kind: CloneSourceKind;
  roles: SourceRole[];
}

export interface LibrarianSettings {
  model: ModelReference | undefined;
  thinkingLevel: ThinkingLevel | undefined;
  extensions: string[];
  tools: {
    extra: string[];
    disabled: string[];
  };
  sources: LibrarianSource[];
  cacheDir: string;
  debug: {
    persistRuns: boolean;
  };
}

const SEARCH_SOURCE_ROLES = ["code-search", "repo-search"] as const;

function isCloneSourceKind(kind: SourceKind): kind is CloneSourceKind {
  return CLONE_SOURCE_KINDS.some((cloneKind) => cloneKind === kind);
}

function possibleRoles(kind: SourceKind): readonly SourceRole[] {
  return isCloneSourceKind(kind) ? SOURCE_ROLES : SEARCH_SOURCE_ROLES;
}

export const DEFAULT_CACHE_DIR = "/tmp/pi-librarian";

function expandHome(rawPath: string): string {
  if (rawPath === "~") {
    return os.homedir();
  }

  if (rawPath.startsWith(`~${path.sep}`) || rawPath.startsWith("~/")) {
    return path.join(os.homedir(), rawPath.slice(2));
  }

  return rawPath;
}

function normalizeCacheDir(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_CACHE_DIR;
  }

  const expanded = expandHome(trimmed);
  if (!path.isAbsolute(expanded)) {
    throw new Error('librarian.cacheDir must be an absolute path or start with "~/".');
  }

  return path.normalize(expanded);
}

function parseModelReference(value: string | undefined): ModelReference | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const slashIndex = trimmed.indexOf("/");
  if (slashIndex === -1) {
    return new ModelReference(undefined, trimmed);
  }
  if (slashIndex === 0 || slashIndex === trimmed.length - 1) {
    return undefined;
  }

  return new ModelReference(trimmed.slice(0, slashIndex), trimmed.slice(slashIndex + 1));
}

function normalizeExtensionPaths(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map(expandHome);
}

function normalizeToolNames(values: string[] | undefined): string[] {
  if (!values) {
    return [];
  }

  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function normalizeSourceUrl(value: string, name: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`librarian.sources "${name}" has an invalid url.`);
  }

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      `librarian.sources "${name}" url must be an HTTPS origin without credentials, a path, query, or fragment.`,
    );
  }

  return url;
}

// Public instances of kinds we support
function builtInSources(): LibrarianSource[] {
  return [
    {
      name: "github",
      url: "https://github.com",
      kind: "github",
      roles: [...SOURCE_ROLES],
    },
    {
      name: "gitlab.com",
      url: "https://gitlab.com",
      kind: "gitlab",
      roles: [...SOURCE_ROLES],
    },
  ];
}

function normalizeSources(values: LibrarianFileSource[] | undefined): LibrarianSource[] {
  const sources = builtInSources();
  const names = new Set(sources.map((source) => source.name));
  const hostnames = new Set(sources.map((source) => new URL(source.url).hostname));

  for (const value of values ?? []) {
    const name = value.name.trim();
    if (!name) {
      throw new Error("librarian.sources names cannot be blank.");
    }
    if (names.has(name)) {
      throw new Error(`librarian.sources contains duplicate or reserved source name "${name}".`);
    }

    const url = normalizeSourceUrl(value.url.trim(), name);
    const hostname = url.hostname.toLowerCase();
    if (hostnames.has(hostname)) {
      throw new Error(`librarian.sources contains duplicate or reserved hostname "${hostname}".`);
    }

    const disabled = value.disabled ?? [];
    const roles = possibleRoles(value.kind).filter((role) => !disabled.includes(role));
    if (roles.length === 0) {
      throw new Error(
        `librarian.sources "${name}" disables every role supported by ${value.kind}. Remove the declaration instead.`,
      );
    }

    names.add(name);
    hostnames.add(hostname);
    sources.push({
      name,
      url: url.origin.toLowerCase(),
      kind: value.kind,
      roles,
    });
  }

  return sources;
}

export function resolveLibrarianSettings(fileSettings: LibrarianFileSettings): LibrarianSettings {
  return {
    model: parseModelReference(fileSettings.model),
    thinkingLevel: fileSettings.thinkingLevel,
    extensions: normalizeExtensionPaths(fileSettings.extensions),
    tools: {
      extra: normalizeToolNames(fileSettings.tools?.extra),
      disabled: normalizeToolNames(fileSettings.tools?.disabled),
    },
    sources: normalizeSources(fileSettings.sources),
    cacheDir: normalizeCacheDir(fileSettings.cacheDir),
    debug: {
      persistRuns: fileSettings.debug?.persistRuns ?? false,
    },
  };
}

export function loadSettings(): LibrarianSettings {
  const globalSettings = SettingsManager.create(process.cwd()).getGlobalSettings();
  try {
    const parsed = parseTypeBoxValue(ROOT_SETTINGS_SCHEMA, globalSettings, "Invalid settings");
    return resolveLibrarianSettings(parsed.librarian ?? {});
  } catch (error) {
    if (error instanceof Error && error.message.includes("/librarian/tools Expected object")) {
      throw new Error(
        `${error.message} Move the old librarian.tools entries to librarian.tools.extra; librarian.tools.disabled removes tools from a run.`,
      );
    }
    throw error;
  }
}
