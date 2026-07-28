# Tasks: Admin Authoring UI with Local-Dev Fallback

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~900-1060 (infra flip + verify-script fixes; LocalFsContentWriterAdapter + factory + tests; auth-gate + middleware + real-server verify script + tests; 6 admin pages/endpoints + empirical API check) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 → PR3 → PR4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Note on the estimate and phase-count decision:** the proposal's own 3-slice suggestion (infra flip / local adapter+factory / admin UI+auth gate) bundles the auth gate together with the actual admin pages into one PR. Estimating that bundle bottom-up from the design's File Changes table (`admin-auth.ts` + its multi-scenario test suite, `middleware.ts`, `scripts/verify-admin-server.mjs`, CI wiring, the eslint `admin`/`middleware` elements, PLUS all 6 page/endpoint files) puts it at roughly 600-680 lines on its own — well over the 400-line budget even before this change's largest single risk (the auth gate, this repo's first credential-adjacent write-path gate) gets isolated review attention. This plan splits that third slice into two: **Unit 3 (auth gate + middleware + real-server verification, no UI yet)** and **Unit 4 (the actual admin pages/forms)**, giving four total work units instead of three, each independently under 400 lines. This also lets Unit 3's `verify-admin-server.mjs` prove the gate (401/fail-closed/bypass via status codes) before any admin page exists — Astro's middleware runs ahead of route resolution, so gate behavior is fully testable against a route that 404s.

### Suggested Work Units

Tracker branch `feature/admin-ui` (draft, no-merge until all children land). Cascade: PR4 → PR3 branch → PR2 branch → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | Server-output infra flip + verify-script fixes | `feat/admin-server-output-flip` (base: tracker) | ~20-30 | Infra-only; no new runtime logic, reviewable in isolation |
| 2 | `LocalFsContentWriterAdapter` + config factory (TDD) | `feat/admin-local-adapter-factory` (base: PR1) | ~280-330 | Pure publishing-layer addition, no UI, no auth; mirrors the github-adapter's existing test density |
| 3 | Auth gate + middleware + `verify-admin-server.mjs` (TDD) | `feat/admin-auth-gate` (base: PR2) | ~300-340 | Highest-risk unit — first credential-adjacent write-path gate in the repo; isolated from UI so review focus stays on the security surface |
| 4 | Admin pages/forms (list/create/edit/delete) | `feat/admin-ui-pages` (base: PR3) | ~300-360 | Includes the mandatory empirical Astro single-entry-lookup API check before the edit-page prefill is built |

## Phase 1: Server-Output Infra Flip (Unit 1 — satisfies Server Output Mode for Admin Routes [build/output half])

- [x] 1.1 Add `@astrojs/node` to `package.json` dependencies; run `npm install`
- [x] 1.2 Modify `astro.config.mjs`: import `node` from `@astrojs/node`, set `output: "server"`, `adapter: node({ mode: "standalone" })`
- [x] 1.3 Fix `scripts/verify-content-collections.mjs`: add `export const prerender = true;` to `PROBE_PAGE_SOURCE`; change `probeDistPath` to `${rootDir}/dist/client/<route>/index.html`
- [x] 1.4 Fix `scripts/verify-frontmatter-round-trip.mjs`: identical two-line fix as 1.3
- [x] 1.5 Verify: run `npm run build` — confirm both `dist/server/entry.mjs` and a `dist/client/` tree are produced
- [x] 1.6 Verify: **actually run** `npm run verify:content` and `npm run verify:frontmatter` (not just edit-and-assume) — both must exit 0 under `output: "server"`
- [x] 1.7 Verify: `npm run test`, `npm run typecheck`, `npm run lint` all still exit 0 (no test/lint changes expected in this phase)
- [x] 1.8 Commit as one work unit; open PR1 → tracker branch `feature/admin-ui`

## Phase 2: LocalFsContentWriterAdapter + Composition-Root Factory (Unit 2 — satisfies LocalFsContentWriterAdapter Implements ContentWriter, Non-Throwing Publishing Configuration Check, Composition-Root Adapter Selection Factory, Validation Before Write [MODIFIED])

