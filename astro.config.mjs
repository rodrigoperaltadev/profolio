import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// Server output + the Node adapter (standalone mode) are required starting
// with the admin authoring UI: `/admin/**` routes need a real request/
// response cycle (auth-gated form POSTs), which static output cannot serve.
// Every other route opts back into static generation individually via
// `export const prerender = true` — see design.md's Architecture Decisions,
// "Public pages needing `prerender = true`".
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  // Required for the legacy `defineCollection({ type: "content", schema })`
  // API (src/content.config.ts) to actually wire into Astro's content store.
  // Without this, `store.hasCollection()` always returns false and
  // `getCollection()` silently returns `[]` for both valid and malformed
  // content (console.warn only, no error) — found post-merge by sdd-verify;
  // see design.md's Architecture Decisions, "Legacy collections flag".
  legacy: { collectionsBackwardsCompat: true },
});
