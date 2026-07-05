import os from "node:os";
import path from "node:path";
import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { SettingsManager } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";
import { parseTypeBoxValue } from "../shared/typebox.ts";

const THINKING_LEVEL_SCHEMA = Type.Union([
  Type.Literal("off"),
  Type.Literal("minimal"),
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
  Type.Literal("xhigh"),
]);

const LIBRARIAN_FILE_SETTINGS_SCHEMA = Type.Object({
  model: Type.Optional(Type.String()),
  thinkingLevel: Type.Optional(THINKING_LEVEL_SCHEMA),
  extensions: Type.Optional(Type.Array(Type.String())),
  tools: Type.Optional(Type.Array(Type.String())),
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

export class ModelReference {
  constructor(
    readonly provider: string,
    readonly modelId: string,
  ) {}

  toString(): string {
    return `${this.provider}/${this.modelId}`;
  }
}

export interface LibrarianSettings {
  model: ModelReference | undefined;
  thinkingLevel: ThinkingLevel | undefined;
  extensions: string[];
  tools: string[];
  cacheDir: string;
  debug: {
    persistRuns: boolean;
  };
}

export function getDefaultCacheDir(): string {
  return path.join(os.tmpdir(), "pi-librarian");
}

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
    return getDefaultCacheDir();
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
  if (slashIndex <= 0 || slashIndex === trimmed.length - 1) {
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

export function resolveLibrarianSettings(fileSettings: LibrarianFileSettings): LibrarianSettings {
  return {
    model: parseModelReference(fileSettings.model),
    thinkingLevel: fileSettings.thinkingLevel,
    extensions: normalizeExtensionPaths(fileSettings.extensions),
    tools: normalizeToolNames(fileSettings.tools),
    cacheDir: normalizeCacheDir(fileSettings.cacheDir),
    debug: {
      persistRuns: fileSettings.debug?.persistRuns ?? false,
    },
  };
}

export function loadSettings(): LibrarianSettings {
  const globalSettings = SettingsManager.create(process.cwd()).getGlobalSettings();
  const parsed = parseTypeBoxValue(ROOT_SETTINGS_SCHEMA, globalSettings, "Invalid settings");
  return resolveLibrarianSettings(parsed.librarian ?? {});
}
