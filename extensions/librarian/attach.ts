import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { safeParseTypeBoxValue } from "../shared/typebox.ts";
import { ATTACHABLE_TOOL_NAMES } from "./tools/names.ts";

export const ATTACH_ENTRY_TYPE = "pi-librarian:attach";

const ATTACH_STATE_SCHEMA = Type.Object({
  attached: Type.Boolean(),
});

export function readAttachState(ctx: ExtensionContext): boolean {
  let attached = false;
  for (const entry of ctx.sessionManager.getEntries()) {
    if (entry.type !== "custom" || entry.customType !== ATTACH_ENTRY_TYPE) {
      continue;
    }
    const parsed = safeParseTypeBoxValue(ATTACH_STATE_SCHEMA, entry.data);
    if (parsed) {
      attached = parsed.attached;
    }
  }
  return attached;
}

export function applyAttachState(pi: ExtensionAPI, attached: boolean): void {
  const active = new Set(pi.getActiveTools());
  for (const name of ATTACHABLE_TOOL_NAMES) {
    if (attached) {
      active.add(name);
    } else {
      active.delete(name);
    }
  }
  pi.setActiveTools([...active]);
}

export function setAttachState(pi: ExtensionAPI, attached: boolean): void {
  applyAttachState(pi, attached);
  pi.appendEntry(ATTACH_ENTRY_TYPE, { attached });
}
