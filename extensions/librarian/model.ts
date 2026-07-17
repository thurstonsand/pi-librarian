import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import { type ModelRuntime, resolveCliModel } from "@earendil-works/pi-coding-agent";
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
  modelRuntime: ModelRuntime,
  currentModel: Model<Api> | undefined,
  configuredModel: ModelReference | undefined,
  thinkingLevel: ThinkingLevel,
): LibrarianModelResolution | undefined {
  let failure: string | undefined;

  if (configuredModel) {
    const resolved = resolveCliModel({
      ...(configuredModel.provider ? { cliProvider: configuredModel.provider } : {}),
      cliModel: configuredModel.modelId,
      modelRuntime,
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

  if (!currentModel) {
    return undefined;
  }

  if (!configuredModel) {
    return { model: currentModel, thinkingLevel, source: "current" };
  }

  return {
    model: currentModel,
    thinkingLevel,
    source: "current",
    warning: `Configured librarian model "${configuredModel}" is unavailable: ${failure} Using current model "${currentModel.provider}/${currentModel.id}".`,
  };
}
