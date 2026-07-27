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

- [ ] 3.1 RED: write `src/content/mappers/to-content-entry.test.ts` — fixture-based tests asserting `toContentEntry()` dispatches `posts`/`projects` fixtures to the correct mapper and each output satisfies `ContentEntry` — fails, module doesn't exist
- [ ] 3.2 GREEN: create `src/content/mappers/to-content-entry.ts` — dispatch-table `mappers` object + `toContentEntry()`, per design's Interfaces (zero new branches when a 3rd collection is added)
- [ ] 3.3 Create `src/content/posts/hello-world.md` sample entry (title/date/tags/draft/body)
- [ ] 3.4 Create `src/content/projects/profolio.md` sample entry (name/stack/link/date/draft/body)
- [ ] 3.5 Verify: `npm run test` (coverage) exits 0, all four metrics ≥80% non-vacuous across `schemas`/`validate-entry`/mapper suites
- [ ] 3.6 Verify: `npm run build` succeeds with both sample files present, proving `astro:content` resolves via `getViteConfig()` end-to-end
- [ ] 3.7 Verify: `eslint .` passes clean against the existing `boundaries/element-types` rule, no exceptions added
- [ ] 3.8 Commit as one work unit; open PR3 → PR2 branch (final child; cascades to tracker → main)

## Next Step

Ready for `sdd-apply`, starting with PR1 (Unit 1). Auto-chain delivery strategy: no pre-apply decision needed; each unit's PR opens against the branch listed in Suggested Work Units.
