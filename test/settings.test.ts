import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDefaultCacheDir, resolveLibrarianSettings } from "../extensions/librarian/settings.ts";

describe("resolveLibrarianSettings", () => {
  it("returns defaults for empty settings", () => {
    const settings = resolveLibrarianSettings({});
    expect(settings.model).toBeUndefined();
    expect(settings.thinkingLevel).toBeUndefined();
    expect(settings.extensions).toEqual([]);
    expect(settings.tools).toEqual([]);
    expect(settings.debug.persistRuns).toBe(false);
    expect(settings.cacheDir).toBe(getDefaultCacheDir());
    expect(settings.cacheDir).toBe(path.join(os.tmpdir(), "pi-librarian"));
  });

  it("parses provider/model references", () => {
    const settings = resolveLibrarianSettings({ model: "anthropic/claude-sonnet-5" });
    expect(settings.model?.provider).toBe("anthropic");
    expect(settings.model?.modelId).toBe("claude-sonnet-5");
  });

  it("parses bare model patterns", () => {
    const settings = resolveLibrarianSettings({ model: "opus" });
    expect(settings.model?.provider).toBeUndefined();
    expect(settings.model?.modelId).toBe("opus");
    expect(settings.model?.toString()).toBe("opus");
  });

  it("parses model ids containing slashes", () => {
    const settings = resolveLibrarianSettings({ model: "openrouter/meta/llama-4" });
    expect(settings.model?.provider).toBe("openrouter");
    expect(settings.model?.modelId).toBe("meta/llama-4");
  });

  it.each([
    "off",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ] as const)("parses the %s thinking level", (thinkingLevel) => {
    const settings = resolveLibrarianSettings({ thinkingLevel });
    expect(settings.thinkingLevel).toBe(thinkingLevel);
  });

  it("rejects malformed model references", () => {
    expect(resolveLibrarianSettings({ model: "/leading" }).model).toBeUndefined();
    expect(resolveLibrarianSettings({ model: "trailing/" }).model).toBeUndefined();
  });

  it("expands home-relative extension paths and drops blanks", () => {
    const settings = resolveLibrarianSettings({
      extensions: ["~/exts/web-tools", "  ", "/abs/path"],
    });
    expect(settings.extensions).toEqual([path.join(os.homedir(), "exts/web-tools"), "/abs/path"]);
  });

  it("normalizes extra tool names", () => {
    const settings = resolveLibrarianSettings({
      tools: [" search_web ", "", "fetch_web", "search_web"],
    });
    expect(settings.tools).toEqual(["search_web", "fetch_web"]);
  });

  it("reads debug run persistence", () => {
    const settings = resolveLibrarianSettings({ debug: { persistRuns: true } });
    expect(settings.debug.persistRuns).toBe(true);
  });

  it("expands home-relative cacheDir and rejects relative paths", () => {
    const settings = resolveLibrarianSettings({ cacheDir: "~/tmp/librarian" });
    expect(settings.cacheDir).toBe(path.join(os.homedir(), "tmp/librarian"));
    expect(() => resolveLibrarianSettings({ cacheDir: "relative/path" })).toThrow(/absolute path/);
  });
});
