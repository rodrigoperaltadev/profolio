# Tasks: Content-Agnostic Content Model & Schema

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~340-395 (excl. `package-lock.json`) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 → PR3 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

### Suggested Work Units

Tracker branch `feature/content-model-schema` (draft, no-merge until all children land). Cascade: PR3 → PR2 branch → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | Astro install + `getViteConfig()` migration | `feat/astro-content-foundation` (base: tracker) | ~35-45 | Isolates the Astro/Vitest interaction risk before content code lands, per design's mitigation |
| 2 | Schema + shared contract layer (TDD) | `feat/content-schema-layer` (base: PR1) | ~150-180 | `schemas.ts`, `validate-entry.ts`, `entry.ts`, `config.ts` |
| 3 | Mapper dispatcher + sample content + build proof (TDD) | `feat/content-mapper-sample-content` (base: PR2) | ~150-170 | `to-content-entry.ts`, sample `.md` files, `npm run build` |

## Phase 1: Astro Install & Vitest Migration (Unit 1 — satisfies Coverage-Enforced Test Gate delta)

- [x] 1.1 Add `astro` and `zod` as dependencies in `package.json`
- [x] 1.2 Create `astro.config.mjs` (minimal config, no integrations needed yet)
- [x] 1.3 Migrate `vitest.config.ts`: replace `defineConfig` with `getViteConfig()`, keep existing 80% coverage thresholds, per design's migration section
- [x] 1.4 Verify: `npm run test` (existing scaffold suite) passes under `getViteConfig()` before any content code exists
- [x] 1.5 Verify: `npm run typecheck` and `npm run lint` exit 0 with the new config files
- [x] 1.6 Commit as one work unit; open PR1 → tracker branch

## Phase 2: Content Schema & Shared Contract Layer (Unit 2 — satisfies Content Collections Configuration, Posts/Projects Schema Shape, Shared Entry Contract Type)

- [x] 2.1 RED: write `src/content/schemas.test.ts` — `postsSchema`/`projectsSchema` happy path (valid fields, `draft` defaults `false`) and failure path (missing `title`/`link`) via `.safeParse()` — fails, module doesn't exist
- [x] 2.2 GREEN: create `src/content/schemas.ts` — `postsSchema`/`projectsSchema`, standalone `zod` import (no `astro:content`), per design's Interfaces
- [x] 2.3 RED: write `src/content/validate-entry.test.ts` — `parseEntry()` ok branch (valid input) and error branch (invalid input) — fails, module doesn't exist
- [x] 2.4 GREEN: create `src/content/validate-entry.ts` — `parseEntry()` wrapper returning `ParseResult<T>`, per design's Interfaces
- [x] 2.5 Create `src/content/entry.ts` — `ContentEntry` shared display-shape type (no collection-specific field names)
- [x] 2.6 Create `src/content.config.ts` — `defineCollection` + `collections` export wiring `schemas.ts` (declarative, no dedicated test per design's Testing Strategy). DEVIATION: design.md said `src/content/config.ts`; Astro 7 requires the top-level path `src/content.config.ts` (`LegacyContentConfigError` otherwise) — see apply-progress for details
- [x] 2.7 Verify: `npm run test` (coverage) exits 0 on `schemas.test.ts` + `validate-entry.test.ts`, 100% non-vacuous on all 4 metrics; also verified `npm run typecheck` and `npm run lint` exit 0 (required `src/env.d.ts` + `.astro/` gitignore/eslint-ignore additions, not explicitly listed in this task but necessary for the codebase to compile — see apply-progress)
- [x] 2.8 Commit as one work unit; open PR2 → PR1 branch

## Phase 3: Mapper Dispatcher, Sample Content, Build Proof (Unit 3 — satisfies Per-Collection Mapper Functions, New Collections Require No View-Layer Control Flow, Folder-Per-Collection File Layout, Build-Time Schema Validation)

- [x] 3.1 RED: write `src/content/mappers/to-content-entry.test.ts` — fixture-based tests asserting `toContentEntry()` dispatches `posts`/`projects` fixtures to the correct mapper and each output satisfies `ContentEntry` — fails, module doesn't exist
- [x] 3.2 GREEN: create `src/content/mappers/to-content-entry.ts` — dispatch-table `mappers` object + `toContentEntry()`, per design's Interfaces (zero new branches when a 3rd collection is added). DEVIATION: `toContentEntry()`'s generic dispatch (`mappers[entry.collection]`) needed a documented `as Mapper<C>` cast — TS cannot statically unify a generic-indexed object-literal lookup back to `Mapper<C>` on its own; each `mappers` entry itself stays fully typed per collection, so this is a TS-inference-limit workaround, not a real type-safety gap
- [x] 3.3 Create `src/content/posts/hello-world.md` sample entry (title/date/tags/draft/body)
- [x] 3.4 Create `src/content/projects/profolio.md` sample entry (name/stack/link/date/draft/body)
- [x] [gap fix] Wire `package.json`'s `build` script to `astro build` (was still the previous change's placeholder stub); also added `dist/` to `.gitignore` since a real build now produces output
- [x] 3.5 Verify: `npm run test` (coverage) exits 0, all four metrics 100% non-vacuous across `schemas`/`validate-entry`/mapper suites (13 tests, 4 files)
- [x] 3.6 Verify: `npm run build` succeeds with both sample files present after `rm -rf .astro dist`, proving `astro:content` resolves via `getViteConfig()` end-to-end from a genuinely clean state
- [x] 3.7 Verify: `eslint .` exits 0 clean against the existing `boundaries/element-types` rule, no exceptions added (only pre-existing plugin deprecation warnings, not errors)
- [x] 3.8 Commit as one work unit; open PR3 → PR2 branch (final child; cascades to tracker → main)

