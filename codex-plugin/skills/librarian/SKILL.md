---
name: librarian
description: "Research code and documentation outside this workspace through a librarian subagent: repositories on GitHub, GitLab, Bitbucket, or Sourcegraph, public open-source code, issues and pull requests, and the web. Use it for deep, multi-step research across repositories; for one file or reference, cheaper means usually suffice."
---

# Librarian

The librarian is a subagent with research tools only it uses. Hand it one self-contained question with everything you already know, wait for it, and relay its cited findings. Do not run its research commands yourself.

Spawn it with `spawn_agent` and `fork_turns: "none"`, since it needs only the question:

- When a `librarian` agent type is available, spawn that, with the question as the message.
- Otherwise spawn the default agent type with this message, giving the absolute path of `references/librarian-prompt.md` beside this file:

  ```text
  Read <absolute path to references/librarian-prompt.md> and follow it as your instructions. Then answer this question: <question>
  ```
