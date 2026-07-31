# Design: Profile Setup Wizard — First-Class Identity Content + Export/Import

## Technical Approach

`profile` gets the same `defineCollection`+Zod treatment as `posts`/`projects` (fixed slug `"me"` enforced only at the write/read call sites), a dedicated `getProfile()` accessor outside `ContentEntry`, and three widened touch points (`Collection`, `parseCollectionParam`, `admin/index.astro`). The first-run check is a pure predicate in `src/config/**` called from `src/middleware.ts` after the existing auth-gate branch. Export/import reuse `buildMarkdownFile()`/`parseFrontmatter()` end-to-end; import needs one new module because no raw-markdown-text parser exists in this codebase today — only a test-only reverse parser in `frontmatter.test.ts`, never shipped.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| `parseFrontmatter()` widening | Extend the existing `collection === "posts" ? ... : ...` into an `if/else if/else` chain, still one `parseEntry()` call per branch | `Record<Collection, ZodObject>` lookup | Preserves the documented `exactOptionalPropertyTypes` workaround (per-branch type inference); a lookup table was already rejected for this reason |
| Frontmatter serializer widening | Add an `isLinkArray()`/`serializeLinkArray()` branch to `frontmatter.ts` emitting a nested block sequence (`- label: "..."\n  url: "..."`) | Flatten `links` into two parallel string arrays | Keeps `Profile`'s shape faithful to the locked `{label,url}[]` schema; parallel arrays would silently decouple label/url pairing |
| Import parsing | New `parseFrontmatterBlock()` module (production-grade, promoted from the test-only reverse parser), scoped to exactly the grammar `buildMarkdownFile()` emits — not arbitrary YAML | Add the `yaml` npm package (already a transitive dependency) for import only | Preserves this repo's explicit zero-new-YAML-dependency precedent; import only ever needs to reverse this app's own deterministic output, not general YAML — accepted limitation: hand-edited exports may fail import, disclosed in upload copy |
| `admin/index.astro` profile touch point | Add a separate profile summary block (calls `getProfile()` directly, renders a setup/edit link) alongside, not inside, the existing `groups: CollectionGroup[]`/`CollectionSection` loop | Push a third `CollectionGroup` entry with profile mapped through `toContentEntry()` | `CollectionSection` is hard-coded to `ContentEntry` and `/admin/{collection}/{slug}/edit` routing; either would violate the exemption. This still gives the page a first-class profile entry point |
| `parseCollectionParam` widening | Accept `"profile"` for parity with the widened `Collection` union, even though profile's own routes never call it | Leave it at two values | Prevents the validator drifting silently out of sync with the type it exists to validate — the exact "partial widening" risk flagged in the proposal |
| First-run check split | Pure `isFirstRunExemptPath()`/`shouldRedirectToProfileSetup(profileExists)` in `src/config/admin-first-run.ts`; `middleware.ts` only calls `getProfile()` and redirects | Inline branching in `middleware.ts` | Matches the existing `checkAdminAuth()` split — middleware stays thin and un-unit-testable-by-design, logic stays pure |
| `links` form input | One `<textarea>`, one `label \| url` pair per line, parsed server-side | Dynamic add-row JS | No client JS framework allowed; mirrors the existing comma-list-to-array precedent (`splitCommaList`) with one extra delimiter |
| Reset | New `POST /admin/api/profile/reset` calling `edit()` with all fields blanked | Reuse the edit endpoint with a hidden flag | Mirrors `delete.ts`'s existing precedent of a dedicated endpoint wrapping a specific `edit()` shape |

