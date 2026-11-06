import type { Static, TSchema } from "typebox";

// The shape every research tool takes, independent of any harness. It is structurally a subset of
// pi's ToolDefinition, so the pi binding registers these as they are; the CLI calls execute
// directly.

export type JsonValue = null | boolean | number | string | readonly JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };

export interface ToolResult<TDetails> {
  content: { type: "text"; text: string }[];
  details: TDetails;
  structuredContent?: JsonValue;
}

export interface LibrarianTool<TParams extends TSchema = TSchema, TDetails = unknown> {
  name: string;
  label: string;
  description: string;
  promptSnippet?: string;
  promptGuidelines?: string[];
  parameters: TParams;
  outputSchema?: TSchema;
  annotations?: {
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  // Method syntax, so a tool with specific parameters still fits a list of LibrarianTool.
  execute(
    toolCallId: string,
    params: Static<TParams>,
    signal: AbortSignal | undefined,
    onUpdate?: (partial: ToolResult<TDetails>) => void,
  ): Promise<ToolResult<TDetails>>;
}

export function defineTool<TParams extends TSchema, TDetails>(
  tool: LibrarianTool<TParams, TDetails>,
): LibrarianTool<TParams, TDetails> {
  return tool;
}
