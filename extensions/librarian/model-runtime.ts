import { type ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";

// Workaround for a missing extension API: resolveCliModel and createAgentSession want a
// ModelRuntime, but ExtensionContext only exposes the ModelRegistry compatibility facade,
// which keeps its runtime private. Until pi exposes the runtime to extensions, build a
// fresh one per librarian run and mirror the registered providers (e.g. pi-claude-bridge)
// so their live stream closures carry over by reference. Extensions register either a
// native Provider or a legacy provider config, and the facade exposes each through its
// own accessor while listing both id sets together.
export async function createLibrarianModelRuntime(
  modelRegistry: ModelRegistry,
): Promise<ModelRuntime> {
  const modelRuntime = await ModelRuntime.create({ allowModelNetwork: false });

  for (const providerId of modelRegistry.getRegisteredProviderIds()) {
    const native = modelRegistry.getRegisteredNativeProvider(providerId);
    if (native) {
      modelRuntime.registerNativeProvider(native);
      continue;
    }
    const config = modelRegistry.getRegisteredProviderConfig(providerId);
    if (config) {
      modelRuntime.registerProvider(providerId, config);
    }
  }

  await modelRuntime.refresh({ allowNetwork: false });
  return modelRuntime;
}
