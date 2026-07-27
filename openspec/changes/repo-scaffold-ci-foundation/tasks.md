# Tasks: Repo Scaffold & CI Foundation (with Clean Code/SOLID Conventions)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~480-590 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 → PR3 → PR4 → PR5 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

Tracker branch `feature/repo-scaffold-ci-foundation` (draft, no-merge until all children land). Cascade: PR5 → PR4 branch → PR3 branch → PR2 branch → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | Language/package foundation | `feat/scaffold-foundation` (base: tracker) | ~60 | package.json + tsconfig.json; compiles standalone |
| 2 | Lint & format gate | `feat/lint-format-gate` (base: PR1) | ~140 | eslint.config.js, .prettierrc.json, .prettierignore |
| 3 | Test runner + coverage + placeholder | `feat/test-coverage-gate` (base: PR2) | ~90 | vitest.config.ts, scaffold-info.ts/.test.ts (TDD) |
| 4 | CI pipeline | `feat/ci-workflow` (base: PR3) | ~55 | .github/workflows/ci.yml; gate-proof verification |
| 5 | Conventions docs + config flip | `feat/conventions-docs` (base: PR4) | ~200 | CLAUDE.md, openspec/config.yaml |

## Phase 1: Language/Package Foundation (Unit 1 — satisfies TypeScript Strict Compilation)

- [x] 1.1 Create `package.json`: name, version, scripts `typecheck`/`lint`/`test`/`build` (contract names, verbatim)
- [x] 1.2 Create `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [x] 1.3 Verify: `npm run typecheck` exits 0 on empty scaffold
- [x] 1.4 Commit as one work unit; open PR1 → tracker branch

## Phase 2: Lint & Format Gate (Unit 2 — satisfies Lint & Format Gate, Mechanical Subset Wired)

- [x] 2.1 Add ESLint/Prettier/typescript-eslint/astro/sonarjs/boundaries deps to `package.json`
- [x] 2.2 Create `eslint.config.js` per design's mechanical rule set (naming-convention, complexity, cognitive-complexity, max-lines-per-function, max-lines, max-depth, max-params, sonarjs rules, no-explicit-any, explicit-function-return-type, no-floating-promises, no-restricted-syntax for `process.env`, boundaries/element-types), `eslintConfigPrettier` last
- [x] 2.3 Create `.prettierrc.json` (defaults) and `.prettierignore` (`dist/`, `.astro/`)
- [x] 2.4 Verify: `npm run lint` exits 0 on scaffold
- [x] 2.5 Commit as one work unit; open PR2 → PR1 branch

## Phase 3: Test Runner, Coverage, Placeholder (Unit 3 — satisfies Coverage-Enforced Test Gate, Demonstrable Placeholder)

- [ ] 3.1 Add Vitest + `@vitest/coverage-v8` deps; create `vitest.config.ts` with 80% thresholds (lines/functions/branches/statements)
- [ ] 3.2 RED: write `src/lib/scaffold/scaffold-info.test.ts` asserting `getScaffoldInfo` pass-through mapping (fails — module doesn't exist yet)
- [ ] 3.3 GREEN: create `src/lib/scaffold/scaffold-info.ts` (JSDoc-flagged disposable) implementing `ScaffoldInfo`/`getScaffoldInfo` per design's Interfaces
- [ ] 3.4 Verify: `npm run test` (coverage) exits 0, all four metrics ≥80% and non-vacuous
- [ ] 3.5 Commit as one work unit; open PR3 → PR2 branch

## Phase 4: CI Pipeline (Unit 4 — satisfies CI Pipeline Order)

- [ ] 4.1 Create `.github/workflows/ci.yml`: single `quality-gate` job — checkout → setup-node (npm cache) → `npm ci` → typecheck → lint → test+coverage → build, fail-fast
- [ ] 4.2 Gate-proof (manual, not committed): temporarily add a function exceeding `complexity`/`max-lines-per-function`; confirm `npm run lint` fails locally; then remove it
- [ ] 4.3 Verify: full pipeline green on CI for the scaffold-only state
- [ ] 4.4 Commit as one work unit; open PR4 → PR3 branch

## Phase 5: Conventions Docs + Config Flip (Unit 5 — satisfies Documented Conventions, Mechanical vs. Guidance Split)

- [ ] 5.1 Create `CLAUDE.md` per design's 5-section structure: Purpose, Enforced by Linter (table matching active `eslint.config.js` rules exactly), Human Review Guidance (SRP, abstraction/DI quality, naming intent, premature abstraction — as review questions), Scaffold Note (`scaffold-info.ts` is disposable), CI Gate Reference (80% threshold, `vitest.config.ts`)
- [ ] 5.2 Cross-check: every "mechanically enforced" line in `CLAUDE.md` maps to an active rule in `eslint.config.js`; no overclaiming
- [ ] 5.3 Modify `openspec/config.yaml`: `strict_tdd: true`, fill `testing.*` (runner, layers, coverage, quality), `apply.tdd: true`/`test_command`, `verify.test_command`/`build_command`/`coverage_threshold: 80`
- [ ] 5.4 Commit as one work unit; open PR5 → PR4 branch (final child; cascades to tracker → main)

## Next Step

Ready for `sdd-apply`, starting Phase 1 (PR1) on branch `feat/scaffold-foundation` off tracker `feature/repo-scaffold-ci-foundation`.
