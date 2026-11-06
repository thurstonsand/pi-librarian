import { describe, expect, it } from "vitest";
import { resolveBrowserExecutable } from "../src/core/web/fetchers/local/browser-executable.ts";

const PLAYWRIGHT = "/home/u/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome";
const CHROME = "/opt/google/chrome/chrome";
const PATH_CHROMIUM = "/usr/bin/chromium";
const env = { PATH: "/usr/local/bin:/usr/bin" };

function resolve(configured: string | undefined, present: string[]) {
  return resolveBrowserExecutable(configured, PLAYWRIGHT, "linux", env, (file) =>
    present.includes(file),
  );
}

describe("resolveBrowserExecutable", () => {
  it("prefers the configured browser, then Chrome, then a chromium on PATH", () => {
    const everything = [CHROME, PATH_CHROMIUM, PLAYWRIGHT];
    expect(resolve("/custom/chrome", everything)).toEqual({
      path: "/custom/chrome",
      needsInstall: false,
    });
    expect(resolve(undefined, everything)).toEqual({ path: CHROME, needsInstall: false });
    expect(resolve(undefined, [PATH_CHROMIUM, PLAYWRIGHT])).toEqual({
      path: PATH_CHROMIUM,
      needsInstall: false,
    });
  });

  it("falls back to Playwright's Chromium, installing it only when it is missing", () => {
    expect(resolve(undefined, [PLAYWRIGHT])).toEqual({ path: PLAYWRIGHT, needsInstall: false });
    expect(resolve(undefined, [])).toEqual({ path: PLAYWRIGHT, needsInstall: true });
  });

  it("finds Chrome where it installs on macOS and Windows", () => {
    const mac = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    expect(resolveBrowserExecutable(undefined, PLAYWRIGHT, "darwin", {}, (f) => f === mac)).toEqual(
      { path: mac, needsInstall: false },
    );
    const windows = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    expect(
      resolveBrowserExecutable(
        undefined,
        PLAYWRIGHT,
        "win32",
        { PROGRAMFILES: "C:\\Program Files" },
        (f) => f === windows,
      ),
    ).toEqual({ path: windows, needsInstall: false });
  });
});
