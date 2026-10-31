import { inspect } from "node:util";
import type { ExtensionContext, ExtensionToolContext } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveLibrarianSettings } from "../extensions/librarian/settings.ts";
import { createWebTools } from "../extensions/librarian/web/index.ts";
import { createParallelFetcher, ParallelClient } from "../extensions/librarian/web/parallel.ts";
import { createWebSearchTool } from "../extensions/librarian/web/search.ts";
import { stubFetch } from "./support/fetch-stub.ts";

const command = 'printf "%s\\n" "$WEB_TOOLS_TEST_KEY"';
const ctx = {} as ExtensionToolContext;

function parallelStub() {
  return stubFetch([
    (request) =>
      request.url.pathname === "/v1/search"
        ? Response.json({ search_id: "s1", session_id: "s", results: [] })
        : Response.json({ extract_id: "e1", session_id: "s", results: [], errors: [] }),
  ]);
}

function client(apiKeyCommand: string | undefined, apiKey?: string): ParallelClient {
  return new ParallelClient({ apiKey, apiKeyCommand });
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => undefined,
    (error: unknown) => error,
  );
}

beforeEach(() => {
  vi.stubEnv("WEB_TOOLS_TEST_KEY", "fake-command-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("web tool registration", () => {
  it("registers web_search only when a Parallel credential source is configured", () => {
    const names = (web: Record<string, unknown>, env: NodeJS.ProcessEnv) =>
      createWebTools(resolveLibrarianSettings({ web }, env), new Map()).tools.map(
        (tool) => tool.name,
      );

    expect(names({}, {})).toEqual(["web_fetch"]);
    expect(names({}, { PARALLEL_API_KEY: "k" })).toEqual(["web_search", "web_fetch"]);
    expect(names({ parallel: { apiKeyCommand: command } }, {})).toEqual([
      "web_search",
      "web_fetch",
    ]);
  });
});

describe("Parallel API key command", () => {
  it("runs the command per call, so a rotated key takes effect", async () => {
    const requests = parallelStub();
    const tool = createWebSearchTool(client(command));

    await tool.execute("first", { objective: "test" }, undefined, undefined, ctx);
    vi.stubEnv("WEB_TOOLS_TEST_KEY", "rotated-fake-key");
    await tool.execute("second", { objective: "test again" }, undefined, undefined, ctx);

    expect(requests.map((request) => request.headers.get("x-api-key"))).toEqual([
      "fake-command-key",
      "rotated-fake-key",
    ]);
  });

  it("resolves extraction credentials only when the fetcher runs", async () => {
    const requests = parallelStub();
    const fetcher = createParallelFetcher(client(command));
    expect(fetcher.canFetch("https://example.com")).toBe(true);
    expect(requests).toEqual([]);

    await fetcher.fetch({
      urls: ["https://example.com"],
      artifactDir: "/unused-no-results",
      signal: undefined,
      ctx: {} as ExtensionContext,
    });

    expect(
      requests.map((request) => [request.url.pathname, request.headers.get("x-api-key")]),
    ).toEqual([["/v1/extract", "fake-command-key"]]);
    expect(JSON.parse(requests[0]?.body ?? "")).toEqual({
      urls: ["https://example.com"],
      advanced_settings: { full_content: true },
    });
  });

  it("prefers the environment key without executing the configured command", async () => {
    const requests = parallelStub();
    await createWebSearchTool(client("exit 99", "fake-env-key")).execute(
      "call",
      { objective: "test" },
      undefined,
      undefined,
      ctx,
    );
    expect(requests[0]?.headers.get("x-api-key")).toBe("fake-env-key");
  });

  it("fails without a configured source", async () => {
    const requests = parallelStub();
    await expect(client(undefined).search(searchRequest(), undefined)).rejects.toThrow(
      "Parallel credentials are not configured",
    );
    expect(requests).toEqual([]);
  });

  it.each([`${command}; ${command} >&2; exit 7`, "missing-web-tools-credential-command"])(
    "does not expose command, stdout, stderr, or causes on failure",
    async (failingCommand) => {
      const requests = parallelStub();
      const error = await failure(client(failingCommand).search(searchRequest(), undefined));
      expect(error).toBeInstanceOf(Error);
      expect(inspect(error)).toContain("Parallel API key command failed");
      expect(inspect(error)).not.toContain("fake-command-key");
      expect(inspect(error)).not.toContain(failingCommand);
      expect(error).not.toHaveProperty("cause");
      expect(error).not.toHaveProperty("stdout");
      expect(error).not.toHaveProperty("stderr");
      expect(requests).toEqual([]);
    },
  );

  it.each(["printf ''", "printf 'first\\nsecond\\n'"])(
    "rejects empty or multiline output",
    async (invalidCommand) => {
      parallelStub();
      await expect(client(invalidCommand).search(searchRequest(), undefined)).rejects.toThrow(
        "Parallel API key command must print a single nonempty value",
      );
    },
  );

  it("closes stdin instead of allowing a credential command to prompt", async () => {
    parallelStub();
    await expect(client("read key").search(searchRequest(), undefined)).rejects.toThrow(
      "Parallel API key command failed",
    );
  });

  it("passes cancellation to credential resolution without exposing subprocess details", async () => {
    const requests = parallelStub();
    const controller = new AbortController();
    controller.abort();
    await expect(client(command).search(searchRequest(), controller.signal)).rejects.toThrow(
      "Parallel API key command failed",
    );
    expect(requests).toEqual([]);
  });

  it("does not resolve a key for invalid search arguments", async () => {
    const requests = parallelStub();
    const tool = createWebSearchTool(client(command));
    await expect(
      tool.execute(
        "invalid",
        { objective: "test", after_date: "invalid" },
        undefined,
        undefined,
        ctx,
      ),
    ).rejects.toThrow("Invalid after_date");
    expect(requests).toEqual([]);
  });
});

function searchRequest() {
  return {
    objective: "test",
    search_queries: ["test"],
    mode: "advanced" as const,
    advanced_settings: { max_results: 5 },
  };
}
