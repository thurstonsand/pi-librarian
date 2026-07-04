import type { Api, Model } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import { resolveLibrarianModel } from "../extensions/librarian/model.ts";
import { ModelReference } from "../extensions/librarian/settings.ts";

const configuredModel = { provider: "anthropic", id: "claude-sonnet" } as Model<Api>;
const currentModel = { provider: "openai", id: "gpt-5" } as Model<Api>;
const datedSonnet = { provider: "anthropic", id: "claude-sonnet-20250101" } as Model<Api>;
const aliasSonnet = { provider: "anthropic", id: "claude-sonnet-latest" } as Model<Api>;

function context(models: Model<Api>[], current: Model<Api> | undefined): ExtensionContext {
  return {
    model: current,
    modelRegistry: {
      getAvailable: () => models,
    },
  } as ExtensionContext;
}

describe("resolveLibrarianModel", () => {
  it("uses configured model and configured thinking level", () => {
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

  it("carries the resolved thinking level", () => {
    const resolution = resolveLibrarianModel(
      context([configuredModel], currentModel),
      new ModelReference("anthropic", "claude-sonnet"),
      "medium",
    );

    expect(resolution?.thinkingLevel).toBe("medium");
  });

  it("supports partial configured model matches and prefers aliases", () => {
    const resolution = resolveLibrarianModel(
      context([datedSonnet, aliasSonnet], currentModel),
      new ModelReference("anthropic", "sonnet"),
      "high",
    );

    expect(resolution?.model).toBe(aliasSonnet);
  });

  it("falls back to current model with the resolved thinking level", () => {
    const resolution = resolveLibrarianModel(
      context([], currentModel),
      new ModelReference("anthropic", "claude-sonnet"),
      "off",
    );

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
