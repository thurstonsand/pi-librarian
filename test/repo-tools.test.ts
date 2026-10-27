import { describe, expect, it } from "vitest";
import { resolveLibrarianSettings } from "../extensions/librarian/settings.ts";
import { createRepoClients, createRepoTools } from "../extensions/librarian/tools/index.ts";

function toolDescriptions(): Map<string, string> {
  const settings = resolveLibrarianSettings(
    {
      builtInSources: { github: false },
      sources: [
        {
          name: "example-gl",
          url: "https://gitlab.example.com",
          kind: "gitlab",
          description: "Holds the services not yet migrated to example-bb.",
        },
        { name: "other-gl", url: "https://gitlab.other.example.com", kind: "gitlab" },
        {
          name: "example-sg",
          url: "https://search.example.com",
          kind: "sourcegraph",
          description: "Indexes none of example-gl.",
        },
      ],
    },
    { GITLAB_ACCESS_TOKEN: "gl", SRC_ACCESS_TOKEN: "sg" },
  );
  const { tools } = createRepoTools(
    settings,
    createRepoClients(settings, async () => undefined),
  );
  return new Map(tools.map((tool) => [tool.name, tool.description]));
}

describe("source notes", () => {
  it("end the description of every tool that reaches a described source, and no other", () => {
    const descriptions = toolDescriptions();
    const gitlabNote =
      "\n\nNotes on its sources:\n- example-gl: Holds the services not yet migrated to example-bb.";
    const sourcegraphNote = "\n\nNotes on its sources:\n- example-sg: Indexes none of example-gl.";

    for (const name of [
      "search_code_gitlab",
      "search_repos_gitlab",
      "read_file",
      "checkout_repo",
    ]) {
      expect(descriptions.get(name)?.endsWith(gitlabNote), name).toBe(true);
    }
    for (const name of ["search_code_sourcegraph", "find_definition", "search_repos_sourcegraph"]) {
      expect(descriptions.get(name)?.endsWith(sourcegraphNote), name).toBe(true);
    }
    expect(descriptions.get("search_code_grepapp")).not.toContain("Notes on its sources");
    expect(descriptions.get("search_code_gitlab")).not.toContain("other-gl:");
  });
});
