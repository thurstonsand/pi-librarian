import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ToolInfo } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import {
  collectExtraToolWarnings,
  resolveExtraTools,
} from "../extensions/librarian/extra-tools.ts";
import { createLibrarianResourceLoader } from "../extensions/librarian/resource-loader.ts";
import type { LibrarianSettings } from "../extensions/librarian/settings.ts";

function settings(values: {
  tools: string[];
  extensions?: string[];
  cacheDir?: string;
}): LibrarianSettings {
  return {
    model: undefined,
    thinkingLevel: undefined,
    tools: values.tools,
    extensions: values.extensions ?? [],
    cacheDir: values.cacheDir ?? os.tmpdir(),
  };
}

function toolInfo(name: string, extensionPath: string, source = "local"): ToolInfo {
  return {
    name,
    description: `${name} description`,
    parameters: Type.Object({}),
    sourceInfo: {
      path: extensionPath,
      source,
      scope: "temporary",
      origin: "top-level",
    },
  };
}

describe("resolveExtraTools", () => {
  it("resolves requested tool names to extension paths", () => {
    const resolution = resolveExtraTools(
      [toolInfo("search_web", "/ext/web.ts")],
      settings({ tools: ["search_web"] }),
    );

    expect(resolution.extensionPaths).toEqual(["/ext/web.ts"]);
    expect(resolution.toolNames).toEqual(["search_web"]);
  });

  it("dedupes tools and extension paths", () => {
    const resolution = resolveExtraTools(
      [toolInfo("search_web", "/ext/web.ts"), toolInfo("fetch_web", "/ext/web.ts")],
      settings({
        tools: ["search_web", "fetch_web", "search_web"],
        extensions: ["/ext/web.ts", "/escape.ts"],
      }),
    );

    expect(resolution.extensionPaths).toEqual(["/ext/web.ts", "/escape.ts"]);
    expect(resolution.toolNames).toEqual(["search_web", "fetch_web"]);
  });

  it("keeps unresolved extension tool names activatable for escape-hatch extensions", () => {
    const resolution = resolveExtraTools(
      [],
      settings({ tools: ["fetch_web"], extensions: ["/ext/web.ts"] }),
    );

    expect(resolution.extensionPaths).toEqual(["/ext/web.ts"]);
    expect(resolution.toolNames).toEqual(["fetch_web"]);
  });

  it("allows built-in tools without loading extension paths", async () => {
    const builtinSettings = settings({ tools: ["read", "write"] });
    const toolInfos = [
      toolInfo("read", "<builtin:read>", "builtin"),
      toolInfo("write", "<builtin:write>", "builtin"),
    ];

    expect(resolveExtraTools(toolInfos, builtinSettings)).toEqual({
      extensionPaths: [],
      toolNames: ["read", "write"],
    });
    await expect(collectExtraToolWarnings(toolInfos, builtinSettings)).resolves.toEqual([]);
  });

  it("skips librarian's own tools with warnings", async () => {
    const librarianSettings = settings({ tools: ["librarian", "search_repos"] });

    expect(
      resolveExtraTools([toolInfo("search_repos", "/ext/librarian.ts")], librarianSettings),
    ).toEqual({
      extensionPaths: [],
      toolNames: [],
    });
    await expect(
      collectExtraToolWarnings([toolInfo("search_repos", "/ext/librarian.ts")], librarianSettings),
    ).resolves.toMatchObject([
      { toolName: "librarian", reason: "self" },
      { toolName: "search_repos", reason: "self" },
    ]);
  });

  it("does not warn for unresolved names found by dry-loading escape-hatch extensions", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-librarian-extra-tools-"));
    const extensionPath = path.join(tempDir, "web-tools.ts");
    await fs.writeFile(
      extensionPath,
      `import { Type } from "typebox";

export default function extension(pi) {
  for (const name of ["search_web", "fetch_web"]) {
    pi.registerTool({
      name,
      description: name,
      parameters: Type.Object({}),
      async execute() {
        return { content: [{ type: "text", text: name }] };
      },
    });
  }
}
`,
    );

    await expect(
      collectExtraToolWarnings(
        [],
        settings({
          tools: ["search_web", "fetch_web", "missing_tool"],
          extensions: [extensionPath],
          cacheDir: tempDir,
        }),
      ),
    ).resolves.toMatchObject([{ toolName: "missing_tool", reason: "unresolved" }]);
  });

  it("strips escape-hatch extension hooks during dry-load", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-librarian-extra-tools-"));
    const extensionPath = path.join(tempDir, "hooked.ts");
    await fs.writeFile(
      extensionPath,
      `import { Type } from "typebox";

export default function extension(pi) {
  pi.on("session_start", async () => {});
  pi.registerTool({
    name: "search_web",
    description: "search_web",
    parameters: Type.Object({}),
    async execute() {
      return { content: [{ type: "text", text: "ok" }] };
    },
  });
}
`,
    );

    const resourceLoader = createLibrarianResourceLoader({
      cacheDir: tempDir,
      extensionPaths: [extensionPath],
      systemPromptOverride: () => undefined,
    });
    await resourceLoader.reload();

    expect(resourceLoader.getExtensions().extensions[0]?.handlers.size).toBe(0);
  });

  it("surfaces escape-hatch extension load failures during validation", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "pi-librarian-extra-tools-"));
    const extensionPath = path.join(tempDir, "broken.ts");
    await fs.writeFile(
      extensionPath,
      "export default function extension() { throw new Error('boom'); }\n",
    );

    await expect(
      collectExtraToolWarnings(
        [],
        settings({ tools: ["search_web"], extensions: [extensionPath], cacheDir: tempDir }),
      ),
    ).resolves.toMatchObject([
      { toolName: extensionPath, reason: "extensionLoad" },
      { toolName: "search_web", reason: "unresolved" },
    ]);
  });
});
