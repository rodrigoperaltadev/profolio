// Validates the `[collection]` dynamic route param against the registered
// collections — the one place this admin surface enumerates them by name,
// matching `to-content-entry.ts`'s own `mappers` dispatch table precedent
// (see design.md's Architecture Decisions).
//
// Widened to accept "profile" for parity with `Collection` (see design.md's
// "`parseCollectionParam` widening" decision): profile's own dedicated
// setup/edit/reset/export/import routes (Phase 3+) never call this parser —
// they hardcode `collection: "profile", slug: "me"` — but leaving it at two
// values would let it silently drift out of sync with the type it exists to
// validate, the exact "partial widening" risk this change's proposal flagged.
// NOTE: this does not, by itself, let the generic `/admin/api/[collection]/
// create` route produce a valid profile entry — `frontmatterFromFormData()`
// has no "profile" case, so it can never assemble a schema-valid profile
// frontmatter, and `ContentWriter.create()`'s validation-before-write still
// rejects whatever it does produce.
import type { Collection } from "../../../publishing/content-writer";

export function parseCollectionParam(value: string | undefined): Collection | null {
  return value === "posts" || value === "projects" || value === "profile" ? value : null;
}