## Phase 4: Post-Merge Fix Cycle (sdd-verify CRITICAL — `getCollection()` was functionally inert)

`sdd-verify` found that `astro.config.mjs` was missing `legacy: { collectionsBackwardsCompat: true }`, so `getCollection()` silently returned `[]` for both valid and malformed content despite all unit tests, typecheck, lint, and build passing. Fixed on top of PR3's branch (`feat/content-mapper-sample-content`).

- [x] 4.1 Add `legacy: { collectionsBackwardsCompat: true }` to `astro.config.mjs`
- [x] 4.2 Reproduce with a temporary `getCollection()`-calling page + `astro build`: confirm the flag alone makes `posts:1`/`projects:1` resolve, and that it also triggers Astro's folder-based auto-collection-detection warning on `src/content/mappers/` (holds only `.ts` files)
- [x] 4.3 Fix the auto-detection collision: rename `src/content/mappers/` → `src/content/_mappers/` (leading-underscore convention Astro's own `autogenerateCollections()` already skips) — no `eslint.config.js` boundaries change needed, since `src/content/_mappers/**` still matches the existing `content` element's `src/content/**` pattern
- [x] 4.4 Investigate and reject two Vitest-level alternatives for a real `getCollection()` proof (direct `astro:content` import under `getViteConfig()`; `astro/container`'s `experimental_AstroContainer`) — both empirically return an empty store outside a real `astro build`/`astro dev` process
- [x] 4.5 Add `scripts/verify-content-collections.mjs` + `npm run verify:content`: build-time proof that a real page's `getCollection()` call resolves valid content (`posts:1`/`projects:1`) AND that a genuinely malformed entry fails the build (non-zero exit), with full cleanup in a `finally` block
- [x] 4.6 Wire `verify:content` into `.github/workflows/ci.yml` as a step after `build`
- [x] 4.7 Add narrow `eslint.config.js` override for `scripts/**/*.mjs` (Node script, not part of `tsconfig.json`'s `include`, cannot carry TS return-type syntax under plain `node` execution) — `boundaries/element-types` itself unmodified
- [x] 4.8 Update `design.md` (Architecture Decisions, File Changes, Testing Strategy, new "Build-Time Content Proof" section) to reflect the actual shipped fix
- [x] 4.9 Re-verify from genuinely clean state (`rm -rf .astro dist node_modules/.cache && npm ci`): `typecheck`, `lint`, `test` (13/13, 100% all 4 metrics), `build`, and `verify:content` (both proofs pass) all green
- [x] 4.10 Commit fix on `feat/content-mapper-sample-content`, push, confirm GitHub Actions CI run concludes `success`

## Next Step

Ready for `sdd-verify` (re-verify the fix cycle before merge/archive).
