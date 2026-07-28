// Validates the `[collection]` dynamic route param against the two
// registered collections — the one place this admin surface enumerates them
// by name, matching `to-content-entry.ts`'s own `mappers` dispatch table
// precedent (see design.md's Architecture Decisions).
import type { Collection } from "../../../publishing/content-writer";

export function parseCollectionParam(value: string | undefined): Collection | null {
  return value === "posts" || value === "projects" ? value : null;
}
