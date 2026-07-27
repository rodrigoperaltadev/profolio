import { defineConfig } from "astro/config";

// Minimal config: no integrations needed yet. Its purpose at this stage is to
// exist as a root config file so `astro:content` resolves and Vitest's
// `getViteConfig()` (see vitest.config.ts) can read it. Integrations land as
// later changes introduce them (e.g. the presentation layer).
export default defineConfig({
  // Required for the legacy `defineCollection({ type: "content", schema })`
  // API (src/content.config.ts) to actually wire into Astro's content store.
  // Without this, `store.hasCollection()` always returns false and
  // `getCollection()` silently returns `[]` for both valid and malformed
  // content (console.warn only, no error) — found post-merge by sdd-verify;
  // see design.md's Architecture Decisions, "Legacy collections flag".
  legacy: { collectionsBackwardsCompat: true },
});
