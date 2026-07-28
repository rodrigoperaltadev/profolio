# Proposal: Admin Authoring UI with Local-Dev Fallback

Cross-references: GitHub #5 (this change), #4 (publishing-layer, archived — supplies `ContentWriter`/`GithubContentWriterAdapter`), #3 (content-model-schema, archived — supplies schemas/`getCollection`/mapper), #6 (theming, deferred), #7 (env var setup wizard, deferred), #8 (security hardening, deferred — owns full auth).

## Intent

Issue #4 gave Profolio a way to write content programmatically, but nothing calls it yet — every real edit still requires hand-writing a markdown file and a manual commit. Issue #5 closes that gap with a minimal admin UI to list, create, edit, and logically delete content, working in two modes: against `GithubContentWriterAdapter` when publishing env vars are configured, and against a new disk-only `LocalFsContentWriterAdapter` fallback for local development without any GitHub token. This is also the first change to flip Astro's `output` mode to `"server"`, since `/admin/**` needs a real request/response cycle — a meaningful infra decision this proposal finally makes explicit rather than deferring again.

## Scope

### In Scope

- `output: "server"` + `@astrojs/node` (standalone) in `astro.config.mjs`; public content pages opt back into static generation via `export const prerender = true` per page, so only `/admin/**` is dynamic
- New `LocalFsContentWriterAdapter implements ContentWriter` in `src/publishing/**`, reusing the existing `parseFrontmatter()`/`buildMarkdownFile()` pipeline, writing to `src/content/<collection>/<slug>.md` via `fs/promises` — no `git add`/`git commit`, the human commits manually
- A non-throwing "is publishing configured" check alongside the existing (throwing) `loadPublishingConfig()`, and a composition-root factory in `src/config/**` that selects `GithubContentWriterAdapter` vs. `LocalFsContentWriterAdapter` based on that check
- Admin pages under `src/pages/admin/**`: list existing entries (via `getCollection()` + the issue #3 mapper), create, edit, and logical-delete forms — plain server-rendered Astro pages, native `<form method="POST">`, no client-side JS framework
- New `admin` ESLint boundaries element (`src/pages/admin/**`), allowed to depend on `content`, `publishing`, `config`, `lib` — `view`/`src/presentation/**` gains no new access and stays credential-free
- Interim shared-secret gate on `/admin/**` when running in full/server (GitHub-configured) mode: a new env var (working name `ADMIN_ACCESS_TOKEN`, read only in `src/config/**`), checked via HTTP Basic Auth or an equivalent lightweight check, explicitly documented as a stopgap superseded by issue #8
- Admin delete = `edit()` with `deleted: true` on the full existing frontmatter (issue #4 semantics, no new port method)
- Verification task confirming `scripts/verify-content-collections.mjs` and `scripts/verify-frontmatter-round-trip.mjs` still pass under the new `output: "server"` build

### Out of Scope

- Theming/styling of admin or public pages (#6) — forms are plain unstyled HTML
- The env var setup wizard (#7) — this change reads `ADMIN_ACCESS_TOKEN`/publishing env vars, it does not build tooling to set them
- Full user/session auth, roles, or permissions (#8) — the Basic-Auth-style gate is an interim measure only, not a real auth system
- Read-side filtering of `deleted: true` entries anywhere in the app (public pages, feeds, sitemaps) — no such filtering exists yet in the codebase today, and this change does not add it either
- Auth/gating in local-fallback mode — not required, since that mode is only realistically reached via `astro dev` on localhost
- Hard delete, atomic multi-file commits, slug/path inference — unchanged from issue #4's existing constraints

## Capabilities

### New Capabilities

- `admin-authoring`: server-rendered admin UI (`src/pages/admin/**`) for listing, creating, editing, and logically deleting content entries, backed by `ContentWriter` (either adapter) and the `content-view-contract`, gated by an interim shared-secret check in full/server mode

### Modified Capabilities

- `content-publishing`: adds `LocalFsContentWriterAdapter implements ContentWriter` (disk-only, no git operations) and a non-throwing publishing-configuration-detection function alongside the existing throwing `loadPublishingConfig()`; no change to the `ContentWriter` port shape itself
- `ci-quality-gate` (implicitly, via astro.config.mjs `output`/adapter change): the build/verification scripts must be re-confirmed to hold under `output: "server"` — flagged as a verification task in this change, not assumed to be unaffected

## Approach

Server-rendered Astro pages, no new UI framework: native `<form method="POST">` posting to colocated server endpoints under `src/pages/admin/**` (Astro actions or `.ts` API routes — design decides the exact mechanism, both stay within Astro's own primitives). This matches the repo's zero-dependency posture for UI and keeps theming (#6) entirely out of scope.

Adapter selection is a composition-root decision: a factory in `src/config/**` calls the new non-throwing "is configured" check and constructs either `GithubContentWriterAdapter` (env vars present) or `LocalFsContentWriterAdapter` (absent) — mirroring how `src/config/**` already owns the only permitted `process.env` access. `LocalFsContentWriterAdapter` reuses `parseFrontmatter()`/`buildMarkdownFile()` so both adapters produce byte-identical file bodies for the same input; it differs only in the write target (disk vs. GitHub API) and omits any git operation entirely, per the issue's literal wording.

Auth is intentionally minimal and mode-dependent: full/server mode (GitHub env vars present) is the mode where `/admin/**` is a real, potentially internet-facing write path, so it is gated behind a shared secret read from `src/config/**`. Local-fallback mode (no publishing env vars) has no gate, since it is only reached via `astro dev` on localhost, not a deployed server — this asymmetry is deliberate and must be explicit in spec/design, not a silent omission. Design owns the exact mechanism (Basic Auth vs. equivalent) and the exact env var name.

Admin "delete" is a design-level call, not left open: it calls `edit()` with `deleted: true` on the entry's full existing frontmatter, reusing issue #4's logical-delete semantics exactly — no new port method, no new adapter behavior. Because no read-side filtering on `deleted` exists anywhere in the codebase yet (public pages, feeds, sitemaps all render every entry today), a "deleted" entry through this admin UI remains publicly visible on the live site until a future change adds that filtering. This is a real, user-facing gap; it is called out here rather than glossed over, and adding read-side filtering is explicitly out of scope for this change.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `astro.config.mjs` | Modified | `output: "server"` + `@astrojs/node` (standalone) adapter — first server adapter in the repo |
| `package.json` | Modified | New dependency: `@astrojs/node` |
| `src/pages/**` (public content pages) | Modified | Add `export const prerender = true` per page so only `/admin/**` is dynamic |
| `src/pages/admin/**` | New | Admin list/create/edit/delete pages + colocated server endpoints (Astro actions or `.ts` routes) |
| `src/publishing/**` | Modified | New `LocalFsContentWriterAdapter`; possible extraction of shared path-building logic currently private in `GithubContentWriterAdapter` |
| `src/config/**` | Modified | Non-throwing "is publishing configured" check, adapter-selection factory, `ADMIN_ACCESS_TOKEN` (or similar) read |
| `eslint.config.js` | Modified | New `admin` boundaries element (`src/pages/admin/**`), allowed `admin -> [content, publishing, config, lib]`; `view` unchanged |
| `scripts/verify-content-collections.mjs`, `scripts/verify-frontmatter-round-trip.mjs` | Verification only | Confirm both still pass under `output: "server"` — no assumed-safe skip |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Flipping `output: "server"` breaks the existing static-build proof scripts or CI build step | Medium | Explicit verification task re-runs both scripts and `npm run build`/`astro build` under the new output mode before this change is considered done; failures block merge, not silently patched over |
| Per-page `prerender = true` is missed on a public page, making it unexpectedly dynamic (perf/behavior regression) | Medium | Design/tasks enumerate every existing public page route explicitly; a lint/verification check (or manual audit list) confirms each one carries the flag |
| Interim Basic-Auth-style gate is mistaken for real security by users/deployers | Medium | Documentation (README/HANDOFF) states plainly that this is a stopgap superseded by issue #8, not a security boundary; secret comparison uses a timing-safe check, not `===` |
| `ADMIN_ACCESS_TOKEN` (or equivalent) is left unset in a deployed full/server instance, leaving `/admin/**` unauthenticated in production | Medium | Config factory fails closed: if GitHub env vars are present (full mode) but the admin secret is absent, the app refuses to start or `/admin/**` hard-denies rather than defaulting to open access |
| Logical-delete-but-still-publicly-visible gap surprises users of the admin UI (they expect "delete" to mean "gone from the site") | Medium | Delete UI copy explicitly states the entry is hidden from the admin list but remains live until a future change adds read-side filtering — set correct expectations rather than implying real removal |
| `LocalFsContentWriterAdapter` writes are mistaken for having been committed (no git integration), risking silent data loss if the human forgets to commit | Low-Medium | Admin UI in local-fallback mode surfaces a visible reminder ("saved to disk — remember to commit") after every successful write |
| New `admin` boundaries element accidentally gains access to `view`, or `view` gains access to `publishing`/`config`, weakening the credential-free public-page guarantee | Low (ESLint already enforces `default: disallow`) | No boundaries rule changes for `view`; only `admin` is added with its own explicit allow-list |
| `@astrojs/node` standalone adapter changes local dev-server behavior (e.g. HMR, error overlays) in ways prior changes' verification scripts didn't anticipate | Low-Medium | Manual smoke test of `astro dev` and `npm run build && node ./dist/server/entry.mjs` included as an explicit verification step, not assumed equivalent to the static-output dev server |
| Concurrent admin writes race with `GithubContentWriterAdapter`'s existing SHA-conflict handling (unchanged from #4) surfacing as raw errors in the admin UI | Low | Admin edit/create forms render the typed conflict error from #4 as a plain user-facing message ("file changed since you loaded it, reload and retry") rather than an unhandled exception |

## Rollback Plan

Revert `astro.config.mjs` (`output`/adapter) and the per-page `prerender` flags, remove `@astrojs/node` from `package.json`, remove `src/pages/admin/**` and the `admin` boundaries element from `eslint.config.js`, and remove `LocalFsContentWriterAdapter` plus the adapter-selection factory from `src/publishing/**`/`src/config/**` via git. `GithubContentWriterAdapter` and existing schemas/mapper are untouched by this change, so no data migration is needed; any markdown files written by `LocalFsContentWriterAdapter` during local testing remain on disk as plain content files and can be discarded or kept independent of the code revert.

## Dependencies

- Depends on content-publishing (archived, #4) for `ContentWriter`, `GithubContentWriterAdapter`, `parseFrontmatter()`/`buildMarkdownFile()`.
- Depends on content-schema/content-view-contract (archived, #3) for `getCollection()` and the mapper/`ContentEntry` shape used by the admin list view.
- Operational prerequisite: a value for `ADMIN_ACCESS_TOKEN` (or equivalent) must be provisioned before deploying this change in full/server mode; local-fallback mode has no such prerequisite.
- Sets up (but does not build) the env var surface issue #7's wizard will eventually manage.
- Full auth/session replacement is issue #8's responsibility; this change's gate is explicitly interim.

## Success Criteria

- [ ] `astro.config.mjs` sets `output: "server"` with `@astrojs/node` (standalone); every existing public content page carries `export const prerender = true`
- [ ] `npm run build` produces a working `node ./dist/server/entry.mjs` deployable; `scripts/verify-content-collections.mjs` and `scripts/verify-frontmatter-round-trip.mjs` both still pass
- [ ] `LocalFsContentWriterAdapter implements ContentWriter`, writes validated markdown to `src/content/<collection>/<slug>.md` via `fs/promises`, performs no git operation
- [ ] A non-throwing publishing-configuration check exists in `src/config/**`; the adapter-selection factory uses it to choose `GithubContentWriterAdapter` vs. `LocalFsContentWriterAdapter`
- [ ] `/admin/**` lists existing entries, and supports create/edit/logical-delete via plain HTML forms, with no client-side JS framework added
- [ ] In full/server (GitHub-configured) mode, `/admin/**` is gated behind the shared-secret check; unauthenticated requests are denied
- [ ] In local-fallback mode, `/admin/**` is reachable without the shared secret
- [ ] New `admin` boundaries element exists; `view` gains no new dependency edges
- [ ] Admin delete calls `edit()` with `deleted: true`; no new `ContentWriter` port method is added
- [ ] Coverage gate holds at 80% under strict TDD for all new code

## Review Workload Forecast

- Estimated changed lines: ~600-900 (astro output/adapter flip + per-page prerender flags, `LocalFsContentWriterAdapter` + config factory + config tests, admin pages/endpoints for list/create/edit/delete + their tests, auth-gate middleware/check + tests, eslint boundaries update, verification-script re-runs). This is clearly the largest change so far and very likely exceeds the 400-line budget on its own.
- Chained PRs: Recommended. Natural slice boundaries: (1) server-output infra flip (`astro.config.mjs`, adapter, prerender flags, verification-script re-confirmation) as its own PR since it's an infra-only change reviewable in isolation; (2) `LocalFsContentWriterAdapter` + config factory as a second PR (pure publishing-layer addition, no UI); (3) admin pages/forms + auth gate as a third PR (the actual UI/write-path surface, highest-risk review target).
- Decision needed before apply: Yes — recommend the orchestrator apply the cached `delivery_strategy` and, if chaining, confirm the three-slice split above (or an equivalent) once `sdd-tasks` produces exact line estimates.
