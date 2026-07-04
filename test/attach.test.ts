import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  ATTACH_ENTRY_TYPE,
  applyAttachState,
  readAttachState,
} from "../extensions/librarian/attach.ts";
import { ATTACHABLE_TOOL_NAMES } from "../extensions/librarian/tools/names.ts";

function contextWithEntries(entries: unknown[]): ExtensionContext {
  return {
    sessionManager: {
      getEntries: () => entries,
    },
  } as unknown as ExtensionContext;
}

function fakePi(initialActive: string[]): {
  pi: ExtensionAPI;
  getActive: () => string[];
} {
  let active = [...initialActive];
  const pi = {
    getActiveTools: () => [...active],
    setActiveTools: (names: string[]) => {
      active = [...names];
    },
  } as unknown as ExtensionAPI;
  return { pi, getActive: () => active };
}

describe("readAttachState", () => {
  it("defaults to detached", () => {
    expect(readAttachState(contextWithEntries([]))).toBe(false);
  });

  it("honors the most recent attach entry", () => {
    const ctx = contextWithEntries([
      { type: "custom", customType: ATTACH_ENTRY_TYPE, data: { attached: true } },
      { type: "message" },
      { type: "custom", customType: ATTACH_ENTRY_TYPE, data: { attached: false } },
    ]);
    expect(readAttachState(ctx)).toBe(false);
  });

  it("ignores malformed entries", () => {
    const ctx = contextWithEntries([
      { type: "custom", customType: ATTACH_ENTRY_TYPE, data: { attached: "yes" } },
    ]);
    expect(readAttachState(ctx)).toBe(false);
  });
});

describe("applyAttachState", () => {
  it("adds the attachable tools when attaching", () => {
    const { pi, getActive } = fakePi(["read", "bash", "librarian"]);
    applyAttachState(pi, true);
    for (const name of ATTACHABLE_TOOL_NAMES) {
      expect(getActive()).toContain(name);
    }
    expect(getActive()).toContain("librarian");
  });

  it("removes the attachable tools when detaching, leaving others", () => {
    const { pi, getActive } = fakePi(["read", "search_repos", "checkout_repo", "librarian"]);
    applyAttachState(pi, false);
    expect(getActive()).toEqual(["read", "librarian"]);
  });
});
