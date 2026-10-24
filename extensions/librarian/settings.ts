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

// Strict throughout, so a misspelled or removed key fails loudly instead of being ignored.
const STRICT = { additionalProperties: false };

const SOURCE_SCHEMA = Type.Object(
  {
    name: Type.String({ minLength: 1 }),
    url: Type.String({ minLength: 1 }),
    kind: SOURCE_KIND_SCHEMA,
    disabled: Type.Optional(Type.Array(SOURCE_ROLE_SCHEMA, { uniqueItems: true })),
    tokenEnv: Type.Optional(Type.String({ minLength: 1 })),
    advancedSearch: Type.Optional(Type.Boolean()),
  },
  STRICT,
);

const WEB_SETTINGS_SCHEMA = Type.Object(
  {
    parallel: Type.Optional(
      Type.Object({ apiKeyCommand: Type.Optional(Type.String({ pattern: "\\S" })) }, STRICT),
    ),
    fetch: Type.Optional(
      Type.Object(
        {
          browser: Type.Optional(
            Type.Object(
              {
                executablePath: Type.Optional(Type.String()),
                profileDir: Type.Optional(Type.String()),
              },
              STRICT,
            ),
          ),
          challenge: Type.Optional(
            Type.Object(
              {
                escalation: Type.Optional(StringEnum(["headed", "never"] as const)),
                headlessWaitSecs: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
                headedWaitSecs: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
              },
              STRICT,
            ),
          ),
        },
        STRICT,
      ),
    ),
  },
  STRICT,
);

const LIBRARIAN_FILE_SETTINGS_SCHEMA = Type.Object(
  {
    model: Type.Optional(Type.String()),
    thinkingLevel: Type.Optional(THINKING_LEVEL_SCHEMA),
    tools: Type.Optional(
      Type.Object({ disabled: Type.Optional(Type.Array(Type.String())) }, STRICT),
    ),
    sources: Type.Optional(Type.Array(SOURCE_SCHEMA)),
    builtInSources: Type.Optional(
      Type.Object(
        {
          github: Type.Optional(Type.Boolean()),
          "gitlab.com": Type.Optional(Type.Boolean()),
        },
        STRICT,
      ),
    ),
    search: Type.Optional(
      Type.Object(
        {
          timeoutSeconds: Type.Optional(Type.Number({ exclusiveMinimum: 0 })),
          defaultLimit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
        },
        STRICT,
      ),
    ),
    web: Type.Optional(WEB_SETTINGS_SCHEMA),
    cacheDir: Type.Optional(Type.String()),
    debug: Type.Optional(
      Type.Object(
        {
          persistRuns: Type.Optional(Type.Boolean()),
        },
        STRICT,
      ),
    ),
  },
  STRICT,
);

const ROOT_SETTINGS_SCHEMA = Type.Object({
  librarian: Type.Optional(LIBRARIAN_FILE_SETTINGS_SCHEMA),
});

export type LibrarianFileSettings = Static<typeof LIBRARIAN_FILE_SETTINGS_SCHEMA>;

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

// Search roles need an API credential and are dropped without one; cloning uses git's own
// credentials, so a source without a token still clones. The built-in github source is the
// exception: its token is resolved lazily, falling back to the gh CLI.
export interface LibrarianSource {
  name: string;
  url: string;
  kind: SourceKind;
  roles: SourceRole[];
  token: string | undefined;
  advancedSearch: boolean;
}

export interface CloneSource {
  name: string;
  url: string;
  kind: CloneSourceKind;
  roles: SourceRole[];
  token: string | undefined;
  advancedSearch: boolean;
}

export interface SearchSettings {
  timeoutSeconds: number;
  defaultLimit: number;
}

// The key is resolved only when a Parallel call needs it, since the command may prompt.
export interface ParallelSettings {
  apiKey: string | undefined;
  apiKeyCommand: string | undefined;
}

export interface FetchBrowserSettings {
  executablePath: string | undefined;
  profileDir: string;
}

export interface FetchChallengeSettings {
  escalation: "headed" | "never";
  headlessWaitSecs: number;
  headedWaitSecs: number;
}

