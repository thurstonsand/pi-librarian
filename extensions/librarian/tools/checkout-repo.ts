import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { checkoutRepo, cloneSources } from "../checkout.ts";
import { plural } from "../delivery.ts";
import type { LibrarianSource } from "../settings.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";
import { sourceLabels } from "./shared.ts";

export interface CheckoutRepoDetails {
  kind: "checkout_repo";
  // Absent when repo was a full clone URL.
  source: string | undefined;
  repo: string;
  // Host plus repository path, lowercased: how a cited location finds the commit that was read.
  identity: string;
  path: string;
  ref: string;
  headSha: string;
  fileCount: number;
}

export function createCheckoutRepoTool(cacheDir: string, sources: LibrarianSource[]) {
  const clonable = cloneSources(sources);
  const CheckoutRepoParams = Type.Object({
    repo: Type.String({
      description: "Repository path, e.g. platform/widget-sdk, or a full HTTPS or SSH clone URL.",
    }),
    source: Type.Optional(
      StringEnum(
        clonable.map((source) => source.name),
        {
          description: `Source for the code: ${sourceLabels(clonable)}. Omit when repo is a full clone URL.`,
        },
      ),
    ),
    ref: Type.Optional(
      Type.String({
        description:
          "Branch, tag, or commit. To check a search result, pass its commit so line numbers agree. Default: the default branch.",
      }),
    ),
  });

  return defineTool<typeof CheckoutRepoParams, CheckoutRepoDetails>({
    name: LIBRARIAN_TOOL_NAMES.checkoutRepo,
    label: "Checkout repo",
    description:
      "Clone a repository into a local cache and check out a branch, tag, or commit, returning its path for grep, read, and git log, blame, and diff. Clones are reused across calls.",
    promptGuidelines: ["Do not clone repositories with git directly; use checkout_repo."],
    parameters: CheckoutRepoParams,
    // Its resets and cleans only ever touch clones inside the checkout cache it owns.
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },

    async execute(_toolCallId, params, signal) {
      try {
        const result = await checkoutRepo(
          params.repo,
          sources,
          params.source,
          params.ref,
          cacheDir,
          signal,
        );
        const where = params.source ? `${params.repo} (${params.source})` : params.repo;
        const text = [
          `Checked out ${where} at ${result.ref}, commit ${result.headSha.slice(0, 12)}.`,
          `Local path: ${result.path}`,
          `${plural(result.fileCount, "file")}.`,
        ].join("\n");

        return {
          content: [{ type: "text", text }],
          details: {
            kind: "checkout_repo",
            source: params.source,
            repo: params.repo,
            identity: result.repo,
            path: result.path,
            ref: result.ref,
            headSha: result.headSha,
            fileCount: result.fileCount,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${message}\nIf the repository name is uncertain, resolve it with a repository search first.`,
        );
      }
    },
  });
}
