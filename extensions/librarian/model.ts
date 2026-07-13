import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import { type ExtensionContext, resolveCliModel } from "@earendil-works/pi-coding-agent";
import type { ModelReference } from "./settings.ts";

export type LibrarianModelSource = "configured" | "current";

export interface LibrarianModelResolution {
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
  source: LibrarianModelSource;
  warning?: string;
}

function configuredModelFailure(
  configuredModel: ModelReference,
  error: string | undefined,
  warning: string | undefined,
): string {
  if (error) {
    return error;
  }
  if (warning) {
    return warning;
  }
  return `Could not resolve configured model "${configuredModel}".`;
}

export function resolveLibrarianModel(
  ctx: ExtensionContext,
  configuredModel: ModelReference | undefined,
  thinkingLevel: ThinkingLevel,
): LibrarianModelResolution | undefined {
  let failure: string | undefined;

  if (configuredModel) {
    const resolved = resolveCliModel({
      ...(configuredModel.provider ? { cliProvider: configuredModel.provider } : {}),
      cliModel: configuredModel.modelId,
      modelRegistry: ctx.modelRegistry,
    });
    if (resolved.model) {
      const resolution: LibrarianModelResolution = {
        model: resolved.model,
        thinkingLevel,
        source: "configured",
      };
      if (resolved.warning) {
        resolution.warning = resolved.warning;
      }
      return resolution;
    }

    failure = configuredModelFailure(configuredModel, resolved.error, resolved.warning);
  }

  if (!ctx.model) {
    return undefined;
  }

  if (!configuredModel) {
    return { model: ctx.model, thinkingLevel, source: "current" };
  }

  return {
    model: ctx.model,
    thinkingLevel,
    source: "current",
    warning: `Configured librarian model "${configuredModel}" is unavailable: ${failure} Using current model "${ctx.model.provider}/${ctx.model.id}".`,
  };
}
