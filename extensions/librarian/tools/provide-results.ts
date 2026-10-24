import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";

function locationSchema(sourceNames: string[]) {
  return Type.Object({
    source: Type.String({
      description: `Where the repository lives, as passed to checkout_repo or read_file: one of ${sourceNames.join(", ")}. For a repository cloned by full URL, its host, e.g. gitlab.com.`,
    }),
    repo: Type.String({ description: "Repository path within the source, e.g. owner/repo." }),
    file: Type.String({ description: "Validated file path within the repository." }),
    lines: Type.Optional(
      Type.String({ description: 'Line range like "80-140" or a single line like "42".' }),
    ),
    note: Type.String({ description: "Relevance of the file." }),
  });
}

export function findingsSchema(sourceNames: string[]) {
  return Type.Object({
    summary: Type.String({
      description: "1-3 sentence direct answer to the query. No preamble.",
    }),
    locations: Type.Array(locationSchema(sourceNames), {
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
}

export interface FindingsLocation {
  source: string;
  repo: string;
  file: string;
  lines?: string;
  note: string;
}

export interface Findings {
  summary: string;
  locations: FindingsLocation[];
  description?: string;
}

export interface ProvideResultsDetails {
  kind: "provide_results";
  locationCount: number;
}

export function createProvideResultsTool(
  sourceNames: string[],
  onFindings: (findings: Findings) => void,
) {
  const FindingsParams = findingsSchema(sourceNames);
  return defineTool<typeof FindingsParams, ProvideResultsDetails>({
    name: LIBRARIAN_TOOL_NAMES.provideResults,
    label: "Provide results",
    description:
      "Report your findings in structured form. This is the only way findings reach the caller, and calling it ends your turn.",
    promptGuidelines: [
      "You MUST end by calling provide_results exactly once, after your research is complete. It ends your turn, so call it last and by itself.",
      "Findings only count through provide_results; do not write them as a plain message.",
    ],
    parameters: FindingsParams,
    annotations: { readOnlyHint: true, openWorldHint: false },

    async execute(_toolCallId, params) {
      onFindings(params);
      return {
        content: [
          { type: "text", text: "Findings recorded. You are done; do not call more tools." },
        ],
        details: { kind: "provide_results", locationCount: params.locations.length },
        terminate: true,
      };
    },
  });
}
