# Proposal: Profile Setup Wizard — First-Class Identity Content + Export/Import

Cross-references: GitHub #57 (this change, rewritten mid-session to reflect profolio's actual vision — see README's "Vision" section), #52 (public homepage rendering the profile, now explicitly depends on this change producing consumable profile data), #58 (theme distribution via npm packages, explicitly future/blocked on #54–#56, no coupling here), #3 (content-model-schema, archived — schemas/`getCollection`/mapper precedent this change extends), #4 (publishing-layer, archived — `ContentWriter`, validation-before-write, both adapters), #5/#8 (admin-ui/security-hardening, archived — `/admin/**` gate, session middleware, form patterns this change reuses).

## Intent

profolio's actual purpose, now stated plainly in the README's Vision section, is not "a themeable blog engine you configure" — it is: clone the repo, run the wizard, fill in *your own* profile, pick a theme, deploy, and end up with a real personal site, the way rodrigoperalta.ar exists today. Every prior change (schema, publishing, admin UI, theming, env wizard, security) built the machinery this vision depends on, but none of them actually let an operator become the site's *subject*. Today there is no way to author "who this site is about" at all — no schema, no admin surface, nothing. `/admin` lets you write posts and projects for a site that has no stated owner.

This is not "add a settings page." The profile is first-class identity content — closer to a living CV than a database record — and per #52's own rewritten dependency, it is likely the actual homepage content, not a secondary admin utility bolted onto the side. This change gives profolio the one piece of content every clone actually needs on day one: a guided way to create, edit, and reset that identity, plus a way to carry it across a re-clone (this project's only "upgrade" path, since there is no shared backend to migrate a profile through).

## Scope

### In Scope