export interface FetchSettings {
  browser: FetchBrowserSettings;
  challenge: FetchChallengeSettings;
}

export interface WebSettings {
  parallel: ParallelSettings;
  fetch: FetchSettings;
}

export interface LibrarianSettings {
  model: ModelReference | undefined;
  thinkingLevel: ThinkingLevel | undefined;
  tools: {
    disabled: string[];
  };
  sources: LibrarianSource[];
  search: SearchSettings;
  web: WebSettings;
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
export const DEFAULT_SEARCH_TIMEOUT_SECONDS = 15;
export const DEFAULT_SEARCH_LIMIT = 10;
export const DEFAULT_BROWSER_PROFILE_DIR = path.join(
  os.homedir(),
  ".pi",
  "agent",
  "browser-profile",
);
const DEFAULT_HEADLESS_WAIT_SECONDS = 10;
const DEFAULT_HEADED_WAIT_SECONDS = 20;
export const MAX_SEARCH_LIMIT = 50;

const CONVENTIONAL_TOKEN_ENV: Record<SourceKind, string[]> = {
  github: ["GITHUB_TOKEN", "GH_TOKEN"],
  gitlab: ["GITLAB_ACCESS_TOKEN"],
  "bitbucket-server": ["BITBUCKET_TOKEN"],
  sourcegraph: ["SRC_ACCESS_TOKEN"],
};

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

function normalizeAbsolutePath(value: string | undefined, key: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const expanded = expandHome(trimmed);
  if (!path.isAbsolute(expanded)) {
    throw new Error(`${key} must be an absolute path or start with "~/".`);
  }
  return path.normalize(expanded);
}

function resolveWebSettings(
  file: Static<typeof WEB_SETTINGS_SCHEMA> | undefined,
  env: NodeJS.ProcessEnv,
): WebSettings {
  const browser = file?.fetch?.browser;
  const challenge = file?.fetch?.challenge;
  return {
    parallel: {
      apiKey: env.PARALLEL_API_KEY?.trim() || undefined,
      apiKeyCommand: file?.parallel?.apiKeyCommand,
    },
    fetch: {
      browser: {
        executablePath: normalizeAbsolutePath(
          browser?.executablePath,
          "librarian.web.fetch.browser.executablePath",
        ),
        profileDir:
          normalizeAbsolutePath(browser?.profileDir, "librarian.web.fetch.browser.profileDir") ??
          DEFAULT_BROWSER_PROFILE_DIR,
      },
      challenge: {
        escalation: challenge?.escalation ?? "headed",
        headlessWaitSecs: challenge?.headlessWaitSecs ?? DEFAULT_HEADLESS_WAIT_SECONDS,
        headedWaitSecs: challenge?.headedWaitSecs ?? DEFAULT_HEADED_WAIT_SECONDS,
      },
    },
  };
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

type BuiltInSourceName = "github" | "gitlab.com";

interface BuiltInSourceSwitches {
  github?: boolean;
  "gitlab.com"?: boolean;
}

interface BuiltInSource {
  name: BuiltInSourceName;
  url: string;
  kind: SourceKind;
  enabledByDefault: boolean;
}

// Public instances of kinds we support. Everyone is assumed to want GitHub; gitlab.com search
// needs a token regardless, so it is opt-in.
const BUILT_IN_SOURCES: BuiltInSource[] = [
  { name: "github", url: "https://github.com", kind: "github", enabledByDefault: true },
  { name: "gitlab.com", url: "https://gitlab.com", kind: "gitlab", enabledByDefault: false },
];

const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// A token pasted where its variable name belongs would sit in a settings file; refuse it there.
function validateTokenEnv(value: string, name: string): string {
  const trimmed = value.trim();
  if (
    !ENV_NAME_PATTERN.test(trimmed) ||
    /^(glpat-|ghp_|gho_|github_pat_|sgp_|BBDC-)/.test(trimmed)
  ) {
    throw new Error(
      `librarian.sources "${name}" tokenEnv must name an environment variable, not hold a credential.`,
    );
  }
  return trimmed;
}

function resolveToken(
  kind: SourceKind,
  tokenEnv: string | undefined,
  env: NodeJS.ProcessEnv,
): string | undefined {
  for (const variable of tokenEnv ? [tokenEnv] : CONVENTIONAL_TOKEN_ENV[kind]) {
    const value = env[variable]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

function rolesWithCredential(
  kind: SourceKind,
  roles: readonly SourceRole[],
  token: string | undefined,
): SourceRole[] {
  return token || kind === "github" ? [...roles] : roles.filter((role) => role === "clone");
}

function builtInSources(
  switches: BuiltInSourceSwitches | undefined,
  env: NodeJS.ProcessEnv,
): LibrarianSource[] {
  return BUILT_IN_SOURCES.filter(
    (source) => switches?.[source.name] ?? source.enabledByDefault,
  ).map((source) => {
    const token = resolveToken(source.kind, undefined, env);
    return {
      name: source.name,
      url: source.url,
      kind: source.kind,
      roles: rolesWithCredential(source.kind, SOURCE_ROLES, token),
      token,
      advancedSearch: false,
    };
  });
}

function normalizeSources(
  values: LibrarianFileSource[] | undefined,
  switches: BuiltInSourceSwitches | undefined,
  env: NodeJS.ProcessEnv,
): LibrarianSource[] {
  const sources = builtInSources(switches, env);
  const names = new Set<string>(BUILT_IN_SOURCES.map((source) => source.name));
  const hostnames = new Set(BUILT_IN_SOURCES.map((source) => new URL(source.url).hostname));

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

    if (value.advancedSearch !== undefined && value.kind !== "gitlab") {
      throw new Error(
        `librarian.sources "${name}" sets advancedSearch, which only gitlab sources have.`,
      );
    }

    const disabled = value.disabled ?? [];
    const roles = possibleRoles(value.kind).filter((role) => !disabled.includes(role));
    if (roles.length === 0) {
      throw new Error(
        `librarian.sources "${name}" disables every role supported by ${value.kind}. Remove the declaration instead.`,
      );
    }

    const tokenEnv =
      value.tokenEnv === undefined ? undefined : validateTokenEnv(value.tokenEnv, name);
    const token = resolveToken(value.kind, tokenEnv, env);

    names.add(name);
    hostnames.add(hostname);
    sources.push({
      name,
      url: url.origin.toLowerCase(),
      kind: value.kind,
      roles: rolesWithCredential(value.kind, roles, token),
      token,
      advancedSearch: value.advancedSearch ?? false,
    });
  }

  return sources;
}

export function resolveLibrarianSettings(
  fileSettings: LibrarianFileSettings,
  env: NodeJS.ProcessEnv,
): LibrarianSettings {
  return {
    model: parseModelReference(fileSettings.model),
    thinkingLevel: fileSettings.thinkingLevel,
    tools: {
      disabled: normalizeToolNames(fileSettings.tools?.disabled),
    },
    sources: normalizeSources(fileSettings.sources, fileSettings.builtInSources, env),
    search: {
      timeoutSeconds: fileSettings.search?.timeoutSeconds ?? DEFAULT_SEARCH_TIMEOUT_SECONDS,
      defaultLimit: fileSettings.search?.defaultLimit ?? DEFAULT_SEARCH_LIMIT,
    },
    web: resolveWebSettings(fileSettings.web, env),
    cacheDir: normalizeCacheDir(fileSettings.cacheDir),
    debug: {
      persistRuns: fileSettings.debug?.persistRuns ?? false,
    },
  };
}

export function parseSettings(globalSettings: unknown, env: NodeJS.ProcessEnv): LibrarianSettings {
  const parsed = parseTypeBoxValue(ROOT_SETTINGS_SCHEMA, globalSettings, "Invalid settings");
  return resolveLibrarianSettings(parsed.librarian ?? {}, env);
}

export function loadSettings(): LibrarianSettings {
  return parseSettings(SettingsManager.create(process.cwd()).getGlobalSettings(), process.env);
}
