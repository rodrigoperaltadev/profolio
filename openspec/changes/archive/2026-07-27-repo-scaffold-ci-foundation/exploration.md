# Exploration: Repo scaffold & CI foundation (GitHub #1) + Clean code/SOLID conventions (GitHub #2, child of #1)

## Current State

Repo has no scaffold yet: no package.json, no tsconfig, no CI, no lint/format config, no CLAUDE.md. Existing files: README.md (states stack=Astro, decided), LICENSE (MIT), .backlog/config.yml (GitHub-backed backlog, issues #1-#8), openspec/config.yaml (testing.status=not_configured, strict_tdd=false until #1 lands a runner), .atl/skill-registry.md (no project-level skill/convention files yet).

Issue #1 (epic, state:backlog): scope = TS strict config, linter/formatter, test framework, CI pipeline with coverage gate; out of scope = feature code, content model; acceptance = CI runs on empty scaffold, a PR under coverage threshold fails the gate, lint passes clean.

Issue #2 (child, state:backlog): scope = CLAUDE.md conventions (naming, SRP, complexity limits, DI) + linter config + wiring into #1's CI coverage gate; acceptance = CLAUDE.md documents conventions, linter enforces the mechanical ones, a sample violation fails CI.

## Affected Areas (to be created — none exist yet)

- `package.json`, `tsconfig.json` — project init + TS strict mode (`strict: true`, plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` recommended for a public library)
- `eslint.config.js` (flat config) or `biome.json` — linter/formatter choice, directly gates both #1 and #2
- `vitest.config.ts` — test framework + coverage provider/thresholds
- `.github/workflows/ci.yml` — CI pipeline (install, typecheck, lint, test+coverage, build)
- `CLAUDE.md` (project root) — SOLID/clean-code conventions doc, required by #2
- `openspec/config.yaml` — must be updated after #1 lands (flip `strict_tdd: true`, fill `testing.runner`, `verify.test_command`, `verify.coverage_threshold`) — noted in file already as a to-do
- `.backlog/config.yml` — unaffected, just tracks issue state

## Approaches

### 1. Linter/formatter: ESLint+typescript-eslint+eslint-plugin-astro+Prettier vs Biome vs Hybrid

1. **ESLint (flat config) + typescript-eslint (strict-type-checked) + eslint-plugin-astro + Prettier** — mature, first-class `.astro` parsing via `astro-eslint-parser` (officially documented by Astro), type-aware rules (`no-floating-promises`, `no-unsafe-*`) work fully, huge plugin ecosystem covers #2's mechanical rules (`@typescript-eslint/naming-convention`, `complexity`, `sonarjs/cognitive-complexity`, `eslint-plugin-boundaries` for layer/DI-adjacent import rules).
   - Pros: full Astro support (not experimental), best plugin coverage for SOLID-adjacent rules, well-documented CI recipes.
   - Cons: two tools (lint + format) to configure and keep in sync, slower than Biome on large repos (less relevant at scaffold size).
   - Effort: Low-Medium.
2. **Biome only** — single Rust-based tool, built-in formatter, 10-25x faster, zero-config baseline, `.astro` support since v2.3 but explicitly **experimental**: only lints/formats the `<script>`/`<style>` blocks, not Astro template control-flow syntax, and has no equivalent to `eslint-plugin-boundaries` yet for architecture-layer enforcement.
   - Pros: single tool, minimal config, fast, good for "avoid setup friction" goal.
   - Cons: experimental Astro coverage is a real gap for a project whose whole point is Astro `.astro` components; no mature import-boundary/architecture-layer rule; SOLID-adjacent rule set (complexity, naming) exists but is thinner than the ESLint ecosystem's.
   - Effort: Low.
3. **Hybrid — Biome for formatting/base speed + ESLint (typescript-eslint+astro) for type-aware/Astro-specific/architecture rules** — best rule coverage.
   - Pros: fastest formatting, full Astro + architecture rule coverage.
   - Cons: two tools, config overlap/conflict risk (must disable Biome's own lint or ESLint's formatting rules to avoid double-reporting), more onboarding friction — directly contradicts the explicit non-goal ("avoid high setup friction") already recorded for this project.
   - Effort: Medium.

### 2. Test framework

Only one realistic option given the stack decision: **Vitest**, since Astro's build is Vite-based. Astro's official docs expose a `getViteConfig()` helper to merge Astro's Vite config into `vitest.config.ts` (aliases, env, etc.) so component/unit tests resolve the same way the app does. Coverage via `@vitest/coverage-v8` (V8 native coverage, fastest, no instrumentation step) or `@vitest/coverage-istanbul` (more granular branch data, slower). V8 provider is the pragmatic default for a scaffold-stage gate.

### 3. CI coverage gate wiring (GitHub Actions)

1. **Threshold enforcement inside `vitest.config.ts`** (`test.coverage.thresholds.{lines,functions,branches,statements}`) — Vitest itself exits non-zero when a threshold is missed, so the CI step `vitest run --coverage` becomes the hard gate; no separate coverage-checking action needed. GitHub branch protection then just requires that CI job to pass.
   - Pros: single source of truth for the threshold (in-repo, versioned, testable locally), no extra Action dependency, matches acceptance ("a PR under the coverage threshold fails the gate").
   - Cons: none material for a repo already committing to a Vitest-native gate.
   - Effort: Low.
2. **Third-party reporting Action** (e.g. `davelosert/vitest-coverage-report-action`) layered on top of (1) for a PR comment/step-summary — purely additive visibility, not a gate by itself (it reports, it doesn't fail the build unless separately configured to).
   - Pros: nicer PR reviewer experience (inline coverage diff).
   - Cons: extra dependency, not required to satisfy the acceptance criteria.
   - Effort: Low (optional add-on, not core).

Suggested CI job order: install (with lockfile cache) -> typecheck (`astro check` + `tsc --noEmit`) -> lint (`eslint .` or `biome ci .`) -> test with coverage (`vitest run --coverage`) -> build (`astro build`). Fail-fast on first red step.

**Real constraint found**: issue #1's acceptance says "CI runs on an empty scaffold," but a truly empty `src/` gives Vitest zero coverable files — with thresholds configured, Vitest either reports trivially-passing 0/0 coverage (not a real gate proof) or errors "no test files found" (fails, but not for the right reason). Recommend seeding exactly one trivial, clearly-scaffolding-only module + matching unit test (e.g., a version/config-echo helper, not domain/content logic) purely so the coverage gate has something real to compute against and can be demonstrated to fail when a PR adds code without tests. This keeps "no feature code" intact (issue #1 explicitly puts feature code and the content model out of scope) while making the acceptance criterion actually testable, and that placeholder should be treated as disposable/replaceable once real feature code lands.

### 4. Clean code / SOLID rule set — mechanical (linter) vs guidance-only (CLAUDE.md / review)

**Mechanically enforceable today:**
- Naming casing: `@typescript-eslint/naming-convention` (camelCase functions/vars, PascalCase types/classes/Astro components, UPPER_CASE constants).
- Complexity limits (SRP proxy): `complexity` (cyclomatic), `sonarjs/cognitive-complexity`, `max-lines-per-function`, `max-lines` per file, `max-depth`, `max-params`.
- Strict-TS hygiene: `noImplicitAny`/`strict` in tsconfig, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/explicit-function-return-type`, `@typescript-eslint/no-floating-promises` (type-aware, needs the type-checked ESLint config).
- Duplication smells: `sonarjs/no-duplicate-string`, `sonarjs/no-identical-functions`.
- Layer boundaries (directly serves the content/view-separation requirement already in `openspec/config.yaml`'s design rules): `eslint-plugin-boundaries` or `import/no-restricted-paths` to forbid, e.g., content-model modules importing from presentation directories or vice versa.
- A narrow, enforceable slice of "DI in practice": ban direct access to ambient globals (`process.env`, singletons) outside a designated composition-root/config module via `no-restricted-imports`/`no-restricted-syntax` — this doesn't enforce good DI design, but it does mechanically stop the most common DI-defeating anti-pattern (reaching for global state anywhere in the codebase).

**Not mechanically enforceable — must stay documented review guidance in CLAUDE.md:**
- True Single Responsibility (does this module conceptually do one thing) — complexity/line-count limits are only a proxy, not a semantic check.
- Whether an abstraction/interface is well-designed (Open/Closed, Liskov substitutability, Interface Segregation) — no generic linter rule verifies substitutability or interface cohesion.
- Whether DI is used *well* (constructor injection vs justified direct instantiation) — linters can forbid specific anti-patterns but can't certify "good" DI usage.
- Intent-revealing naming beyond casing conventions.
- Avoiding premature abstraction / over-engineering.

This split gives issue #2 a concrete acceptance path: CLAUDE.md documents all of the above (mechanical + guidance), the linter config enforces the mechanical subset, and a sample violation (e.g., a function exceeding the complexity/line limit, or an `any` type) fails CI through the same lint step already gating #1.

## Recommendation

For the linter/formatter axis: start with **ESLint (flat config) + typescript-eslint strict-type-checked + eslint-plugin-astro + Prettier**, not Biome and not the hybrid, because Astro `.astro` support is this project's core surface and Biome's is still explicitly experimental, and the hybrid's dual-tool overhead directly conflicts with this project's own recorded goal of avoiding high setup friction. Revisit Biome once its Astro support leaves experimental status — Biome's roadmap explicitly targets this.

Test framework: Vitest with `getViteConfig()` and `@vitest/coverage-v8`, no real alternative given the Astro/Vite base.

Coverage gate: enforce thresholds natively in `vitest.config.ts` so `vitest run --coverage` is the CI gate itself; treat any PR-comment reporting action as optional polish, not the gate.

Clean-code rules: encode the mechanical subset in the same ESLint config already required for #1 (single lint step gates both issues), and write the non-mechanical subset into CLAUDE.md as explicit, named review guidance rather than pretending a linter can verify it — this keeps issue #2's acceptance ("linter config enforces the mechanical ones") honest instead of over-promising automated SOLID enforcement.

Recommend treating issues #1 and #2 as one SDD change (shared spec/design/tasks) given #2 is explicitly scoped as "wiring into the CI coverage gate from the parent epic" — splitting them would mean re-touching the same `eslint.config.js` and `.github/workflows/ci.yml` twice.

## Risks

- Empty-scaffold coverage gate has no coverable code by default — needs a deliberate, disposable placeholder module+test (see CI wiring section) or the acceptance criterion "CI runs on an empty scaffold" cannot be meaningfully demonstrated.
- Biome's Astro support is experimental; if the team ever migrates to Biome-only later, `.astro` template-level lint coverage will need re-validation, not just a config swap.
- "DI" as a SOLID principle has only a narrow mechanically-enforceable slice (banning ambient-global access); overselling linter config as enforcing "SOLID" broadly could create a false sense of coverage — CLAUDE.md must be explicit about what is/isn't automated.
- `openspec/config.yaml` currently has `strict_tdd: false` and empty `verify.test_command`/`coverage_threshold` — these MUST be updated once #1 lands, per the note already present in that file, or subsequent SDD phases will keep assuming no test runner exists.
- No confidential client-specific detail is needed or referenced here; the "avoid repeating" lessons already generalized in the public README.md were the only prior-project context relevant to this scope.

## Ready for Proposal

Yes — enough concrete option comparison exists to move to `sdd-propose` for a combined change (suggested name: `repo-scaffold-ci-foundation`) covering both issue #1 and its child issue #2. The proposal should lock in: ESLint+typescript-eslint+eslint-plugin-astro+Prettier as the lint/format stack, Vitest+coverage-v8 as the test/coverage stack, native Vitest threshold as the CI gate mechanism, and the mechanical/guidance split for CLAUDE.md conventions.