- A new singleton `profile` Astro Content Collection (per exploration's recommendation, confirmed by the user): `name`, `role`/tagline, `bio` (text), `email`, and `links` (array of `{ label: string; url: string }` pairs — labeled, not bare URLs, so a future public rendering (#52) can show something meaningful like "GitHub"/"LinkedIn" rather than an unlabeled link; confirmed by the user over the simpler tags/stack-style bare-string-array precedent, specifically because this data is meant to be rendered publicly as a living CV, not just listed internally). No avatar/photo field — deliberately deferred, zero binary-upload precedent anywhere in this codebase.
- Singleton-ness enforced at the write/UI layer only, via a conventionally fixed slug (`me`), exactly as Astro Content Collections have no native "max one entry" constraint — this is a locked decision, not an open design question.
- `profile` widening `Collection` (`src/publishing/content-writer.ts`), `parseCollectionParam` (`src/pages/admin/_lib/collection-param.ts`), and the `groups` enumeration in `src/pages/admin/index.astro` — all three touch points identified during exploration, called out explicitly rather than discovered mid-apply.
- `profile` explicitly EXEMPTED from `ContentEntry`/`toContentEntry()` — read via its own dedicated type/accessor, not forced into the shared display-shape contract that `content-view-contract`'s spec already forbids collection-specific fields leaking into.
- A new admin section under existing `/admin/**` (same session-cookie gate from #8, same plain-HTML-form/no-framework precedent from #5) for creating and editing the profile.
- A first-run redirect: on any `/admin/**` visit, if no profile exists yet, the operator is told plainly ("no profile exists yet") and directed into the setup flow; once a profile exists, admin behaves normally with an edit-profile entry point. This must work in BOTH publishing modes — full mode (session-gated, check runs after the existing auth gate passes) and local-fallback mode (no gate today, so the check must fire on any `/admin/**` GET independent of any login event).
- "Wipe and start over" implemented as `edit()` resetting all fields to empty/default — no new hard-delete port method, preserving the no-hard-delete invariant locked in #4/#8.
- Export/import: the operator can download the current profile as a portable file from the admin UI, and upload that file on a fresh clone to restore it — since "upgrading" profolio means re-cloning, not migrating a shared backend, per the rewritten issue.
- An explicit, documented v1 limitation: in full/GitHub mode, `getCollection()` reflects the last build/deploy, not live git state, so a just-created/imported profile will not be reflected by the first-run check until redeploy. The wizard states this plainly ("saved — redeploy to see it reflected") rather than attempting a non-build-dependent existence check.

### Out of Scope

- Avatar/photo upload — deferred per locked decision; no binary-asset handling exists anywhere in this codebase today, and adding it here would be a second, unrelated new capability riding along with this one.
- The public homepage that renders the profile (#52) — this change writes and manages profile data; #52 consumes it. This change's only obligation toward #52 is that the data it produces is genuinely and simply consumable (a typed read accessor, not a UI-shaped side effect).
- Theme distribution via npm packages (#58) — explicitly future, blocked on #54–#56, zero technical coupling with this change.
- Solving the GitHub-mode build/deploy detection lag with a non-build-dependent existence check (e.g. a live git API read bypassing `getCollection()`) — accepted as a documented v1 limitation, not engineered around.
- URL-metadata fetching, link/email validation beyond basic string/format checks, or any enrichment of `links`/`email` — plain strings in, plain strings out.
- A new `ContentWriter` port method of any kind (read/exists, hard-delete, or otherwise) — reset uses the existing `edit()`; existence checks follow the existing `getCollection()`-direct-read precedent already used by `admin/index.astro`.

## Capabilities

### New Capabilities

- `profile-identity`: the singleton `profile` Content Collection, its Zod schema, its dedicated (non-`ContentEntry`) read accessor, and the admin setup/edit UI + first-run redirect that create, edit, and reset it via the existing `ContentWriter` port.
- `profile-portability`: export (download the current profile as a portable file) and import (upload that file on a fresh clone to restore it) — a genuinely new capability, not a variant of existing collection CRUD, and weighted accordingly in Risks below.

### Modified Capabilities

- `content-schema`: adds the `profile` collection (`defineCollection` + Zod schema in `src/content.config.ts`/`src/content/schemas.ts`), registered alongside `posts`/`projects`. Unlike those two, `profile` is a singleton by write/UI convention only, not by schema — this asymmetry is stated explicitly in the spec delta, not implied.
- `content-view-contract`: adds an explicit exemption requirement — `profile` MUST NOT be mapped through `toContentEntry()` or exposed via `ContentEntry`, closing the gap the current spec leaves implicit (it forbids collection-specific fields leaking into the shared type, but doesn't yet state that a collection can opt out of the shared type entirely).
- `content-publishing`: widens `Collection` from `"posts" | "projects"` to include `"profile"`. No change to the `ContentWriter` port shape itself (still just `create`/`edit`, still no `delete`).
- `admin-authoring`: adds the profile setup/edit routes, the first-run existence check and redirect (both publishing modes), and the export/import routes, all reusing the existing session gate, form-POST pattern, and typed-conflict-error surfacing.

## Approach

**Content model**: singleton `profile` Content Collection over a schema-less bypass file, per exploration's explicit rejection of the bypass — a fixed-path `profile.json`/`.md` read/written outside `ContentWriter` would duplicate the GitHub-vs-LocalFs unification that port exists to provide (validation-before-write, SHA-conflict handling, sanitized errors). `profile` gets the same `defineCollection` + Zod schema treatment as `posts`/`projects`, just with a fixed slug (`me`) enforced at the write layer: the admin write path always targets `collection: "profile", slug: "me"`, never accepting a slug from the caller.

**`ContentEntry` exemption, not a stretch**: `ContentEntry`'s shape (title/date/tags/draft/link/body) does not describe a profile, and `content-view-contract`'s own spec forbids widening that shared type with collection-specific fields. Rather than force-fitting `name`/`bio`/`links` into `title`/`body`/`tags`, `profile` gets a dedicated typed accessor (e.g. `getProfile()` wrapping a direct `getCollection("profile")`/fixed-slug read) that `src/presentation/**` — and eventually #52 — can import directly, alongside (not instead of) `ContentEntry`. This is the spec-level delta that makes the exemption an explicit, provable contract rather than an ad hoc omission.

**Widening the three hardcoded touch points is unavoidable and in-scope, not incidental**: `Collection` in `content-writer.ts`, `parseCollectionParam`, and `admin/index.astro`'s `groups` array all enumerate `"posts" | "projects"` by name today. Exploration confirmed this is true regardless of which content-model approach was chosen — `content-view-contract`'s "no view-layer changes for a third collection" guarantee only covers the mapper dispatch table, not these three. All three are listed in Affected Areas below as first-class, expected work, not side effects surfaced during apply.

**First-run redirect lives in `src/middleware.ts`, not per-page**: the middleware already runs on every `/admin/**` request regardless of mode (it's the same file that currently no-ops the gate check in local-fallback mode). Adding the profile-existence check there — after the existing auth-gate branch, for GET requests, excluding the setup page and login paths themselves — is the one place that naturally covers both modes without a second, mode-specific hook: in full mode it runs after a session is confirmed valid; in local-fallback mode it runs unconditionally since no gate exists to attach to. Design owns the exact check (cached per-request vs. re-read every time) and redirect target.

**Detection gap accepted, not engineered around** (unilateral call, confirmed against exploration finding #5): `getCollection()` in full/GitHub mode reflects the last build, not live git state. Rather than adding a live-git existence check (a new, undocumented capability with its own credential/rate-limit surface), the setup/edit success page states plainly that the change is saved but won't be reflected in the running app until the next build/deploy — consistent with the exact same disclosure pattern `admin-authoring` already uses for local-fallback's "saved to disk, remember to commit" reminder.

**Export/import format** (unilateral call, flagged for review below): export returns the profile's existing file body — the same frontmatter + Markdown shape every `create`/`edit` call already produces via `buildMarkdownFile()` — as a downloadable file from a GET admin route. Import is a file-upload form POST that runs the uploaded content through the exact same `parseFrontmatter()` → `parseEntry()` → `ContentWriter.create`/`edit()` pipeline as a normal edit, just with the frontmatter/body sourced from the uploaded file instead of a form. This adds zero new dependency and zero new file format — it reuses the byte-identical-output pipeline `LocalFsContentWriterAdapter`/`GithubContentWriterAdapter` already share, and gets validation-before-write for free rather than needing a separate import-time check.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/content/schemas.ts` | Modified | New `profileSchema` (name, role, bio, email, links) |
| `src/content.config.ts` | Modified | Registers `profile` via `defineCollection` alongside `posts`/`projects` |
| `src/content/profile.ts` (name indicative) | New | Dedicated `Profile` type + `getProfile()`/existence accessor — deliberately NOT `ContentEntry` |
| `src/content/_mappers/to-content-entry.ts` | Unmodified | `profile` intentionally absent from the `mappers` dispatch table — the exemption is enforced by omission |
| `src/publishing/content-writer.ts` | Modified | `Collection` widened to `"posts" \| "projects" \| "profile"` |
| `src/pages/admin/_lib/collection-param.ts` | Modified | Accepts `"profile"` alongside the existing two |
| `src/pages/admin/index.astro` | Modified | `groups` enumeration/first-run banner gains a profile entry point |
| `src/middleware.ts` | Modified | First-run profile-existence check + redirect, mode-agnostic hook point |
| `src/pages/admin/profile/setup.astro`, `src/pages/admin/profile/edit.astro` (names indicative) | New | Profile create/edit forms, fixed slug `"me"` |
| `src/pages/admin/api/profile/create.ts`, `.../edit.ts` (names indicative) | New | POST endpoints reusing `createContentWriter()`, hardcoded slug |
| `src/pages/admin/api/profile/export.ts`, `.../import.ts` (names indicative) | New | Download/upload endpoints for `profile-portability` |
| `openspec/specs/content-schema/spec.md` | Modified | Delta: `profile` schema + singleton-by-convention asymmetry documented |
| `openspec/specs/content-view-contract/spec.md` | Modified | Delta: explicit `ContentEntry` exemption requirement for `profile` |
| `openspec/specs/content-publishing/spec.md` | Modified | Delta: `Collection` union widened |
| `openspec/specs/admin-authoring/spec.md` | Modified | Delta: profile routes, first-run redirect (both modes), export/import routes |
| `openspec/specs/profile-identity/spec.md` | New | New capability spec |
| `openspec/specs/profile-portability/spec.md` | New | New capability spec |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| GitHub-mode build/deploy lag means a just-saved or just-imported profile doesn't clear the first-run redirect until the next deploy, reading as a broken loop ("I just created this, why is it asking again?") | Medium-High | Explicit, plainly-worded success-page copy states the save succeeded and redeploy is required to see it reflected — same disclosure pattern as the existing local-fallback "commit reminder"; not silently accepted as a UX gap |
| Widening `Collection`, `parseCollectionParam`, and `admin/index.astro`'s `groups` array touches three already-shipped, already-archived spec contracts (`content-publishing`, `admin-authoring`) simultaneously — higher chance of an inconsistent partial widening (e.g. one touch point updated, another missed) than any single-collection change so far | Medium | All three are enumerated explicitly in Affected Areas and Success Criteria, not left as an implicit consequence; `sdd-tasks` should generate one task per touch point with an explicit cross-check step |
| Singleton-by-convention (fixed slug `"me"`) is enforced only at the write/UI layer — a hand-edited or hand-added second file under `src/content/profile/` would be invisible to that convention and could silently produce inconsistent reads | Low-Medium | `getProfile()`'s existence/read accessor always targets the fixed slug directly (never enumerates the collection); documented as a known convention-only limit, not a schema-enforced guarantee |
| Import accepts a hand-edited or foreign file that happens to parse as valid frontmatter but contains stale/mismatched data, silently overwriting the current profile | Low-Medium | Import runs through the exact same `parseEntry()` validation-before-write path as every other write — invalid content is rejected before any write, exactly like a normal edit; no import-specific bypass |
| `ContentEntry` exemption is read as "profile doesn't need to be consumable," undermining #52's now-explicit dependency on this change's output | Low | `profile-identity`'s spec explicitly requires a typed, directly-importable read accessor as a first-class deliverable, not an afterthought; Success Criteria below makes this a checked item |
| This change touches the widest surface of any change so far (content schema, publishing port, admin routing, middleware, and a genuinely new export/import capability) — real risk of exceeding review capacity in one pass, more than any prior change | High | Review Workload Forecast below explicitly recommends MORE chaining than prior changes (e.g. #5's three-slice split), not less; flagged for the orchestrator's delivery-strategy decision before `sdd-apply`, not discovered mid-review |
| First-run redirect logic in `src/middleware.ts` (already a file with no ESLint `boundaries` element coverage, per its own documented gap) grows more branching without any mechanical layer-boundary check on it | Low-Medium | Existing precedent already keeps `middleware.ts` deliberately thin, delegating logic to pure, unit-tested functions in `src/config/**`; the profile-existence check follows the same split rather than growing inline in the middleware file itself |

## Rollback Plan

Revert `src/content/schemas.ts`, `src/content.config.ts`, `src/content/profile.ts`, the `Collection`/`parseCollectionParam`/`admin/index.astro` widenings, `src/middleware.ts`'s first-run check, and the new `src/pages/admin/profile/**` + `src/pages/admin/api/profile/**` routes via git. Remove the `profile-identity`/`profile-portability` spec capabilities and the four modified-spec deltas. No data migration: any `profile` content file written during testing is a plain markdown file under `src/content/profile/`, discardable independently of the code revert, exactly like any other content file. `posts`/`projects` schemas, `ContentWriter`, and existing admin routes are untouched by this change.

## Dependencies

- Depends on `content-schema`/`content-view-contract` (#3, archived) for the `defineCollection`/Zod/mapper precedent this change extends and the shared-type discipline this change explicitly carves an exemption into.
- Depends on `content-publishing` (#4, archived) for `ContentWriter`, validation-before-write, both adapters, and the no-hard-delete invariant that shapes this change's reset semantics.
- Depends on `admin-authoring` + `security-hardening` (#5/#8, archived) for the session gate, form-POST pattern, typed-conflict-error surfacing, and mode-dependent gate asymmetry the first-run redirect must coexist with.
- Enables #52 (public homepage): #52 is now explicitly blocked on this change's `getProfile()`/read-accessor output being real and consumable; this change does not build #52's rendering, only its data source.
- No coupling with #58 (theme npm distribution) — confirmed still blocked on #54–#56, unaffected by anything here.

## Success Criteria

- [ ] A singleton `profile` Content Collection exists (`defineCollection` + Zod schema), with `name`, `role`, `bio`, `email`, `links` fields, no avatar/photo field
- [ ] Singleton-ness is enforced by always writing/reading a fixed slug (`me`); no code path accepts an arbitrary profile slug from a caller
- [ ] `profile` is exempted from `ContentEntry`/`toContentEntry()`; a dedicated, directly-importable read accessor exists and is consumable outside `src/pages/admin/**`
- [ ] `Collection`, `parseCollectionParam`, and `admin/index.astro`'s `groups` enumeration all recognize `"profile"`
- [ ] `/admin/**` redirects to a setup flow when no profile exists, in BOTH full and local-fallback mode, with a clear "no profile exists yet" message
- [ ] Once a profile exists, admin behaves normally and exposes an edit-profile entry point; no further first-run redirect fires
- [ ] "Wipe and start over" resets all profile fields via `edit()`; no new `ContentWriter` port method is added
- [ ] The full/GitHub-mode build/deploy detection lag is disclosed explicitly in the UI copy at the point a save/import completes
- [ ] Export downloads the current profile as a file reusing the existing frontmatter+Markdown build pipeline; import runs an uploaded file through the same `parseEntry()`-before-write validation as any other edit
- [ ] Coverage gate holds at 80% under strict TDD for all new/modified code (this is the 9th real feature-code change under that gate)

## Review Workload Forecast

- Estimated changed lines: ~900-1300 (profile schema + tests, dedicated read accessor + tests, three-touch-point `Collection`/`parseCollectionParam`/`groups` widening + tests, `src/middleware.ts` first-run check + tests, profile setup/edit pages + POST endpoints + tests, export/import endpoints + tests, four modified spec deltas, two new spec docs). This is larger than #5 (admin-ui, ~600-900, the prior largest) — it is genuinely the widest-surface change so far: content schema, publishing port, admin routing enumeration, middleware, and one wholly new capability (export/import) all in one proposal.
- Chained PRs: Strongly recommended, more aggressively than any prior change. Suggested slices: (1) `profile` schema + `content-view-contract` exemption delta + `Collection` union widening — pure content/publishing-layer work, no UI, independently reviewable; (2) admin setup/edit routes + first-run redirect wiring in `src/middleware.ts` — the actual behavior-change slice, highest UX/regression risk since it touches every `/admin/**` visit; (3) export/import routes — the genuinely new capability, isolable and reviewable on its own since it depends on (1) and (2) existing but adds no new risk to them.
- Decision needed before apply: Yes — recommend the orchestrator apply the cached `delivery_strategy` and confirm at least the three-slice split above (not fewer) once `sdd-tasks` produces exact line counts; given this change's surface is wider than #5's (the prior widest), erring toward more chaining than #5 used, not equal to it, is the right default.

## Proposal question round (resolved)

All product-level decisions in this proposal were resolved by the user, including a follow-up round after this proposal's first draft:

1. **`links` shape — resolved**: labeled `{ label, url }` pairs, not bare URL strings (see Approach/Scope above) — confirmed specifically because this data is meant to be publicly rendered as a living CV (#52), where a label matters.
2. **Export/import file format — confirmed as proposed**: reuse the existing frontmatter+Markdown build pipeline, no new format.
3. **Fixed slug value — confirmed as proposed**: `me`.
4. **First-run redirect scope — confirmed as proposed**: fires on any `/admin/**` GET in both modes, not only `/admin`'s own landing page.

No further question round is needed before `sdd-spec`/`sdd-design`.

## Note on Source Verification

This proposal was written from: the task's full restatement of the rewritten GitHub issue #57 (vision, locked decisions 1–7, out-of-scope items, and the technical seams to address), the README's new "Vision" section (read directly), exploration findings at `sdd/profile-wizard/explore` (read via `mem_get_observation`), and direct reads of `openspec/specs/{content-schema,content-view-contract,content-publishing,admin-authoring}/spec.md` plus the current source (`content-writer.ts`, `collection-param.ts`, `admin/index.astro`, `schemas.ts`, `to-content-entry.ts`, `entry.ts`, `middleware.ts`, `content-writer-factory.ts`, `eslint.config.js`, `AGENTS.md`). Direct invocation of `gh issue view 57` was not available in this execution environment (no shell/`gh` tool was exposed to this phase); the task's restatement of the issue is treated as authoritative since it is presented as the current, post-rewrite body. If the actual issue text diverges from that restatement in ways not covered by the locked decisions above, that divergence should surface during `sdd-spec`/`sdd-design` review.