## Data Flow

    GET /admin/**  →  checkAdminAuth()  →  allowed? ──no──▶ existing redirect/401
                                              │yes
                                              ▼
                          GET & not /admin/profile/setup? ──no──▶ next()
                                              │yes
                                              ▼
                                        getProfile()
                                              │
                              exists? ──no──▶ redirect /admin/profile/setup (303)
                                              │yes
                                              ▼
                                            next()

    Import:  <input type="file"> ─▶ request.formData() ─▶ file.text()
             ─▶ parseFrontmatterBlock() ─▶ {frontmatter, body}
             ─▶ parseFrontmatter("profile", frontmatter)  [existing Zod gate]
             ─▶ ContentWriter.create()/edit()

## File Changes

| File | Action | Description |
|---|---|---|
| `src/content/schemas.ts` | Modify | Add `profileSchema` |
| `src/content.config.ts` | Modify | Register `profile` |
| `src/content/profile.ts` | New | `Profile` type, `PROFILE_SLUG = "me"`, `getProfile(): Promise<Profile \| undefined>` |
| `src/publishing/content-writer.ts` | Modify | `Collection = "posts" \| "projects" \| "profile"` |
| `src/publishing/parse-frontmatter.ts` | Modify | Add `profileSchema` branch |
| `src/publishing/frontmatter.ts` | Modify | Add link-array serialization branch |
| `src/publishing/parse-frontmatter-block.ts` | New | Promote+extend `frontmatter.test.ts`'s reverse parser for import |
| `src/pages/admin/_lib/collection-param.ts` | Modify | Accept `"profile"` |
| `src/pages/admin/index.astro` | Modify | Add profile summary block |
| `src/config/admin-first-run.ts` | New | `isFirstRunExemptPath()`, `shouldRedirectToProfileSetup()` |
| `src/middleware.ts` | Modify | Call first-run check after auth gate |
| `src/pages/admin/profile/setup.astro`, `edit.astro` | New | Fixed-slug forms, no `[slug]` param |
| `src/pages/admin/_lib/profile-form-fields.ts` | New | Parses `links` textarea into `{label,url}[]` |
| `src/pages/admin/api/profile/{create,edit,reset,export,import}.ts` | New | POST/GET handlers, hardcoded slug `"me"` |
| `openspec/specs/{content-schema,content-view-contract,content-publishing,admin-authoring}/spec.md` | Modify | Deltas per proposal |
| `openspec/specs/{profile-identity,profile-portability}/spec.md` | New | Per proposal |
| `scripts/verify-admin-server.mjs` | Modify | Add first-run redirect proofs |

## Interfaces / Contracts

```ts
export const profileSchema = z.object({
  name: z.string(),
  role: z.string(),
  bio: z.string(),
  email: z.string(),
  links: z.array(z.object({ label: z.string(), url: z.url() })).default([]),
});

export function getProfile(): Promise<Profile | undefined>; // mirrors getEntry(): undefined, never throws
export function isFirstRunExemptPath(pathname: string): boolean;
export function shouldRedirectToProfileSetup(profileExists: boolean): boolean;
```

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `profileSchema` valid/invalid, `links` shape | Vitest, mirrors `content-schema` |
| Unit | `getProfile()` found/not-found | Vitest via `getViteConfig()`, mock `astro:content`'s `getEntry` |
| Unit | `isFirstRunExemptPath`/`shouldRedirectToProfileSetup` | Pure, plain values |
| Unit | Serializer/parser round trip for `links` | Extend `frontmatter.test.ts` pattern |
| Unit | `profile-form-fields.ts` textarea parsing | Vitest |
| Build-time | Middleware redirect fires end-to-end, both modes | Extend `verify-admin-server.mjs` with `proveFirstRunRedirect*()` |
| Build-time | Export/import round-trips through real `astro build` | New assertions in `verify-frontmatter-round-trip.mjs` or a sibling script |

## Migration / Rollout

No data migration. Every fresh clone (and every existing clone with no `src/content/profile/me.md`) hits the first-run redirect on its very next `/admin` visit — this is now the default first thing any operator sees, in both modes. README's Vision/quickstart section should be updated to mention the wizard explicitly (tracked in tasks, not this design).

## Open Questions

- [ ] Exact `links` textarea delimiter (`|` assumed) — confirm during `sdd-tasks` if a different separator is preferred for README/UX copy consistency.
