import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type Component, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { safeParseTypeBoxValue } from "../shared/typebox.ts";
import { ATTACHABLE_TOOL_NAMES } from "./tools/names.ts";

export const ATTACH_ENTRY_TYPE = "pi-librarian:attach";

const ATTACH_ENTRY_SCHEMA = Type.Object({
  attached: Type.Boolean(),
  tools: Type.Array(Type.String()),
});

export interface AttachEntryData {
  attached: boolean;
  tools: string[];
}

export function readAttachState(ctx: ExtensionContext): boolean {
  let attached = false;
  for (const entry of ctx.sessionManager.getEntries()) {
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
  pi.appendEntry<AttachEntryData>(ATTACH_ENTRY_TYPE, {
    attached,
    tools: [...ATTACHABLE_TOOL_NAMES],
  });
}

export function renderAttachEntry(data: unknown, expanded: boolean, theme: Theme): Component {
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
