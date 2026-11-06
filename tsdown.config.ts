import { defineConfig } from "tsdown";
import packageJson from "./package.json" with { type: "json" };

// The CLI runs under npx without pi's peers, so typebox, which the core validates with at runtime,
// is inlined here and nowhere else. Every other import must stay a runtime dependency:
// playwright-core resolves its own files from its install directory and breaks when bundled.
export default defineConfig({
  entry: {
    librarian: "src/cli/librarian.ts",
    "fetch-worker": "src/core/web/fetchers/local/fetch-worker.ts",
  },
  outDir: "dist/cli",
  platform: "node",
  format: "esm",
  fixedExtension: false,
  dts: false,
  deps: {
    alwaysBundle: [/^typebox(\/|$)/],
    onlyImport: Object.keys(packageJson.dependencies),
  },
});
