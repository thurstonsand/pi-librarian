import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { migrateFromPi, piLegacyPaths } from "../src/core/migrate.ts";

let root: string;
let legacy: { piSettings: string; browserProfile: string };
let current: { settings: string; browserProfile: string };

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), "librarian-migrate-"));
  legacy = {
    piSettings: path.join(root, "pi/settings.json"),
    browserProfile: path.join(root, "pi/browser-profile"),
  };
  current = {
    settings: path.join(root, "config/agents/librarian/config.json"),
    browserProfile: path.join(root, "state/agents/librarian/browser-profile"),
  };
  mkdirSync(path.join(root, "pi"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("migrateFromPi", () => {
  it("moves the librarian key out of pi's settings, filing pi-only keys under pi", () => {
    writeFileSync(
      legacy.piSettings,
      JSON.stringify({
        defaultModel: "opus",
        librarian: {
          model: "anthropic/claude-sonnet-5",
          thinkingLevel: "low",
          tools: { disabled: ["bash"] },
          debug: { persistRuns: true },
          sources: [{ name: "work-sg", url: "https://sg.example.com", kind: "sourcegraph" }],
          cacheDir: "~/librarian-cache",
        },
      }),
    );
    mkdirSync(path.join(legacy.browserProfile, "Default"), { recursive: true });

    const moved = migrateFromPi(legacy, current);

    expect(readJson(current.settings)).toEqual({
      sources: [{ name: "work-sg", url: "https://sg.example.com", kind: "sourcegraph" }],
      cacheDir: "~/librarian-cache",
      pi: {
        model: "anthropic/claude-sonnet-5",
        thinkingLevel: "low",
        tools: { disabled: ["bash"] },
        debug: { persistRuns: true },
      },
    });
    expect(readJson(legacy.piSettings)).toEqual({ defaultModel: "opus" });
    expect(existsSync(path.join(current.browserProfile, "Default"))).toBe(true);
    expect(existsSync(legacy.browserProfile)).toBe(false);
    expect(moved).toHaveLength(2);
    expect(migrateFromPi(legacy, current)).toEqual([]);
  });

  it("refuses to choose when both settings exist, changing neither", () => {
    const piSettings = JSON.stringify({ librarian: { search: { defaultLimit: 5 } } });
    writeFileSync(legacy.piSettings, piSettings);
    mkdirSync(path.dirname(current.settings), { recursive: true });
    writeFileSync(current.settings, "{}");

    expect(() => migrateFromPi(legacy, current)).toThrow(
      `Librarian settings exist both under "librarian" in ${legacy.piSettings} and in ${current.settings}.`,
    );
    expect(readFileSync(legacy.piSettings, "utf8")).toBe(piSettings);
    expect(readFileSync(current.settings, "utf8")).toBe("{}");
  });

  it("refuses to choose between two browser profiles", () => {
    mkdirSync(legacy.browserProfile);
    mkdirSync(current.browserProfile, { recursive: true });

    expect(() => migrateFromPi(legacy, current)).toThrow(
      `Browser profiles exist at both ${legacy.browserProfile} and ${current.browserProfile}.`,
    );
    expect(existsSync(legacy.browserProfile)).toBe(true);
  });

  it("reads pi settings that start with a byte-order mark, and names a file it cannot use", () => {
    writeFileSync(legacy.piSettings, `\uFEFF${JSON.stringify({ librarian: { cacheDir: "/c" } })}`);
    expect(migrateFromPi(legacy, current)).toHaveLength(1);
    expect(readJson(current.settings)).toEqual({ cacheDir: "/c" });

    rmSync(current.settings);
    writeFileSync(legacy.piSettings, JSON.stringify({ librarian: null }));
    expect(() => migrateFromPi(legacy, current)).toThrow(
      `${legacy.piSettings}: "librarian" must be an object to migrate.`,
    );
  });

  it("writes nothing when pi holds no librarian state", () => {
    writeFileSync(legacy.piSettings, JSON.stringify({ defaultModel: "opus" }));

    expect(migrateFromPi(legacy, current)).toEqual([]);
    expect(existsSync(current.settings)).toBe(false);
    expect(readJson(legacy.piSettings)).toEqual({ defaultModel: "opus" });
  });

  it("finds pi's agent directory where pi does, honoring PI_CODING_AGENT_DIR", () => {
    expect(piLegacyPaths({}).piSettings).toBe(path.join(os.homedir(), ".pi/agent/settings.json"));
    expect(piLegacyPaths({ PI_CODING_AGENT_DIR: "~/agents/pi" }).browserProfile).toBe(
      path.join(os.homedir(), "agents/pi/browser-profile"),
    );
  });
});
