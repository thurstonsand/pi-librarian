import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CACHE_DIR,
  parseSettings,
  resolveLibrarianSettings,
} from "../extensions/librarian/settings.ts";

describe("resolveLibrarianSettings", () => {
  it("returns defaults for empty settings", () => {
    const settings = resolveLibrarianSettings({}, {});
    expect(settings.model).toBeUndefined();
    expect(settings.thinkingLevel).toBeUndefined();
    expect(settings.tools).toEqual({ disabled: [] });
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

  it("normalizes disabled tool names", () => {
    const settings = resolveLibrarianSettings(
      { tools: { disabled: ["write", " write ", ""] } },
      {},
    );
    expect(settings.tools).toEqual({ disabled: ["write"] });
  });

  it("refuses keys it does not know, so a removed or misspelled one is not silently ignored", () => {
    expect(() => parseSettings({ librarian: { extensions: ["/x"] } }, {})).toThrow(
      "Invalid settings: /librarian/extensions is not a recognized key",
    );
    expect(() => parseSettings({ librarian: { tools: { extra: ["web_fetch"] } } }, {})).toThrow(
      "Invalid settings: /librarian/tools/extra is not a recognized key",
    );
    expect(() => parseSettings({ librarian: { web: { fetch: { browsr: {} } } } }, {})).toThrow(
      "Invalid settings: /librarian/web/fetch/browsr is not a recognized key",
    );
    expect(
      parseSettings({ librarian: { tools: { disabled: ["bash"] } }, other: 1 }, {}).tools,
    ).toEqual({ disabled: ["bash"] });
  });

  it.each(["", "  ", "x".repeat(301)])("rejects the source description %j", (description) => {
    const source = { name: "gl", url: "https://gitlab.example.com", kind: "gitlab", description };
    expect(() => parseSettings({ librarian: { sources: [source] } }, {})).toThrow(
      "Invalid settings: /librarian/sources/0/description",
    );
  });

  it.each(["", "  ", 42, ["command"]])("rejects the Parallel key command %j", (apiKeyCommand) => {
    expect(() =>
      parseSettings({ librarian: { web: { parallel: { apiKeyCommand } } } }, {}),
    ).toThrow("Invalid settings: /librarian/web/parallel/apiKeyCommand");
  });

  it("resolves web settings, taking the Parallel key from the environment", () => {
    const settings = parseSettings(
      {
        librarian: {
          web: {
            parallel: { apiKeyCommand: "op read secret" },
            fetch: { browser: { profileDir: "~/profile" }, challenge: { escalation: "never" } },
          },
        },
      },
      { PARALLEL_API_KEY: " key-1 " },
    );
    expect(settings.web).toEqual({
      parallel: { apiKey: "key-1", apiKeyCommand: "op read secret" },
      fetch: {
        browser: { executablePath: undefined, profileDir: path.join(os.homedir(), "profile") },
        challenge: { escalation: "never", headlessWaitSecs: 10, headedWaitSecs: 20 },
      },
    });
    expect(() =>
      parseSettings(
        { librarian: { web: { fetch: { browser: { executablePath: "chrome" } } } } },
        {},
      ),
    ).toThrow(
      'librarian.web.fetch.browser.executablePath must be an absolute path or start with "~/".',
    );
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
            description: "  Nothing here is mirrored to example-bb.  ",
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
        description: undefined,
      },
      {
        name: "example-gl",
        url: "https://gitlab.example.com",
        kind: "gitlab",
        roles: ["clone", "code-search", "repo-search"],
        token: { kind: "value", value: "secret-gl" },
        advancedSearch: true,
        description: "Nothing here is mirrored to example-bb.",
      },
    ]);
  });

  it("reads a kind's conventional token variable when tokenEnv is absent", () => {
    const settings = resolveLibrarianSettings(
      { sources: [{ name: "example-sg", url: "https://search.example.com", kind: "sourcegraph" }] },
      { SRC_ACCESS_TOKEN: "secret-sg" },
    );
    expect(settings.sources[1]?.roles).toEqual(["code-search", "repo-search"]);
    expect(settings.sources[1]?.token).toEqual({ kind: "value", value: "secret-sg" });
  });

  it("takes tokenCommand as the source's credential without running it, and refuses tokenEnv beside it", () => {
    const declared = {
      name: "example-sg",
      url: "https://search.example.com",
      kind: "sourcegraph" as const,
      tokenCommand: "  op read op://Private/Sourcegraph/credential ",
    };
    const settings = resolveLibrarianSettings(
      { sources: [declared] },
      { SRC_ACCESS_TOKEN: "conventional-variable" },
    );
    expect(settings.sources[1]?.token).toEqual({
      kind: "command",
      command: "op read op://Private/Sourcegraph/credential",
    });
    expect(settings.sources[1]?.roles).toEqual(["code-search", "repo-search"]);

    expect(() =>
      resolveLibrarianSettings({ sources: [{ ...declared, tokenEnv: "EXAMPLE_SG_TOKEN" }] }, {}),
    ).toThrow('librarian.sources "example-sg" sets both tokenEnv and tokenCommand; keep one.');
  });

  it.each(["", "  "])("rejects the source token command %j", (tokenCommand) => {
    const source = {
      name: "sg",
      url: "https://search.example.com",
      kind: "sourcegraph",
      tokenCommand,
    };
    expect(() => parseSettings({ librarian: { sources: [source] } }, {})).toThrow(
      "Invalid settings: /librarian/sources/0/tokenCommand",
    );
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
