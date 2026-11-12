import { resolveCliModel } from "@earendil-works/pi-coding-agent";
// Pi exports neither VIRTUAL_MODEL_API nor isVirtualModel; this is the documented API id of virtual catalog entries.
const VIRTUAL_MODEL_API = "pi-virtual";
function configuredModelFailure(configuredModel, error, warning) {
    if (error) {
        return error;
    }
    if (warning) {
        return warning;
    }
    return `Could not resolve configured model "${configuredModel}".`;
}
export function resolveLibrarianModel(modelRuntime, currentModel, configuredModel, thinkingLevel) {
    let failure;
    if (configuredModel) {
        const resolved = resolveCliModel({
            ...(configuredModel.provider ? { cliProvider: configuredModel.provider } : {}),
            cliModel: configuredModel.modelId,
            modelRuntime,
        });
        if (resolved.model && resolved.model.api !== VIRTUAL_MODEL_API) {
            const resolution = {
                model: resolved.model,
                thinkingLevel,
                source: "configured",
            };
            if (resolved.warning) {
                resolution.warning = resolved.warning;
            }
            return resolution;
        }
        failure = resolved.model
            ? `it is a virtual model, which the librarian does not support.`
            : configuredModelFailure(configuredModel, resolved.error, resolved.warning);
    }
    if (!currentModel) {
        throw new Error("No model available for the librarian. Configure pi.model in the librarian settings or select a session model.");
    }
    if (currentModel.api === VIRTUAL_MODEL_API) {
        throw new Error(`The librarian does not support virtual models; "${currentModel.provider}/${currentModel.id}" is one. Configure pi.model in the librarian settings with a physical model or select one for this session.`);
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
