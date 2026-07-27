# AGENTS.md — Conventions for Contributors and AI Agents

## Purpose

This file is binding for both human contributors and AI coding agents (Claude Code, Cursor, OpenCode, and others) working in this repository. It documents the project's clean-code and SOLID-adjacent conventions, and is explicit about which rules are mechanically enforced by the linter versus which require human judgment during review. Do not claim a convention is "enforced" unless it is wired into `eslint.config.js` — see the cross-check requirement below.

## Enforced by Linter (mechanical)

Every row below maps to an active rule in `eslint.config.js`. This table is cross-checked against that file directly — if a rule is renamed, disabled, or removed there, this table must be updated in the same commit.

| Rule | What it catches | Tool |
|---|---|---|
| `@typescript-eslint/naming-convention` | Enforces `camelCase` by default, `camelCase`/`UPPER_CASE` for variables, `PascalCase` for types, `UPPER_CASE` for enum members | typescript-eslint |
| `complexity` (max 10) | Cyclomatic complexity above threshold per function | ESLint core |
| `sonarjs/cognitive-complexity` (max 15) | Cognitive complexity (nesting, branching readability) above threshold | eslint-plugin-sonarjs |
| `max-lines-per-function` (max 50, blank/comment lines excluded) | Functions grown too large to review at a glance | ESLint core |
| `max-lines` (max 300, blank/comment lines excluded) | Files grown too large, likely mixing responsibilities | ESLint core |
| `max-depth` (max 3) | Deeply nested control flow | ESLint core |
| `max-params` (max 4) | Functions taking too many positional parameters | ESLint core |
| `sonarjs/no-duplicate-string` | Repeated string literals that should be a constant | eslint-plugin-sonarjs |
| `sonarjs/no-identical-functions` | Copy-pasted function bodies | eslint-plugin-sonarjs |
| `@typescript-eslint/no-explicit-any` | Explicit `any` usage, defeating type safety | typescript-eslint |
| `@typescript-eslint/explicit-function-return-type` | Functions missing an explicit return type annotation | typescript-eslint |
| `@typescript-eslint/no-floating-promises` | Unhandled/unawaited promises | typescript-eslint |
| `no-restricted-syntax` (custom `process.env` selector) | Direct `process.env` member access outside `src/config/**` — the DI-adjacent rule; config must be injected, not read from ambient globals | ESLint core |
| `boundaries/element-types` | Illegal imports across layer boundaries (`content`, `view`, `config`, `lib`) — see `settings["boundaries/elements"]` in `eslint.config.js` | eslint-plugin-boundaries |

Run `npm run lint` to check all of the above. A violation of any rule fails CI.

## Human Review Guidance (not automatable)

The following cannot be mechanically verified by a linter. Reviewers (human or AI) must judge these during code review by asking:

- **Single Responsibility Principle (SRP)** — does this module/function have exactly one reason to change, or is it quietly doing two unrelated things that happen to fit under the line/complexity limits?
- **Abstraction and interface quality** — does this interface/abstract type represent a real, stable concept, or is it a thin wrapper that adds indirection without adding meaning?
- **Dependency injection (DI) design quality** — beyond the mechanical ban on ambient `process.env` access, are dependencies passed in explicitly (constructor/function parameters, factories) in a way that makes the code testable in isolation, or is there hidden coupling to modules, singletons, or side-effecting imports?
- **Naming intent** — do names (variables, functions, types) reveal *why* something exists and what it represents, not just its shape or type?
- **Premature abstraction** — is this abstraction (interface, generic, factory, plugin point) justified by an existing concrete need, or is it speculative generality added "just in case"?

If a reviewer cannot answer "yes, clearly" to the intended-behavior side of these questions, that is a legitimate review comment even though no lint rule fired.

## Scaffold Note

`src/lib/scaffold/scaffold-info.ts` (and its co-located `scaffold-info.test.ts`) is a disposable placeholder module. It exists solely to give the Vitest coverage gate a real, non-trivial unit to measure while the repository has no feature code yet — an empty or vacuous test suite would let the 80% coverage threshold pass without actually proving the gate works. Delete this module once real feature code exists and exercises the coverage gate on its own.

## CI Gate Reference

The quality gate runs in `.github/workflows/ci.yml` as a single `quality-gate` job: checkout → setup-node → `npm ci` → typecheck → lint → test (with coverage) → build. Each step must exit `0` for the job to pass (default GitHub Actions per-job fail-fast).

The test step enforces an **80% coverage threshold** across lines, functions, branches, and statements. This threshold is configured in `vitest.config.ts` (`test.coverage.thresholds`), using the `@vitest/coverage-v8` provider. Falling below any of the four metrics fails `npm run test` and therefore fails CI.