- [ ] 2.1 RED: `src/publishing/content-path.test.ts` — `buildContentPath("posts","hello-world")` → `src/content/posts/hello-world.md` (and for `projects`) — fails, module doesn't exist
- [ ] 2.2 GREEN: create `src/publishing/content-path.ts`; refactor `github-content-writer-adapter.ts` to import it, remove its private copy; confirm the existing adapter test suite still passes unchanged
- [ ] 2.3 RED: `src/publishing/local-fs-content-writer-adapter.test.ts` — `vi.mock("node:fs/promises")`: create happy path, create-on-existing → conflict, edit happy path, edit-on-missing → not-found, invalid frontmatter → validation with zero fs calls, unexpected fs error → sanitized `api-error` — fails, module doesn't exist
- [ ] 2.4 GREEN: create `src/publishing/local-fs-content-writer-adapter.ts` — `LocalFsContentWriterAdapter implements ContentWriter`, per design's Interfaces/Contracts
- [ ] 2.5 RED: extend `src/config/publishing-config.test.ts` — `isPublishingConfigured()` true/false branches; `loadAdminAccessToken()` reads `process.env.ADMIN_ACCESS_TOKEN` — fails, functions don't exist
- [ ] 2.6 GREEN: add `isPublishingConfigured()` and `loadAdminAccessToken()` to `src/config/publishing-config.ts`
- [ ] 2.7 RED: `src/config/content-writer-factory.test.ts` — mocked `isPublishingConfigured` true/false → `instanceof GithubContentWriterAdapter` / `instanceof LocalFsContentWriterAdapter` — fails, module doesn't exist
- [ ] 2.8 GREEN: create `src/config/content-writer-factory.ts` — `createContentWriter()`
- [ ] 2.9 Add `config -> publishing` to `boundaries/element-types` rules in `eslint.config.js`
- [ ] 2.10 Verify: `npm run test` (coverage) exits 0 across all four new/modified suites, all metrics ≥80%; `npm run typecheck` and `npm run lint` exit 0, boundary holds
- [ ] 2.11 Commit as one work unit; open PR2 → PR1 branch

## Phase 3: Admin Auth Gate + Middleware + Real-Server Verification (Unit 3 — satisfies Admin Access Gate (Mode-Dependent), Server Output Mode for Admin Routes [dynamic-per-request half])

