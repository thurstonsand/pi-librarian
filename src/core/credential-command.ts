import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// Runs a command that prints one credential. Its errors name only the label: a subprocess error
// carries the command and its output, either of which may hold the credential.
export async function runCredentialCommand(
  command: string,
  label: string,
  signal: AbortSignal | undefined,
): Promise<string> {
  let value: string;
  try {
    const child = execAsync(command, {
      timeout: 30_000,
      maxBuffer: 64 * 1024,
      ...(signal ? { signal } : {}),
    });
    child.child.stdin?.end();
    value = (await child).stdout.trim();
  } catch {
    throw new Error(`${label} failed`);
  }
  if (!value || /\s/.test(value)) {
    throw new Error(`${label} must print a single nonempty value`);
  }
  return value;
}
