# Delta for CI Quality Gate

## MODIFIED Requirements

### Requirement: Coverage-Enforced Test Gate

The system MUST use Vitest with `@vitest/coverage-v8`, MUST configure `vitest.config.ts` using Astro's `getViteConfig()` now that `astro.config.mjs` exists, and MUST configure coverage thresholds (80% lines, functions, branches, statements) natively within that config, such that `vitest run --coverage` exits non-zero when any threshold is not met.

(Previously: `vitest.config.ts` used plain Vitest `defineConfig()` as a documented temporary deviation, because no `astro.config.mjs` existed yet for `getViteConfig()` to read.)

#### Scenario: Coverage above threshold passes

- GIVEN the codebase has unit tests achieving at least 80% on all four coverage metrics
- WHEN `vitest run --coverage` runs
- THEN it exits 0

#### Scenario: Coverage below threshold fails

- GIVEN a change adds code without adequate tests, dropping any of lines/functions/branches/statements below 80%
- WHEN `vitest run --coverage` runs in CI
- THEN it exits non-zero and the CI job fails

#### Scenario: getViteConfig migration preserves the gate

- GIVEN `astro.config.mjs` now exists and `vitest.config.ts` is migrated from `defineConfig` to `getViteConfig()`
- WHEN the full test suite runs via `vitest run --coverage`
- THEN it still passes and the same 80% thresholds are still enforced natively in `vitest.config.ts`
