# CI Quality Gate Specification

## Purpose

Establishes the automated quality gate every change to this repository must pass — type safety, lint, tests, and coverage — enforced in CI before merge.

## Requirements

### Requirement: TypeScript Strict Compilation

The system MUST provide a `tsconfig.json` with `strict: true` and recommended strictness flags enabled, and CI MUST run a typecheck step that fails the build on any type error.

#### Scenario: Scaffold compiles cleanly

- GIVEN the repository scaffold with only the placeholder module
- WHEN the typecheck step runs (`tsc --noEmit` or equivalent)
- THEN it completes with zero errors

#### Scenario: Type error blocks CI

- GIVEN a change introduces a type error
- WHEN the typecheck step runs in CI
- THEN the CI job fails before reaching lint/test steps

### Requirement: Lint & Format Gate

The system MUST provide an ESLint flat config combining `typescript-eslint` (`strict-type-checked`), `eslint-plugin-astro`, and Prettier integration, and CI MUST run `eslint .` as a required step.

#### Scenario: Clean scaffold lints cleanly

- GIVEN the scaffold with only the placeholder module
- WHEN `eslint .` runs
- THEN it exits 0 with no errors or warnings

#### Scenario: Lint violation blocks CI

- GIVEN a change introduces a lint rule violation
- WHEN the lint step runs in CI
- THEN the CI job fails

### Requirement: Coverage-Enforced Test Gate

The system MUST use Vitest with `@vitest/coverage-v8`, MUST configure `vitest.config.ts` using Astro's `getViteConfig()` now that `astro.config.mjs` exists, and MUST configure coverage thresholds (80% lines, functions, branches, statements) natively within that config, such that `vitest run --coverage` exits non-zero when any threshold is not met.

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

### Requirement: Demonstrable Placeholder Module

The system MUST include exactly one disposable placeholder module and its matching unit test, whose sole purpose is to make the coverage gate demonstrable on an otherwise-empty scaffold.

#### Scenario: Placeholder proves the gate is live

- GIVEN no feature code exists yet
- WHEN CI runs
- THEN the placeholder module's test executes and produces a non-zero, non-trivial coverage measurement, proving the gate is live rather than vacuously passing

### Requirement: CI Pipeline Order

The system MUST provide a GitHub Actions workflow that runs, in order: dependency install, typecheck, lint, test+coverage, build — failing fast at the first failing step.

#### Scenario: Full pipeline runs green on scaffold

- GIVEN the repository scaffold with only the placeholder module present
- WHEN the CI workflow runs on a pull request or push
- THEN install, typecheck, lint, test+coverage, and build all succeed in sequence

#### Scenario: Any stage failure stops the pipeline

- GIVEN one of typecheck/lint/test+coverage/build fails
- WHEN the CI workflow runs
- THEN the overall workflow run is marked failed and does not report success
