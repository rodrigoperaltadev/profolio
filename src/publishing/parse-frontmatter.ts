// Shared by `GithubContentWriterAdapter` and `FakeContentWriter` — both must
// validate frontmatter identically before writing (see the spec's
// "Validation Before Write" requirement and design.md's "Fake also
// validates" decision). Extracted to a dedicated module so both callers
// share one implementation instead of duplicating it (would otherwise trip
// `sonarjs/no-identical-functions`).
//
// Each ternary branch calls `parseEntry` with its own concrete schema, so TS
// infers `PostsOutput`/`ProjectsOutput` independently per branch instead of
// unifying them through a shared generic parameter (which
// `exactOptionalPropertyTypes` rejects for a `Record<Collection, ZodObject>`
// lookup — see apply-progress's Phase 3 deviation note). The validated data
// is widened to `Record<string, unknown>` only after validation succeeds.
import { postsSchema, profileSchema, projectsSchema } from "../content/schemas";
import { parseEntry, type ParseResult } from "../content/validate-entry";
import type { Collection } from "./content-writer";

export function parseFrontmatter(
  collection: Collection,
  frontmatter: Record<string, unknown>,
): ParseResult<Record<string, unknown>> {
  // if/else if/else (not a `Record<Collection, ZodObject>` lookup table) —
  // each branch's own `parseEntry()` call lets TS infer that branch's
  // concrete output type independently, which is what makes this compile
  // under `exactOptionalPropertyTypes` (see design.md's Architecture
  // Decisions: "parseFrontmatter() widening"; a lookup table was already
  // rejected for this reason).
  let result;
  if (collection === "posts") {
    result = parseEntry(postsSchema, frontmatter);
  } else if (collection === "projects") {
    result = parseEntry(projectsSchema, frontmatter);
  } else {
    result = parseEntry(profileSchema, frontmatter);
  }
  return result.ok ? { ok: true, data: result.data } : result;
}
