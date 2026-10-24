import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_CACHE_DIR, resolveLibrarianSettings } from "../extensions/librarian/settings.ts";

describe("resolveLibrarianSettings", () => {
  it("returns defaults for empty settings", () => {
    const settings = resolveLibrarianSettings({}, {});
    expect(settings.model).toBeUndefined();
    expect(settings.thinkingLevel).toBeUndefined();
    expect(settings.extensions).toEqual([]);
    expect(settings.tools).toEqual({ extra: [], disabled: [] });
    expect(settings.sources).toEqual([
      {
        name: "github",
        url: "https://github.com",
        kind: "github",
        roles: ["clone", "code-search", "repo-search"],
        token: undefined,
        advancedSearch: false,
      },
    ]);
    expect(settings.search).toEqual({ timeoutSeconds: 15, defaultLimit: 10 });
    expect(settings.debug.persistRuns).toBe(false);
    expect(settings.cacheDir).toBe(DEFAULT_CACHE_DIR);
    expect(settings.cacheDir).toBe("/tmp/pi-librarian");
  });

  it("parses provider/model references", () => {
    const settings = resolveLibrarianSettings({ model: "anthropic/claude-sonnet-5" }, {});
    expect(settings.model?.provider).toBe("anthropic");
    expect(settings.model?.modelId).toBe("claude-sonnet-5");
  });

  it("parses bare model patterns", () => {
    const settings = resolveLibrarianSettings({ model: "opus" }, {});
    expect(settings.model?.provider).toBeUndefined();
    expect(settings.model?.modelId).toBe("opus");
    expect(settings.model?.toString()).toBe("opus");
  });

  it("parses model ids containing slashes", () => {
    const settings = resolveLibrarianSettings({ model: "openrouter/meta/llama-4" }, {});
    expect(settings.model?.provider).toBe("openrouter");
    expect(settings.model?.modelId).toBe("meta/llama-4");
  });

  it.each(["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const)(
    "parses the %s thinking level",
    (thinkingLevel) => {
      const settings = resolveLibrarianSettings({ thinkingLevel }, {});
      expect(settings.thinkingLevel).toBe(thinkingLevel);
    },
  );

  it("rejects malformed model references", () => {
    expect(resolveLibrarianSettings({ model: "/leading" }, {}).model).toBeUndefined();
    expect(resolveLibrarianSettings({ model: "trailing/" }, {}).model).toBeUndefined();
  });

  it("expands home-relative extension paths and drops blanks", () => {
    const settings = resolveLibrarianSettings(
      {
        extensions: ["~/exts/web-tools", "  ", "/abs/path"],
      },
      {},
    );
    expect(settings.extensions).toEqual([path.join(os.homedir(), "exts/web-tools"), "/abs/path"]);
  });

  it("normalizes extra and disabled tool names", () => {
    const settings = resolveLibrarianSettings(
      {
        tools: {
          extra: [" search_web ", "", "fetch_web", "search_web"],
          disabled: ["write", " write "],
        },
      },
      {},
    );
    expect(settings.tools).toEqual({
      extra: ["search_web", "fetch_web"],
      disabled: ["write"],
    });
  });

  it("normalizes host declarations, keeping search roles only for sources with a credential", () => {
    const settings = resolveLibrarianSettings(
      {
        sources: [
          {
            name: "example-bb",
            url: "https://Git.Example.com:8443/",
            kind: "bitbucket-server",
            disabled: ["code-search"],
          },
          {
            name: "example-gl",
            url: "https://gitlab.example.com",
            kind: "gitlab",
            tokenEnv: "EXAMPLE_GL_TOKEN",
            advancedSearch: true,
          },
        ],
      },
      { EXAMPLE_GL_TOKEN: "secret-gl", GITLAB_ACCESS_TOKEN: "wrong-instance" },
    );

    expect(settings.sources.slice(1)).toEqual([
      {
        name: "example-bb",
        url: "https://git.example.com:8443",
        kind: "bitbucket-server",
        roles: ["clone"],
        token: undefined,
        advancedSearch: false,
      },
      {
        name: "example-gl",
        url: "https://gitlab.example.com",
        kind: "gitlab",
        roles: ["clone", "code-search", "repo-search"],
        token: "secret-gl",
        advancedSearch: true,
      },
    ]);
  });

  it("reads a kind's conventional token variable when tokenEnv is absent", () => {
    const settings = resolveLibrarianSettings(
      { sources: [{ name: "example-sg", url: "https://search.example.com", kind: "sourcegraph" }] },
      { SRC_ACCESS_TOKEN: "secret-sg" },
    );
    expect(settings.sources[1]?.roles).toEqual(["code-search", "repo-search"]);
    expect(settings.sources[1]?.token).toBe("secret-sg");
  });

  it("switches built-in sources on and off as a whole", () => {
    const settings = resolveLibrarianSettings(
      { builtInSources: { github: false, "gitlab.com": true } },
      { GITLAB_ACCESS_TOKEN: "secret-gl" },
    );
    expect(settings.sources.map((source) => [source.name, source.roles])).toEqual([
      ["gitlab.com", ["clone", "code-search", "repo-search"]],
    ]);
  });

  it("keeps built-in names reserved while switched off", () => {
    expect(() =>
      resolveLibrarianSettings(
        {
          builtInSources: { "gitlab.com": false },
          sources: [{ name: "gitlab.com", url: "https://gitlab.example.com", kind: "gitlab" }],
        },
        {},
      ),
    ).toThrow(/reserved source name "gitlab.com"/);
  });

  it("rejects advancedSearch outside gitlab and credentials in tokenEnv", () => {
    expect(() =>
      resolveLibrarianSettings(
        {
          sources: [
            {
              name: "bb",
              url: "https://git.example.com",
              kind: "bitbucket-server",
              advancedSearch: true,
            },
          ],
        },
        {},
      ),
    ).toThrow(/only gitlab sources have/);
    expect(() =>
      resolveLibrarianSettings(
        {
          sources: [
            {
              name: "gl",
              url: "https://gitlab.example.com",
              kind: "gitlab",
              tokenEnv: "glpat-abc123",
            },
          ],
        },
        {},
      ),
    ).toThrow(/must name an environment variable/);
  });

  it("reads search settings", () => {
    const settings = resolveLibrarianSettings(
      { search: { timeoutSeconds: 30, defaultLimit: 20 } },
      {},
    );
    expect(settings.search).toEqual({ timeoutSeconds: 30, defaultLimit: 20 });
  });

  it("rejects duplicate or reserved source names and sources", () => {
    expect(() =>
      resolveLibrarianSettings(
        {
          sources: [{ name: "github", url: "https://git.example.com", kind: "gitlab" }],
        },
        {},
      ),
    ).toThrow(/reserved source name/);
    expect(() =>
      resolveLibrarianSettings(
        {
          sources: [
            { name: "one", url: "https://git.example.com:8443", kind: "gitlab" },
            { name: "two", url: "https://git.example.com", kind: "bitbucket-server" },
          ],
        },
        {},
      ),
    ).toThrow(/duplicate or reserved host/);
  });

  it("rejects inert declarations and non-origin host URLs", () => {
    expect(() =>
      resolveLibrarianSettings(
        {
          sources: [
            {
              name: "search",
              url: "https://search.example.com",
              kind: "sourcegraph",
              disabled: ["repo-search", "code-search"],
            },
          ],
        },
        {},
      ),
    ).toThrow(/disables every role/);
    expect(() =>
      resolveLibrarianSettings(
        {
          sources: [{ name: "bad", url: "https://git.example.com/path", kind: "gitlab" }],
        },
        {},
      ),
    ).toThrow(/HTTPS origin/);
  });

  it("reads debug run persistence", () => {
    const settings = resolveLibrarianSettings({ debug: { persistRuns: true } }, {});
    expect(settings.debug.persistRuns).toBe(true);
  });

  it("expands home-relative cacheDir and rejects relative paths", () => {
    const settings = resolveLibrarianSettings({ cacheDir: "~/tmp/librarian" }, {});
    expect(settings.cacheDir).toBe(path.join(os.homedir(), "tmp/librarian"));
    expect(() => resolveLibrarianSettings({ cacheDir: "relative/path" }, {})).toThrow(
      /absolute path/,
    );
  });
});
