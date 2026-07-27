import { defineConfig } from "astro/config";

// Minimal config: no integrations needed yet. Its purpose at this stage is to
// exist as a root config file so `astro:content` resolves and Vitest's
// `getViteConfig()` (see vitest.config.ts) can read it. Integrations land as
// later changes introduce them (e.g. the presentation layer).
export default defineConfig({});