- [ ] 3.1 RED: `src/config/admin-auth.test.ts` — not-configured → `allowed: true` (local-fallback bypass); configured + no `expectedToken` → `allowed: false, status: 401` (fail-closed); missing/malformed `Authorization` header → denied; wrong token → denied; correct token → `allowed: true` — fails, module doesn't exist
- [ ] 3.2 GREEN: create `src/config/admin-auth.ts` — `checkAdminAuth()`, `parseBasicAuthToken()`, `timingSafeStringEqual()`, per design's Interfaces/Contracts
- [ ] 3.3 RED→GREEN: extend the suite — `timingSafeStringEqual()` equal match, equal-length mismatch, unequal-length mismatch still invokes `timingSafeEqual` on the dummy compare (not short-circuited)
- [ ] 3.4 Create `src/middleware.ts` — thin `defineMiddleware()` wrapper scoped to `pathname.startsWith("/admin")`, calling `checkAdminAuth()` (no dedicated unit test — Astro runtime; proven by 3.6's real-server script instead)
- [ ] 3.5 Add `admin` and `middleware` boundaries elements to `eslint.config.js` (`admin -> [content, publishing, config, lib]`; `middleware -> [config, lib]`); run `npm run lint` to confirm the elements don't error with `src/pages/admin/**` still empty; per design's Open Question, drop the `middleware` element if `eslint-plugin-boundaries` already leaves unmatched files unrestricted
- [ ] 3.6 Create `scripts/verify-admin-server.mjs` — real `astro build`, spawn `node dist/server/entry.mjs`, real HTTP requests to `/admin`: (a) no publishing env vars → not-401 (bypass); (b) publishing env vars set, no `ADMIN_ACCESS_TOKEN` → 401 (fail-closed); (c) publishing env vars set + wrong Basic Auth → 401; (d) publishing env vars set + correct Basic Auth → not-401. Assertions target gate status codes only — `/admin` still 404s here since no page exists until Phase 4, which is expected and sufficient to prove the gate
- [ ] 3.7 Add `verify:admin-server` npm script to `package.json`; add a corresponding step after `Build` in `.github/workflows/ci.yml`
- [ ] 3.8 Verify: **actually run** `npm run verify:admin-server` against the real build (not author-and-assume) — must exit 0
- [ ] 3.9 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint` all exit 0; boundaries hold with `admin`/`middleware` elements in place
- [ ] 3.10 Commit as one work unit; open PR3 → PR2 branch

## Phase 4: Admin UI Pages — List, Create, Edit, Delete (Unit 4 — satisfies Admin Entry Listing, Admin Entry Creation and Editing, Admin Logical Delete, Logical-Delete Visibility Disclosure, No Client-Side UI Framework)

- [ ] 4.1 **Empirical API check (mandatory, do first):** confirm the exact single-entry-by-slug lookup API against the installed `astro@^7.1.4` with `legacy.collectionsBackwardsCompat: true` — verify `getEntry(collection, slug)` (design's assumption) actually exists and returns the expected shape against the real `hello-world`/`profolio` sample content; this repo has twice hit version-specific Astro API surprises design docs didn't anticipate (`src/content/config.ts` path requirement, `legacy.collectionsBackwardsCompat` requirement). If the real name/signature differs, update design.md's Interfaces/Contracts and Data Flow sections before 4.4
- [ ] 4.2 Create `src/pages/admin/index.astro` — list view via `getCollection()` + existing `toContentEntry` mapper; renders every entry including `deleted: true` (no filtering), empty collection renders without error
- [ ] 4.3 Create `src/pages/admin/[collection]/new.astro` — create form, native `<form method="POST">` to `admin/api/[collection]/create`
- [ ] 4.4 Create `src/pages/admin/[collection]/[slug]/edit.astro` — prefill using the API confirmed in 4.1; POST to `admin/api/[collection]/[slug]/edit`; delete confirmation on this page explicitly discloses the entry stays publicly visible until read-side filtering exists (Logical-Delete Visibility Disclosure)
- [ ] 4.5 Create `src/pages/admin/api/[collection]/create.ts` — POST handler, `createContentWriter().create()`; 303 redirect to `/admin?created=<slug>` on success; re-renders with `?error=` on validation failure, no write attempted
- [ ] 4.6 Create `src/pages/admin/api/[collection]/[slug]/edit.ts` — POST handler, `createContentWriter().edit()`; maps the typed conflict error to a plain user-facing message (not a raw exception); local-fallback writes surface the "saved to disk — remember to commit" reminder
- [ ] 4.7 Create `src/pages/admin/api/[collection]/[slug]/delete.ts` — POST handler, re-fetches via the confirmed lookup API (not trusting client-submitted hidden fields), calls `edit({ ...entry.data, deleted: true }, { body: entry.body })`; 303 redirect to `/admin?deleted=<slug>`
- [ ] 4.8 Verify: re-run `npm run verify:admin-server` now that `/admin/index.astro` is real — allowed cases return actual list-page content (not just non-401); denied cases remain 401
- [ ] 4.9 Verify: manual smoke test via `astro dev` (no publishing env vars set) — full create → list → edit → delete cycle against `LocalFsContentWriterAdapter`; confirm the commit reminder appears and deleted entries remain listed
- [ ] 4.10 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint`, `npm run build` all exit 0
- [ ] 4.11 Commit as one work unit; open PR4 → PR3 branch (final child; cascades to tracker → main)

## Next Step

Ready for `sdd-apply`, starting with PR1 (Phase 1). Given `auto-chain`, proceed with Unit 1 without further confirmation; re-check the Review Workload Forecast per-unit estimate as each PR's real diff lands.
