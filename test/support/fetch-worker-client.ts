// One harness session's fetch: run as its own process, so concurrent copies race for the spawn lock
// the way separate pi, Claude, and Codex sessions do.
import { createFetchWorkerClient } from "../../src/core/web/fetchers/local/worker-connection.ts";

const [executablePath = "", profileDir = "", downloadDir = ""] = process.argv.slice(2);
const client = createFetchWorkerClient(() => ({
  browser: { executablePath, profileDir },
  challenge: { escalation: "never", headlessWaitSecs: 1, headedWaitSecs: 1 },
}));

try {
  await client.fetch("https://example.com", downloadDir);
  console.log("answered: result");
} catch (error) {
  console.log(`answered: ${error instanceof Error ? error.message : String(error)}`);
}
