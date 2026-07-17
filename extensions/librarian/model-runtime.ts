import { type ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";

// Workaround for a missing extension API: resolveCliModel and createAgentSession want a
// ModelRuntime, but ExtensionContext only exposes the ModelRegistry compatibility facade,
// which keeps its runtime private. Until pi exposes the runtime to extensions, build a
// fresh one per librarian run and mirror the registered providers (e.g. pi-claude-bridge)
// so their configs — including live streamSimple closures — carry over by reference.
export async function createLibrarianModelRuntime(
  modelRegistry: ModelRegistry,
): Promise<ModelRuntime> {
  const modelRuntime = await ModelRuntime.create({ allowModelNetwork: false });

  for (const providerId of modelRegistry.getRegisteredProviderIds()) {
    const config = modelRegistry.getRegisteredProviderConfig(providerId);
    if (config) {
      modelRuntime.registerProvider(providerId, config);
    }
  }

  await modelRuntime.refresh({ allowNetwork: false });
  return modelRuntime;
}
