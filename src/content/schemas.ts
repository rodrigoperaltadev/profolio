// Pure Zod, no `astro:content` import (directly unit-testable).
//
// `zod` is imported from the standalone package, NOT astro:content's
// re-export — this is what makes this module resolvable in Vitest without
// Astro's Vite plugin, which is the entire point of splitting schemas.ts
// out from config.ts (see design.md's Architecture Decisions:
// "Schema/config split").
import { z } from "zod";

export const postsSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  deleted: z.boolean().default(false),
});

export const projectsSchema = z.object({
  name: z.string(),
  stack: z.array(z.string()).default([]),
  link: z.url(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
  deleted: z.boolean().default(false),
});

// No cardinality constraint here by design — singleton-ness is enforced
// only by the write/read path always targeting the fixed slug "me", never
// at the schema level (see design.md's Architecture Decisions and the
// content-schema spec's "Profile Singleton Is Convention-Only" requirement).
export const profileSchema = z.object({
  name: z.string(),
  role: z.string(),
  bio: z.string(),
  email: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
});
