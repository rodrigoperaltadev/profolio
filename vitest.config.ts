/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// Resolves the documented deviation from repo-scaffold-ci-foundation:
// `astro.config.mjs` now exists (see openspec issue #3), so `getViteConfig()`
// can read it. This also merges Astro's own Vite plugins (including the
// content-collections virtual-module resolver), which is what makes
// `astro:content` importable from test files at all.
export default getViteConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
