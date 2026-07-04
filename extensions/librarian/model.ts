import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { ModelReference } from "./settings.ts";

export type LibrarianModelSource = "configured" | "current";

export interface LibrarianModelResolution {
  model: Model<Api>;
  thinkingLevel: ThinkingLevel;
  source: LibrarianModelSource;
}

function isAlias(modelId: string): boolean {
  return modelId.endsWith("-latest") || !/-\d{8}$/.test(modelId);
}

function bestModelMatch(models: Model<Api>[], pattern: string): Model<Api> | undefined {
  const normalizedPattern = pattern.toLowerCase();
  const exactMatches = models.filter((model) => model.id.toLowerCase() === normalizedPattern);
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  const partialMatches = models.filter(
    (model) =>
      model.id.toLowerCase().includes(normalizedPattern) ||
      model.name?.toLowerCase().includes(normalizedPattern),
  );
  if (partialMatches.length === 0) {
    return undefined;
  }

  const aliases = partialMatches.filter((model) => isAlias(model.id));
  const candidates = aliases.length > 0 ? aliases : partialMatches;
  return candidates.toSorted((a, b) => b.id.localeCompare(a.id))[0];
}

export function resolveLibrarianModel(
  ctx: ExtensionContext,
  configuredModel: ModelReference | undefined,
  thinkingLevel: ThinkingLevel,
): LibrarianModelResolution | undefined {
  if (configuredModel) {
    const providerModels = ctx.modelRegistry
      .getAvailable()
      .filter((model) => model.provider === configuredModel.provider);
    const match = bestModelMatch(providerModels, configuredModel.modelId);
    if (match) {
      return { model: match, thinkingLevel, source: "configured" };
    }
  }

  if (!ctx.model) {
    return undefined;
  }

  return { model: ctx.model, thinkingLevel, source: "current" };
}
