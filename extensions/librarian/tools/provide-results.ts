import { defineTool } from "@earendil-works/pi-coding-agent";
import { type Static, Type } from "typebox";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";

export const LocationSchema = Type.Object({
  repo: Type.String({
    description: "Repository as owner/repo or a repository URL.",
  }),
  file: Type.String({
    description: "Validated file path within the repository.",
  }),
  lines: Type.Optional(
    Type.String({
      description: 'Line range like "80-140" or a single line like "42".',
    }),
  ),
  note: Type.String({ description: "Relevance of the file." }),
});

export const FindingsSchema = Type.Object({
  summary: Type.String({
    description: "1-3 sentence direct answer to the query. No preamble.",
  }),
  locations: Type.Array(LocationSchema, {
    description:
      "Evidence source-file locations. Include only repository files you validated by reading.",
  }),
  description: Type.Optional(
    Type.String({
      description:
        "Optional extended findings in markdown (e.g. step-by-step flow tracing, comparisons).",
    }),
  ),
});

export type Findings = Static<typeof FindingsSchema>;
export type FindingsLocation = Static<typeof LocationSchema>;

export interface ProvideResultsDetails {
  kind: "provide_results";
  locationCount: number;
}

export function createProvideResultsTool(onFindings: (findings: Findings) => void) {
  return defineTool<typeof FindingsSchema, ProvideResultsDetails>({
    name: LIBRARIAN_TOOL_NAMES.provideResults,
    label: "Provide results",
    description: "Report your findings in structured form.",
    promptSnippet: "Report findings",
    promptGuidelines: [
      "provide_results ends the turn; call it once, after you've gathered your findings.",
    ],
    parameters: FindingsSchema,

    async execute(_toolCallId, params) {
      onFindings(params);
      return {
        content: [
          {
            type: "text",
            text: "Findings recorded. You are done; do not call more tools.",
          },
        ],
        details: {
          kind: "provide_results",
          locationCount: params.locations.length,
        },
        terminate: true,
      };
    },
  });
}
