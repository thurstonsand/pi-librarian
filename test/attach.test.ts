import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
  ATTACH_ENTRY_TYPE,
  applyAttachState,
  readAttachState,
  renderAttachEntry,
  setAttachState,
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
  getEntries: () => Array<{ customType: string; data: unknown }>;
} {
  let active = [...initialActive];
  const entries: Array<{ customType: string; data: unknown }> = [];
  const pi = {
    getActiveTools: () => [...active],
    setActiveTools: (names: string[]) => {
      active = [...names];
    },
    appendEntry: (customType: string, data: unknown) => {
      entries.push({ customType, data });
    },
  } as unknown as ExtensionAPI;
  return { pi, getActive: () => active, getEntries: () => entries };
}

const theme = {
  fg: (_color: string, text: string) => text,
} as unknown as Theme;

function render(data: unknown, expanded = false): string[] {
  return renderAttachEntry(data, expanded, theme)
    .render(200)
    .map((line) => line.trimEnd());
}

describe("readAttachState", () => {
  it("defaults to detached", () => {
    expect(readAttachState(contextWithEntries([]))).toBe(false);
  });

  it("honors the most recent attach entry", () => {
    const ctx = contextWithEntries([
      {
        type: "custom",
        customType: ATTACH_ENTRY_TYPE,
        data: { attached: true, tools: ["search_repos"] },
      },
      { type: "message" },
      {
        type: "custom",
        customType: ATTACH_ENTRY_TYPE,
        data: { attached: false, tools: ["search_repos"] },
      },
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

describe("setAttachState", () => {
  it.each([true, false])("snapshots the affected tools when attached is %s", (attached) => {
    const { pi, getEntries } = fakePi(["read"]);

    setAttachState(pi, attached);

    expect(getEntries()).toEqual([
      {
        customType: ATTACH_ENTRY_TYPE,
        data: { attached, tools: ATTACHABLE_TOOL_NAMES },
      },
    ]);
  });
});

describe("renderAttachEntry", () => {
  it("keeps the compact attached line when expanded and reveals snapshotted tools", () => {
    const data = { attached: true, tools: ["search_repos", "search_code"] };

    expect(render(data)).toEqual(["Librarian tools attached"]);
    expect(render(data, true)).toEqual([
      "Librarian tools attached",
      "  search_repos",
      "  search_code",
    ]);
  });

  it("renders detached entries with their historical tool snapshot", () => {
    expect(render({ attached: false, tools: ["checkout_repo"] }, true)).toEqual([
      "Librarian tools detached",
      "  checkout_repo",
    ]);
  });

  it("renders entries without the current shape generically", () => {
    expect(render({ attached: true }, true)).toEqual(["Librarian attach state unavailable"]);
  });

  it.each([
    { attached: "yes" },
    { attached: true, tools: [42] },
  ])("renders malformed entries without throwing", (data) => {
    expect(render(data, true)).toEqual(["Librarian attach state unavailable"]);
  });
});
