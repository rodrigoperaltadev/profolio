// Declarative only, near-zero branches — intentionally not relied on to
// carry the 80% coverage bar (see design.md's Testing Strategy).
//
// DEVIATION from design.md's File Changes: Astro 7 requires this file at
// `src/content.config.ts` (sibling to `src/content/`), not
// `src/content/config.ts` as design.md listed. Placing it at the
// design-specified path throws `LegacyContentConfigError` at startup — the
// legacy `type: "content"` shape design.md chose is still valid, only the
// file location changed. See apply-progress for the full gotcha writeup.
import { defineCollection } from "astro:content";
import { postsSchema, projectsSchema } from "./content/schemas";

export const collections = {
  posts: defineCollection({ type: "content", schema: postsSchema }),
  projects: defineCollection({ type: "content", schema: projectsSchema }),
};
