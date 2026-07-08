import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { CheckoutError, checkoutRepo } from "../checkout.ts";
import { LIBRARIAN_TOOL_NAMES } from "./names.ts";

export interface CheckoutRepoDetails {
  kind: "checkout_repo";
  repo: string;
  path: string;
  headSha: string;
  ref: string;
  fileCount: number;
  reusedClone: boolean;
}

const CheckoutRepoParams = Type.Object({
  repo: Type.String({
    description: "Repository as owner/repo (for Github) or an HTTPS/SSH repository URL.",
  }),
  ref: Type.Optional(
    Type.String({
      description: "Branch, tag, or commit sha. Default: the default branch.",
    }),
  ),
});

export function createCheckoutRepoTool(cacheDir: string) {
  return defineTool<typeof CheckoutRepoParams, CheckoutRepoDetails>({
    name: LIBRARIAN_TOOL_NAMES.checkoutRepo,
    label: "Checkout repo",
    description: "Clone a repo (blob-less partial clone, cached locally).",
    promptSnippet: "Clone a repo locally",
    promptGuidelines: [
      "Use checkout_repo to deep dive on a specific repo, then grep/read/find/ls on the returned path and `git -C <path> log/blame/diff` for history.",
      "Do not clone repos directly with `git`; always use checkout_repo.",
    ],
    parameters: CheckoutRepoParams,

    async execute(_toolCallId, params, signal) {
      try {
        const result = await checkoutRepo(params.repo, params.ref, cacheDir, signal);
        const text = [
          `Checked out ${result.repo}@${result.ref} (${result.headSha.slice(0, 12)})`,
          `Local path: ${result.path}`,
          `${result.fileCount} files.`,
        ].join("\n");

        return {
          content: [{ type: "text", text }],
          details: {
            kind: "checkout_repo",
            repo: result.repo,
            path: result.path,
            headSha: result.headSha,
            ref: result.ref,
            fileCount: result.fileCount,
            reusedClone: result.reusedClone,
          },
        };
      } catch (error) {
        const message =
          error instanceof CheckoutError
            ? error.message
            : error instanceof Error
              ? error.message
              : String(error);
        throw new Error(
          `${message}\nIf the repo name is uncertain, resolve it with search_repos first.`,
        );
      }
    },
  });
}
