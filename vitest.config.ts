import { defineConfig } from "vitest/config";

// DEVIATION from design.md: design.md's File Changes table specifies
// `getViteConfig()` (Astro's Vitest helper) for this file. That helper reads
// `astro.config.mjs`, which does not exist yet — Astro itself is not
// installed or scaffolded in this repo (see openspec issue #1, this is the
// first build step). Using it here would throw at config-load time. Falling
// back to plain Vitest `defineConfig` instead; revisit once the Astro
// scaffold change lands and swap this for `getViteConfig()` per design.
export default defineConfig({
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
