import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionToolContext, ToolDefinition } from "@earendil-works/pi-coding-agent";
import { resolveLibrarianSettings } from "../../extensions/librarian/settings.ts";
import { createRepoClients, createRepoTools } from "../../extensions/librarian/tools/index.ts";

type FileSettings = Parameters<typeof resolveLibrarianSettings>[0];

export async function temporaryCacheDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "librarian-tools-"));
}

export function repoTools(
  fileSettings: FileSettings,
  env: NodeJS.ProcessEnv,
): Map<string, ToolDefinition> {
  const settings = resolveLibrarianSettings(fileSettings, env);
  const { tools } = createRepoTools(settings, createRepoClients(settings));
  return new Map(tools.map((tool) => [tool.name, tool]));
}

export async function call(
  tools: Map<string, ToolDefinition>,
  name: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<AgentToolResult<unknown>> {
  const tool = tools.get(name);
  if (!tool) {
    throw new Error(`tool ${name} is not registered; have ${[...tools.keys()].join(", ")}`);
  }
  return tool.execute("call-1", params as never, signal, undefined, {} as ExtensionToolContext);
}

export function text(result: AgentToolResult<unknown>): string {
  const first = result.content[0];
  return first && first.type === "text" ? first.text : "";
}

// The artifact path and size vary by machine; the records inside are asserted separately.
export function withoutArtifact(digest: string): string {
  return digest.replace(/Full results: \S+ \(([^)]*)\)/, "Full results: <artifact>");
}

export async function artifactRecords(result: AgentToolResult<unknown>): Promise<unknown[]> {
  const details = result.details as { artifact: { path: string } };
  const body = await fs.readFile(details.artifact.path, "utf-8");
  return body
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line));
}
