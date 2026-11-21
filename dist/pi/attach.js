import { Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { safeParseTypeBoxValue } from "../core/typebox.js";
export const ATTACH_ENTRY_TYPE = "pi-librarian:attach";
const ATTACH_ENTRY_SCHEMA = Type.Object({
    attached: Type.Boolean(),
    tools: Type.Array(Type.String()),
});
export function readAttachState(ctx) {
    let attached = false;
    for (const entry of ctx.sessionManager.getBranch()) {
        if (entry.type !== "custom" || entry.customType !== ATTACH_ENTRY_TYPE) {
            continue;
        }
        const parsed = safeParseTypeBoxValue(ATTACH_ENTRY_SCHEMA, entry.data);
        if (parsed) {
            attached = parsed.attached;
        }
    }
    return attached;
}
export function applyAttachState(pi, attached, toolNames) {
    const active = new Set(pi.getActiveTools());
    for (const name of toolNames) {
        if (attached) {
            active.add(name);
        }
        else {
            active.delete(name);
        }
    }
    pi.setActiveTools([...active]);
}
export function setAttachState(pi, attached, toolNames) {
    applyAttachState(pi, attached, toolNames);
    pi.appendEntry(ATTACH_ENTRY_TYPE, { attached, tools: [...toolNames] });
}
export function renderAttachEntry(data, expanded, theme) {
    const entry = safeParseTypeBoxValue(ATTACH_ENTRY_SCHEMA, data);
    if (!entry) {
        return new Text(theme.fg("warning", "Librarian attach state unavailable"), 0, 0);
    }
    const state = entry.attached ? "attached" : "detached";
    const color = entry.attached ? "success" : "muted";
    let text = theme.fg(color, `Librarian tools ${state}`);
    if (expanded) {
        text += `\n${entry.tools.map((tool) => theme.fg("dim", `  ${tool}`)).join("\n")}`;
    }
    return new Text(text, 0, 0);
}
