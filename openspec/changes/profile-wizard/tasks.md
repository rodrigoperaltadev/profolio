# Tasks: Profile Setup Wizard — First-Class Identity Content + Export/Import

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900-1300 (per proposal's own estimate — widest surface so far: content schema, publishing port, admin routing enumeration, middleware, and one wholly new capability) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 → PR3 → PR4 → PR5 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Note on the phase-count decision:** the proposal explicitly calls for MORE aggressive chaining than admin-ui's (#5) prior-widest 4-unit split, given this change's wider blast radius (content schema + publishing port + admin routing + middleware + a new capability, touching 4 already-shipped spec contracts at once). Bottom-up from design's File Changes table, two of admin-ui's own precedents repeat here at larger scale: (a) admin-ui split "auth gate + middleware" from "UI pages" into separate units because bundling them exceeded budget — the same split applies here between first-run-redirect wiring and the actual setup/edit/reset UI; (b) this change additionally introduces a genuinely new, non-trivial parsing module (`parseFrontmatterBlock()`, scoped-grammar reverse parser) that design itself flags as needing isolated verification — large and risky enough to warrant its own unit rather than riding along with the export/import routes that consume it. That yields **5 units**, one more than admin-ui's 4.

### Suggested Work Units

Tracker branch `feature/profile-wizard` (draft, no-merge until all children land). Cascade: PR5 → PR4 branch → PR3 branch → PR2 branch → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | Profile content foundation: schema, `getProfile()`, `Collection` widening, frontmatter serialize/parse branches | `feat/profile-content-foundation` (base: tracker) | ~280-320 | Pure content/publishing-layer work, no UI; matches proposal's slice 1 |
| 2 | Admin routing widening + first-run redirect wiring | `feat/profile-first-run-redirect` (base: PR1) | ~220-260 | Highest UX/regression risk — fires on every `/admin/**` visit; no CRUD UI yet, mirrors admin-ui's auth-gate-before-pages split |
| 3 | Profile setup/edit/reset UI + CRUD endpoints | `feat/profile-crud-ui` (base: PR2) | ~260-300 | The actual authoring surface; depends on Units 1-2 existing |
| 4 | `parseFrontmatterBlock()` import parser module | `feat/profile-import-parser` (base: PR3) | ~150-200 | New, genuinely risky module — isolated for focused review, per design's own flag |
| 5 | Export/import routes + wiring | `feat/profile-export-import` (base: PR4) | ~180-220 | The new capability's user-facing surface; depends on Unit 4's parser and Unit 3's UI |

## Phase 1: Profile Content Foundation (Unit 1 — satisfies Profile Fields, Fixed Slug Singleton Convention, Dedicated Profile Read Accessor, ContentWriter Port Contract [profile], Profile Collection Schema Shape, Profile Is Exempt from the Shared Entry Contract)

- [x] 1.1 RED: `src/content/schemas.test.ts` — `profileSchema` valid entry (name/role/bio/email/links); rejects bare-string `links`; rejects missing `name`/`email`
- [x] 1.2 GREEN: add `profileSchema` to `src/content/schemas.ts` (per design's Interfaces/Contracts — no cardinality constraint, no avatar field)
- [x] 1.3 Register `profile` via `defineCollection` in `src/content.config.ts`, alongside `posts`/`projects`
- [x] 1.4 RED: `src/content/profile.test.ts` — `getProfile()` found branch (mock `astro:content`'s `getEntry`) returns typed `Profile`; not-found branch returns absence, never throws
- [x] 1.5 GREEN: create `src/content/profile.ts` — `Profile` type, `PROFILE_SLUG = "me"`, `getProfile()`; confirm `to-content-entry.ts`'s mapper table is left untouched (exemption enforced by omission)
- [x] 1.6 Widen `Collection` in `src/publishing/content-writer.ts` to `"posts" | "projects" | "profile"`; run `npm run typecheck` to surface any exhaustiveness-switch fallout
- [x] 1.7 RED: extend `src/publishing/parse-frontmatter.ts`'s test coverage (dedicated `parse-frontmatter.test.ts` or the existing adapter suites it's exercised through) with a `profile` branch case: valid links array parses; still one `parseEntry()` call per branch
- [x] 1.8 GREEN: extend `parse-frontmatter.ts`'s `collection === "posts" ? ... : ...` into an `if/else if/else` chain adding the `profile` branch — preserve the per-branch `exactOptionalPropertyTypes` type-inference workaround (do NOT switch to a lookup table)
- [x] 1.9 RED: `src/publishing/frontmatter.test.ts` — `isLinkArray()`/link-array serialization emits the nested block form (`- label: "..."\n  url: "..."`); round-trips self-consistently
- [x] 1.10 GREEN: add the link-array serialization branch to `frontmatter.ts`'s `buildMarkdownFile()` (new `isLinkArray()`/`serializeLinkArray()` helpers, nested block sequence — not parallel string arrays)
- [x] 1.11 **Real-consumer verification (carry-forward, mandatory — do not trust the Vitest round-trip alone):** extend `scripts/verify-frontmatter-round-trip.mjs` (or add an equivalent real-build assertion) to write a real `profile` file via the adapter, run a real `astro build`, and confirm Astro's real `getEntry`/`getCollection` parses the nested `links` array back correctly — actually run it, not author-and-assume
- [x] 1.12 Verify: `npm run test` (coverage ≥80% all metrics), `npm run typecheck`, `npm run lint`, `npm run build` all exit 0
- [x] 1.13 Commit as one work unit; open PR1 → tracker branch `feature/profile-wizard`

## Phase 2: Admin Routing Widening + First-Run Redirect (Unit 2 — satisfies First-Run Profile Redirect [Both Publishing Modes], Build/Deploy Detection Lag Disclosure)

- [x] 2.1 RED: `src/pages/admin/_lib/collection-param.test.ts` — `parseCollectionParam` accepts `"profile"`
- [x] 2.2 GREEN: widen `collection-param.ts` to accept `"profile"` alongside the existing two values
- [x] 2.3 RED: `src/config/admin-first-run.test.ts` — `isFirstRunExemptPath()` true for `/admin/profile/setup` and login paths, false otherwise; `shouldRedirectToProfileSetup(profileExists)` true/false — pure, plain-value tests
- [x] 2.4 GREEN: create `src/config/admin-first-run.ts` — `isFirstRunExemptPath()`, `shouldRedirectToProfileSetup()`, per design's Interfaces/Contracts
- [x] 2.5 Wire `src/middleware.ts`: after the existing `checkAdminAuth()` branch passes, for GET requests where `isFirstRunExemptPath()` is false, call `getProfile()` and redirect 303 to `/admin/profile/setup` when `shouldRedirectToProfileSetup()` is true (no dedicated unit test, same precedent as the existing auth-gate wiring — proven by 2.8's real-server script)
- [x] 2.6 Modify `src/pages/admin/index.astro`: add a separate profile summary block calling `getProfile()` directly, rendering a setup/edit entry point — alongside, not inside, the existing `groups`/`CollectionSection` loop
- [x] 2.7 **Cross-check task (mandatory, carry-forward):** inspect `Collection` (1.6), `parseCollectionParam` (2.2), and `admin/index.astro`'s `groups` enumeration + new profile block (2.6) together — confirm all three touch points recognize/handle `"profile"` consistently and no partial widening slipped through; note the result in the PR description
- [x] 2.8 **Real-server verification (carry-forward, mandatory — both modes):** extend `scripts/verify-admin-server.mjs` with `proveFirstRunRedirect*()` — (a) fresh state, no profile: GET to an arbitrary `/admin/**` path (not only `/admin` itself) redirects to setup, in full mode after auth passes; (b) after profile creation/seeding: redirect stops firing, edit entry point reachable; (c) local-fallback mode: redirect fires unconditionally with no login event involved — actually run it, not author-and-assume
- [x] 2.9 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint` all exit 0; boundaries hold
- [x] 2.10 Commit as one work unit; open PR2 → PR1 branch

## Phase 3: Profile Setup/Edit/Reset UI + CRUD Endpoints (Unit 3 — satisfies Profile Setup and Edit UI, Profile Setup and Edit Routes, Reset via Edit [No New Port Method])

- [x] 3.1 **Resolve the `links` textarea delimiter (carry-forward, decide now, do not leave open):** use `|` — one `label | url` pair per line (e.g. `GitHub | https://github.com/x`), confirming design's assumption; document this in the field's help text
- [x] 3.2 RED: `src/pages/admin/_lib/profile-form-fields.test.ts` — parses the `links` textarea per 3.1's delimiter into `{label,url}[]`; blank/empty lines ignored; malformed lines (missing `|`) dropped or reported, not crashing
- [x] 3.3 GREEN: create `src/pages/admin/_lib/profile-form-fields.ts` (mirrors `form-fields.ts`'s `splitCommaList` precedent with the extra delimiter)
- [x] 3.4 Create `src/pages/admin/profile/setup.astro` — native `<form method="POST">`, shown when no profile exists
- [x] 3.5 Create `src/pages/admin/profile/edit.astro` — native form pre-populated with current values, shown once a profile exists; includes the reset action
- [x] 3.6 Create `src/pages/admin/api/profile/create.ts` — POST handler, `createContentWriter().create({collection:"profile", slug:"me", ...})`; validation-before-write; re-renders with error on schema failure, no write attempted
- [x] 3.7 Create `src/pages/admin/api/profile/edit.ts` — POST handler, `.edit()`; deploy-lag disclosure copy in GitHub mode vs. existing "saved to disk, commit" reminder in local-fallback mode
- [x] 3.8 Create `src/pages/admin/api/profile/reset.ts` — POST handler, `.edit()` with all fields blanked; confirm no new `ContentWriter` port method is introduced
- [x] 3.9 Verify: manual smoke test via `astro dev` (local-fallback mode) — full setup → edit → reset cycle; confirm the commit reminder appears and the first-run redirect (Unit 2) stops firing after setup
- [x] 3.10 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint`, `npm run build` all exit 0
- [x] 3.11 Commit as one work unit; open PR3 → PR2 branch

## Phase 4: `parseFrontmatterBlock()` Import Parser Module (Unit 4 — satisfies groundwork for Import Runs Through the Same Validation-Before-Write Path)

- [x] 4.1 RED: `src/publishing/parse-frontmatter-block.test.ts` — promote and extend `frontmatter.test.ts`'s existing test-only reverse parser: parses a real `buildMarkdownFile()`-produced string (frontmatter + body, including the nested `links` block from 1.10) back into `{frontmatter, body}`; a genuinely malformed/hand-edited string returns a clean error result, never throws
- [x] 4.2 GREEN: create `src/publishing/parse-frontmatter-block.ts` — `parseFrontmatterBlock()`, scoped strictly to this app's own grammar (no new `yaml` npm dependency)
- [x] 4.3 **Real round-trip verification (carry-forward, mandatory — not synthetic fixtures only):** build a real `Profile`, run it through `buildMarkdownFile()` → `parseFrontmatterBlock()` → `parseFrontmatter("profile", ...)`, confirm the result matches the original data including `links`; separately feed a hand-edited/malformed string and confirm rejection without corrupting any existing profile state
- [x] 4.4 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint` all exit 0
- [x] 4.5 Commit as one work unit; open PR4 → PR3 branch

## Phase 5: Export/Import Routes + Wiring (Unit 5 — satisfies Export Reuses the Existing Build Pipeline, Import Runs Through the Same Validation-Before-Write Path as a Normal Edit, Import Inherits No New Port Capability, Profile Export and Import Routes)

- [x] 5.1 Create `src/pages/admin/api/profile/export.ts` — authenticated GET handler, returns `buildMarkdownFile()`'s output for the current profile as a downloadable file (byte-identical to a normal edit's write)
- [x] 5.2 Create `src/pages/admin/api/profile/import.ts` — POST handler (file upload): `request.formData()` → `file.text()` → `parseFrontmatterBlock()` → `parseFrontmatter("profile", ...)` → `ContentWriter.create`/`.edit()`; invalid upload re-renders with a validation error, no write occurs
- [x] 5.3 Add export/import entry points to `src/pages/admin/profile/edit.astro` (download link + upload form)
- [x] 5.4 **Full-cycle real verification (carry-forward, continued from 4.3):** against a real running server/adapter, download via `export.ts`, re-upload the exact downloaded file via `import.ts`, confirm the resulting profile is identical to the original — proves the real export→re-import path, not just the parser in isolation
- [x] 5.5 Verify: extend `scripts/verify-admin-server.mjs` (or `verify-frontmatter-round-trip.mjs`) with an end-to-end export/import proof against the real build; actually run it
- [x] 5.6 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint`, `npm run build` all exit 0
- [x] 5.7 Commit as one work unit; open PR5 → PR4 branch (final child; cascades to tracker → main)

## Next Step

All 5 phases complete (46/46 tasks: 13+10+11+5+7). PR1-PR5 opened across the feature-branch-chain (tracker `feature/profile-wizard` → PR1 #61 → PR2 #62 → PR3 #63 → PR4 #64 → PR5 #65). sdd-verify passed (0 CRITICAL, 2 WARNING — both fixed: explicit `profile` guards added to the generic create/delete routes, this count corrected). Ready for merge-and-archive.
