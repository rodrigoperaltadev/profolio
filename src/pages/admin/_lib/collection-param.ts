// Validates the `[collection]` dynamic route param against the two
// registered collections — the one place this admin surface enumerates them
// by name, matching `to-content-entry.ts`'s own `mappers` dispatch table
// precedent (see design.md's Architecture Decisions).
//
// Return type is deliberately narrowed to exclude "profile": `Collection`
// widened to include it in Phase 1 (profile-wizard), but this param parser
// itself isn't widened until Phase 2 (see tasks.md's task 2.2) — narrowing
// here keeps that phase boundary real instead of just a documentation claim.
import type { Collection } from "../../../publishing/content-writer";

type PostsOrProjects = Exclude<Collection, "profile">;

export function parseCollectionParam(value: string | undefined): PostsOrProjects | null {
  return value === "posts" || value === "projects" ? value : null;
}
