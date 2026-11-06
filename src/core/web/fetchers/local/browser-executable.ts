import path from "node:path";

export interface BrowserExecutable {
  path: string;
  // Playwright's own Chromium, which is not on disk yet and must be downloaded before launch.
  needsInstall: boolean;
}

// Where Google Chrome's stable channel installs, as Playwright's own `channel: "chrome"` looks.
function chromePaths(platform: NodeJS.Platform, env: NodeJS.ProcessEnv): string[] {
  switch (platform) {
    case "darwin":
      return ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"];
    case "win32":
      return [env.LOCALAPPDATA, env.PROGRAMFILES, env["PROGRAMFILES(X86)"]].flatMap((root) =>
        root ? [path.win32.join(root, "Google", "Chrome", "Application", "chrome.exe")] : [],
      );
    default:
      return ["/opt/google/chrome/chrome"];
  }
}

function onPath(names: string[], env: NodeJS.ProcessEnv): string[] {
  const dirs = (env.PATH ?? "").split(path.delimiter).filter((dir) => dir.length > 0);
  return names.flatMap((name) => dirs.map((dir) => path.join(dir, name)));
}

// The configured browser, then Google Chrome, then a Chromium on PATH, then Playwright's Chromium,
// downloaded on first use when none of the others exists.
export function resolveBrowserExecutable(
  configured: string | undefined,
  playwrightChromium: string,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  exists: (file: string) => boolean,
): BrowserExecutable {
  if (configured) return { path: configured, needsInstall: false };
  const found = [...chromePaths(platform, env), ...onPath(["chromium", "chromium-browser"], env)]
    .filter((candidate) => exists(candidate))
    .at(0);
  if (found) return { path: found, needsInstall: false };
  return { path: playwrightChromium, needsInstall: !exists(playwrightChromium) };
}
