# Design: Repo Scaffold & CI Foundation (with Clean Code/SOLID Conventions)

## Technical Approach

One combined change, root-level config (standard Node/Astro tooling discovery), a single CI job with fail-fast sequential steps, and one disposable placeholder module so the coverage gate has something real to compute against. Tool choices (ESLint flat config + typescript-eslint `strict-type-checked` + `eslint-plugin-astro` + Prettier; Vitest + `@vitest/coverage-v8`; native Vitest threshold gate) are locked per `exploration.md` and not revisited here. This design fixes the concrete shape: file layout, CI step order, placeholder content, the mechanical ESLint rule set, and `AGENTS.md` structure.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Placeholder location/shape | `src/lib/scaffold/scaffold-info.ts` + co-located `.test.ts`, JSDoc-flagged as disposable | Root-level throwaway file; a "hello world" script | `src/lib/scaffold/` reads as obviously infrastructure, not domain/content code; co-location with test is the project's testing convention going forward |
| Layer boundaries enforcement timing | Encode `eslint-plugin-boundaries` element-type patterns now (`content`, `view`, `config`, `lib`), pointing at future dirs that don't exist yet | Defer boundaries config until content model lands | `config.yaml` design rule mandates content/view separation from day one; a dormant glob pattern costs nothing and auto-activates the moment those dirs appear, without pre-creating empty speculative folders (which would be out-of-scope "content model") |
| DI-adjacent mechanical rule | `no-restricted-syntax` bans `process.env` member access everywhere except files matching `src/config/**` | `eslint-plugin-boundaries` custom rule; no rule at all | Simplest mechanical proxy for "don't reach for ambient globals anywhere"; the allow-path is forward-declared the same way as the layer folders, no code required now |
| CI job topology | Single job, one runner, five sequential steps, default fail-fast | Matrix across Node versions; parallel jobs per check | Scaffold-stage repo has one deploy target and no version matrix need; parallel jobs would add YAML complexity with no reviewer benefit yet |
| Formatting authority | Prettier owns formatting; `eslint-config-prettier` disables ESLint's stylistic rules | ESLint stylistic rules only; Biome formatter | Avoids the two-tools-disagreeing-on-style class of CI flakiness; Prettier is the de facto standard already assumed in the proposal |

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Create | Scripts: `typecheck`, `lint`, `test`, `build` (see Interfaces) |
| `tsconfig.json` | Create | `strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `eslint.config.js` | Create | Flat config; see ESLint Config Structure below |
| `.prettierrc.json`, `.prettierignore` | Create | Prettier defaults + ignore `dist/`, `.astro/` |
| `vitest.config.ts` | Create | `getViteConfig()` + coverage thresholds 80% (lines/functions/branches/statements) |
| `.github/workflows/ci.yml` | Create | Single `quality-gate` job, 5 steps |
| `src/lib/scaffold/scaffold-info.ts` | Create | Disposable placeholder module |
| `src/lib/scaffold/scaffold-info.test.ts` | Create | Unit test proving the coverage gate is real |
| `AGENTS.md` | Create | Mechanical vs. guidance conventions (cross-tool standard — read natively by Claude Code, Cursor, OpenCode, and 30+ other agents; not tool-specific like `CLAUDE.md`) |
| `openspec/config.yaml` | Modify | `strict_tdd: true`, fill `testing.*`, `verify.test_command`/`coverage_threshold` |

## ESLint Config Structure (mechanical clean-code subset)

```js
// eslint.config.js
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...astro.configs.recommended,
  {
    plugins: { sonarjs, boundaries },
    settings: {
      "boundaries/elements": [
        { type: "content", pattern: "src/content/**" },
        { type: "view", pattern: "src/presentation/**" },
        { type: "config", pattern: "src/config/**" },
        { type: "lib", pattern: "src/lib/**" },
      ],
    },
    rules: {
      "@typescript-eslint/naming-convention": ["error",
        { selector: "default", format: ["camelCase"] },
        { selector: "variable", format: ["camelCase", "UPPER_CASE"] },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["UPPER_CASE"] },
      ],
      complexity: ["error", 10],
      "sonarjs/cognitive-complexity": ["error", 15],
      "max-lines-per-function": ["error", { max: 50, skipBlankLines: true, skipComments: true }],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-depth": ["error", 3],
      "max-params": ["error", 4],
      "sonarjs/no-duplicate-string": "error",
      "sonarjs/no-identical-functions": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "no-restricted-syntax": ["error", {
        selector: "MemberExpression[object.object.name='process'][object.property.name='env']",
        message: "process.env access only allowed in src/config/**. Inject config instead.",
      }],
      "boundaries/element-types": ["error", {
        default: "disallow",
        rules: [
          { from: "content", allow: ["lib"] },
          { from: "view", allow: ["lib", "content"] },
          { from: "lib", allow: ["lib"] },
          { from: "config", allow: ["lib"] },
        ],
      }],
    },
  },
  { files: ["src/config/**"], rules: { "no-restricted-syntax": "off" } },
  eslintConfigPrettier,
);
```

## Data Flow — CI Pipeline

    checkout ──▶ setup-node (cache: npm) ──▶ npm ci
         ──▶ typecheck (astro check && tsc --noEmit)
         ──▶ lint (eslint .)
         ──▶ test (vitest run --coverage)   ← 80% gate, fails build on miss
         ──▶ build (astro build)

Single job `quality-gate`; each step's non-zero exit stops the job (default GitHub Actions fail-fast per-job).

## Interfaces / Contracts

```ts
// src/lib/scaffold/scaffold-info.ts
// SCAFFOLD PLACEHOLDER — delete once real feature code exists (see openspec issue #1).
export interface ScaffoldInfo {
  readonly name: string;
  readonly version: string;
}

export function getScaffoldInfo(pkg: { name: string; version: string }): ScaffoldInfo {
  return { name: pkg.name, version: pkg.version };
}
```

`package.json` script names are a contract the CI workflow depends on verbatim: `typecheck`, `lint`, `test`, `build`. Renaming any of them requires updating `.github/workflows/ci.yml` in the same commit.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `getScaffoldInfo` pure transformation | Vitest, co-located `.test.ts`, asserts pass-through mapping |
| Integration | N/A — no integration surface exists yet | Deferred to the change that adds the content model |
| E2E | N/A | Deferred |
| Gate proof | A sample violation fails CI | Manual PR during apply: add one function exceeding `complexity`/`max-lines-per-function` — expect lint step to fail |

## AGENTS.md Structure

1. **Purpose** — one paragraph: this file is binding for contributors and AI agents.
2. **Enforced by Linter (mechanical)** — table: rule id → what it catches → tool (naming-convention, complexity, cognitive-complexity, max-lines-per-function, max-lines, max-depth, max-params, no-duplicate-string, no-identical-functions, no-explicit-any, no-floating-promises, no-restricted-syntax for `process.env`, boundaries/element-types).
3. **Human Review Guidance (not automatable)** — bullet list, one per exploration's non-mechanical items (true SRP, abstraction/interface quality, DI design quality beyond the ambient-global ban, intent-revealing naming, avoiding premature abstraction), each phrased as a review question, not a rule.
4. **Scaffold Note** — explains `src/lib/scaffold/scaffold-info.ts` is disposable and why it exists.
5. **CI Gate Reference** — points to `.github/workflows/ci.yml` and states the 80% coverage threshold and where it's configured (`vitest.config.ts`).

## Migration / Rollout

No migration required — first commit to an empty repo, all files are additive.

## Open Questions

None blocking. All prior tool-choice ambiguity was resolved in `exploration.md`.
