import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { resolveLibrarianModel } from "../extensions/librarian/model.ts";
import { ModelReference } from "../extensions/librarian/settings.ts";

const configuredModel = { provider: "anthropic", id: "claude-sonnet" } as Model<Api>;
const currentModel = { provider: "openai", id: "gpt-5" } as Model<Api>;
const datedOpus = { provider: "anthropic", id: "claude-opus-20250101" } as Model<Api>;
const aliasOpus = { provider: "anthropic", id: "claude-opus-latest" } as Model<Api>;

function context(allModels: Model<Api>[], current: Model<Api> | undefined): ExtensionContext {
  return {
    model: current,
    modelRegistry: {
      getAll: () => allModels,
    },
  } as ExtensionContext;
}

describe("resolveLibrarianModel", () => {
  it("uses a configured model and configured thinking level", () => {
    const resolution = resolveLibrarianModel(
      context([configuredModel], currentModel),
      new ModelReference("anthropic", "claude-sonnet"),
      "high",
    );

    expect(resolution).toEqual({
      model: configuredModel,
      thinkingLevel: "high",
      source: "configured",
    });
  });

  it("carries Pi's max thinking level", () => {
    const resolution = resolveLibrarianModel(
      context([configuredModel], currentModel),
      new ModelReference("anthropic", "claude-sonnet"),
      "max",
    );

    expect(resolution?.thinkingLevel).toBe("max");
  });

  it("uses Pi's bare fuzzy matching and model priority", () => {
    const resolution = resolveLibrarianModel(
      context([datedOpus, aliasOpus], currentModel),
      new ModelReference(undefined, "opus"),
      "high",
    );

    expect(resolution?.model).toBe(aliasOpus);
    expect(resolution?.source).toBe("configured");
  });

  it("does not restrict configured models to authenticated models", () => {
    const resolution = resolveLibrarianModel(
      context([configuredModel], currentModel),
      new ModelReference("anthropic", "claude-sonnet"),
      "medium",
    );

    expect(resolution?.model).toBe(configuredModel);
    expect(resolution?.source).toBe("configured");
  });

  it("accepts and warns about Pi's custom model-id fallback", () => {
    const resolution = resolveLibrarianModel(
      context([configuredModel], currentModel),
      new ModelReference("anthropic", "missing-model"),
      "off",
    );

    expect(resolution?.model.provider).toBe("anthropic");
    expect(resolution?.model.id).toBe("missing-model");
    expect(resolution?.source).toBe("configured");
    expect(resolution?.warning).toContain("Using custom model id");
  });

  it("includes Pi's resolution error when falling back from an unknown provider", () => {
    const resolution = resolveLibrarianModel(
      context([configuredModel], currentModel),
      new ModelReference("missing", "model"),
      "low",
    );

    expect(resolution?.warning).toContain('Unknown provider "missing"');
    expect(resolution?.warning).toContain('Using current model "openai/gpt-5"');
    expect(resolution?.model).toBe(currentModel);
  });

  it("uses the current model without warning when none is configured", () => {
    const resolution = resolveLibrarianModel(context([], currentModel), undefined, "off");

    expect(resolution).toEqual({
      model: currentModel,
      thinkingLevel: "off",
      source: "current",
    });
  });

  it("returns undefined when no model is available", () => {
    const resolution = resolveLibrarianModel(context([], undefined), undefined, "medium");

    expect(resolution).toBeUndefined();
  });
});
