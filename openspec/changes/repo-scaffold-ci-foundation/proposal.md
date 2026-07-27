# Proposal: Repo Scaffold & CI Foundation (with Clean Code/SOLID Conventions)

Cross-references: GitHub #1 (epic, "Repo scaffold & CI foundation"), GitHub #2 (child, "Define & enforce clean code/SOLID conventions").

## Intent

Profolio has no scaffold: no `package.json`, `tsconfig.json`, lint/format config, test framework, CI, or `CLAUDE.md`. Per issue #1, this foundation must exist and be enforced by CI *before* any feature code is written, so the codebase never accumulates untyped, unlinted, untested, or unreviewed-convention code. Issue #2 extends this by requiring the clean-code/SOLID expectations to be both documented and mechanically enforced through the same CI gate, rather than left as unwritten tribal knowledge.

## Scope

### In Scope
- TypeScript strict configuration (`tsconfig.json`, `strict: true` + recommended strictness flags)
- ESLint (flat config) + typescript-eslint (`strict-type-checked`) + `eslint-plugin-astro` + Prettier
- Vitest + `@vitest/coverage-v8`, with coverage thresholds enforced natively as the CI gate
- One disposable placeholder module + unit test, solely to make the coverage gate demonstrable on an otherwise-empty scaffold
- GitHub Actions CI workflow: install → typecheck → lint → test+coverage → build
- `CLAUDE.md`: documents naming, SRP, complexity limits, DI conventions — split into mechanically-enforced rules (linter) vs. documented review guidance (semantic judgment calls)
- Update `openspec/config.yaml` testing/strict_tdd metadata once the runner exists

### Out of Scope
- Any feature code or content model (explicitly excluded by issue #1)
- Biome or a Biome/ESLint hybrid (Astro support still experimental; see exploration)
- Automated enforcement of non-mechanical SOLID principles (true SRP, abstraction quality, DI design quality) — these remain human review guidance only
- PR-comment coverage reporting actions (optional polish, not required for the gate)

## Capabilities

### New Capabilities
- `ci-quality-gate`: TS strict config, ESLint+Prettier, Vitest+coverage-v8, and the GitHub Actions workflow that fails on lint/type/test/coverage regressions
- `code-conventions`: `CLAUDE.md` documented clean-code/SOLID conventions plus the mechanically-enforceable subset wired into the same lint step

### Modified Capabilities
None.

## Approach

Single combined change (per exploration) since #2 wires into #1's same `eslint.config.js` and CI workflow. Vitest thresholds in `vitest.config.ts` are the gate itself — no third-party coverage-checking action. ESLint config carries both general TS rules and the mechanical clean-code subset (naming-convention, complexity, max-lines-per-function, sonarjs rules, boundaries/no-restricted-imports for the DI-adjacent rule). `CLAUDE.md` documents everything, marking clearly which rules are automated and which require review judgment.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `package.json`, `tsconfig.json` | New | Project init, TS strict mode |
| `eslint.config.js`, `.prettierrc` | New | Lint/format rules incl. mechanical clean-code subset |
| `vitest.config.ts` | New | Test runner + coverage thresholds (the CI gate) |
| `.github/workflows/ci.yml` | New | install/typecheck/lint/test+coverage/build pipeline |
| `CLAUDE.md` | New | Documented conventions (mechanical + guidance) |
| `openspec/config.yaml` | Modified | Flip `strict_tdd`, fill `testing`/`verify` fields once runner lands |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Empty scaffold has no coverable code, gate can't be demonstrated | High | Seed one disposable placeholder module+test |
| Overselling linter as "enforcing SOLID" broadly | Medium | CLAUDE.md explicitly separates mechanical vs. guidance rules |
| Biome's experimental Astro support tempts a premature switch later | Low | Documented as a future revisit, not part of this change |

## Rollback Plan

All changes are additive config/tooling files with no runtime feature code. Revert by removing the added files (`eslint.config.js`, `vitest.config.ts`, `.github/workflows/ci.yml`, `CLAUDE.md`, placeholder module+test) and reverting `tsconfig.json`/`package.json`/`openspec/config.yaml` via git; no data migration or deployed behavior is affected.

## Dependencies

- None external; this is the first build step for the repo.

## Success Criteria

- [ ] CI runs successfully on the scaffold with only the placeholder module present
- [ ] A PR introducing code without adequate coverage fails the CI gate
- [ ] `eslint .` passes clean on the scaffold
- [ ] `CLAUDE.md` documents naming, SRP, complexity, and DI conventions, marking mechanical vs. guidance-only
- [ ] A sample mechanical violation (e.g., a function exceeding complexity/line limits) fails CI
