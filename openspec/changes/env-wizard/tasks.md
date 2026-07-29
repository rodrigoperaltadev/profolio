# Tasks: Env Var Setup Wizard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~550-750 (core logic module + its Vitest table-driven suite, thin CLI entry point, 5th `verify-*.mjs` build-time proof script, `package.json` script additions, `.gitignore` line, README documentation) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 → PR3 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Note on the estimate and phase-count decision:** the proposal flagged ~400-600 lines with a possible 2-slice split. Breaking design's File Changes table down file-by-file pushes this higher than that: `env-wizard-core.mjs` alone exports 10 functions (line-based parse/merge/serialize model, 5 validators/generators), and its Vitest suite needs table-driven round-trip cases (parse/merge/serialize with unrelated-key and comment/blank preservation) plus per-function branch coverage for every validator — more test surface than either single test file in publishing-layer's Phase 2 (~175-210 combined for 2 files). Add the CLI's genuinely non-trivial prompt flow (skip-as-a-set logic, conditional branch prompt, keep/replace-per-key idempotency, PAT link + honesty note) and a 5th `verify-*.mjs` proof script, and the total sits closer to publishing-layer's 560-650 scale than theme-system's 380-450. The proposal's own suggested 2-slice boundary (tooling vs. runtime-wiring) is kept as the outer shape, but the "tooling" half is split again into core-logic-only vs. CLI, because core+its test suite alone is already close to the 400-line ceiling on its own and is the highest-logic-density, easiest-to-review-in-isolation unit — same "isolate the densest/riskiest unit first" pattern used in theme-system and publishing-layer.

### Suggested Work Units

Tracker branch `feature/env-wizard` (draft, no-merge until all children land). Cascade: PR3 → PR2 branch → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | `env-wizard-core.mjs` — parse/merge/serialize, validators, PAT-link builder, token generator (TDD) | `feat/env-wizard-core` (base: tracker) | ~370-440 | Pure logic, no I/O, no `.gitignore`/`package.json` changes; highest logic density and largest test surface; isolates the riskiest/densest module before the CLI or runtime depend on it |
| 2 | `setup-wizard.mjs` thin CLI + `.gitignore` fix + `setup` npm script | `feat/env-wizard-cli` (base: PR1) | ~150-220 | Consumes Unit 1's core module; readline I/O only, not unit-tested by design (thin-CLI precedent); `.gitignore` fix closes the credential-exposure gap this change would otherwise introduce |
| 3 | `dev`/`start`/`verify:env-file` npm scripts + `verify-env-file-loading.mjs` + README docs | `feat/env-wizard-runtime` (base: PR2) | ~150-220 | Highest-risk unit — first time this repo's `package.json` gains scripts that actually run the app; includes the mandatory empirical `dev`/`start` run and the real `verify-env-file-loading.mjs` execution |

## Phase 1: Core Logic Module (Unit 1 — satisfies CLI Entry Point and Testable Core Module [core half], Admin Access Token Generation Without Hashing, Format and Presence Validation Only, Honest PAT Template Link, Idempotency Check Never Reads process.env, Unit-Tested Core Logic)

- [x] 1.1 RED: `scripts/lib/env-wizard-core.test.mjs` — `parseEnvFile()`: `KEY=value` lines become `{type:"entry"}`, surrounding `"`/`'` stripped from the value, `#`-prefixed and blank lines become `{type:"raw"}` passthrough, order preserved — fails, module doesn't exist
- [x] 1.2 GREEN: create `scripts/lib/env-wizard-core.mjs` — `parseEnvFile(text)` per design's line-based `EnvLine` model
- [x] 1.3 RED→GREEN: `getEntryValue(lines, key)` — returns the value for an existing key, `undefined` for a missing one
- [x] 1.4 RED→GREEN: `mergeEnvEntries(lines, answers)` — table-driven: updates an existing key's value, appends a brand-new key, leaves keys absent from `answers` untouched, and — critically — leaves every `{type:"raw"}` line (comments, blank lines, unrelated existing keys) byte-for-byte unchanged
- [x] 1.5 RED→GREEN: `serializeEnv(lines)` — round-trips `parseEnvFile` output back to text with a trailing newline; combined with 1.1-1.4, assert a full parse→merge→serialize round trip preserves comments/blank lines and unrelated keys exactly (the spec's "never touched or dropped" requirement)
- [x] 1.6 RED→GREEN: `maskSecret(value)` — boundary table: `value.length <= 8` fully masked with `*`, longer values show first 4 + last 4 chars with `*` for the rest
- [x] 1.7 RED→GREEN: `isNonEmpty(value)`, `looksLikeGithubToken(value)` (accepts `ghp_`/`github_pat_`/`gho_`/`ghu_`/`ghs_`/`ghr_` prefixes, rejects others), `isRepoSlug(value)` — table-driven valid/invalid cases for each
- [x] 1.8 RED→GREEN: `generateAdminToken()` — asserts length (64 hex chars) and hex-format via regex, never asserts an exact value (non-deterministic by design)
- [x] 1.9 RED→GREEN: `buildPatTemplateUrl({ name, description })` — exact query string assertion: only `name`, `description`, `contents=write` present, no repo-scoping parameter
- [x] 1.10 Verify: `npm run test` (coverage) exits 0 for `env-wizard-core.test.mjs`, all four metrics non-vacuous
- [x] 1.11 Verify: `npm run lint` and `npm run typecheck` exit 0; confirm by inspection that `env-wizard-core.mjs` contains no `process.env` read anywhere (satisfies "Idempotency Check Never Reads process.env" and needs no `no-restricted-syntax` exception)
- [x] 1.12 Commit as one work unit; open PR1 → tracker branch `feature/env-wizard`

## Phase 2: Thin CLI Wizard + .gitignore (Unit 2 — satisfies CLI Entry Point and Testable Core Module [CLI half], GitHub Publishing Prompt Group, Conditional Content Branch Prompt, Theme Preset Confirmation, Idempotent .env Handling with Masked Display, .env Exclusion from Version Control)

- [ ] 2.1 Create `scripts/setup-wizard.mjs` — `readline/promises` CLI entry point; imports `env-wizard-core.mjs`; does the only fs I/O (`fs.readFileSync`/`writeFileSync` against `.env`); holds no parse/merge/serialize/validation logic of its own (delegates all of it to the core module)
- [ ] 2.2 Wire prompt order per spec: (1) GitHub publishing yes/no — declining skips `GITHUB_TOKEN`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` together, none are prompted or written; accepting requires all three non-empty, re-prompting on empty/invalid input using `core.isNonEmpty`/`core.looksLikeGithubToken`/`core.isRepoSlug`
- [ ] 2.3 Wire `GITHUB_CONTENT_BRANCH` prompt — only asked when GitHub publishing is being configured, optional, defaults to `"main"` when left blank
- [ ] 2.4 Wire `ADMIN_ACCESS_TOKEN` prompt — offered whenever GitHub vars are being configured; operator chooses generate (`core.generateAdminToken()`) or supplies a custom value; written verbatim either way, no hashing step
- [ ] 2.5 Wire `THEME_PRESET` prompt — confirm-or-override, defaulting to `"brutalist"`
- [ ] 2.6 Wire idempotent existing-`.env` flow: if `.env` exists, parse it via `core.parseEnvFile`, show each of the wizard's known keys' current value via `core.getEntryValue` + `core.maskSecret`, let the operator keep or replace each key individually; merge answers via `core.mergeEnvEntries` and write via `core.serializeEnv`
- [ ] 2.7 Print the PAT template link (`core.buildPatTemplateUrl`) plus an explicit CLI-output note that repository scoping is not pre-confirmed and must be selected manually in GitHub's UI
- [ ] 2.8 Add `.env` and `.env.*` to `.gitignore`
- [ ] 2.9 Add `setup` npm script to `package.json`: `"setup": "node scripts/setup-wizard.mjs"`
- [ ] 2.10 Manual smoke test: run `npm run setup` against no existing `.env`, decline GitHub publishing, confirm `GITHUB_TOKEN`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME`/`GITHUB_CONTENT_BRANCH` are never prompted and not written; confirm `THEME_PRESET=brutalist` is written on default-confirm
- [ ] 2.11 Manual smoke test: re-run `npm run setup` against the `.env` from 2.10, accept GitHub publishing this time, confirm all three GitHub fields are now required and validated locally (malformed `GITHUB_REPO_NAME` is rejected and re-prompted, no network call is made); confirm the PAT link + manual-scoping note are printed
- [ ] 2.12 Manual smoke test: hand-add an unrelated key to `.env` outside the wizard's known surface, re-run `npm run setup`, confirm that key and its value survive in the written file untouched; confirm an existing secret is displayed masked (not in full) before the keep/replace choice
- [ ] 2.13 **Real verification (not assumed) — carry-forward item 3:** after 2.10-2.12 have written a real `.env`, run `git status` and `git check-ignore -v .env`; confirm `.env` is reported as ignored and does not appear as trackable/staged
- [ ] 2.14 Verify: `npm run lint` and `npm run typecheck` exit 0
- [ ] 2.15 Commit as one work unit; open PR2 → PR1 branch

## Phase 3: Runtime `--env-file` Wiring + Build-Time Proof (Unit 3 — satisfies Runtime Env Loading for dev and start)

- [ ] 3.1 Add `dev` script to `package.json`: `"dev": "node --env-file=.env node_modules/astro/bin/astro.mjs dev"`
- [ ] 3.2 Add `start` script to `package.json`: `"start": "node --env-file=.env dist/server/entry.mjs"`
- [ ] 3.3 **Empirical verification (mandatory, do first — carry-forward item 1a):** with a real `.env` present (e.g. from Phase 2's smoke tests, containing `THEME_PRESET`/`ADMIN_ACCESS_TOKEN`), actually run `npm run dev`; confirm the dev server starts cleanly (no `node: bad option: --env-file` error) and the running process observes a `.env`-configured value — do not assume the invocation shape from design's confirmed `bin.astro` field alone
- [ ] 3.4 **Empirical verification (mandatory — carry-forward item 1b):** run `npm run build`, then actually run `npm run start` against the same `.env`; confirm the built entry point starts cleanly and observes the same `.env`-configured value (e.g. via the admin gate's `ADMIN_ACCESS_TOKEN` behavior, reusing `verify-admin-server.mjs`'s proven request pattern as a manual check)
- [ ] 3.5 Create `scripts/verify-env-file-loading.mjs` — 5th build-time proof script; spawns the built `dist/server/entry.mjs` via `node --env-file=.env` (not the `env:` option injection `verify-admin-server.mjs` uses) against a script-written throwaway `.env`; asserts the spawned process actually observes a value that was written to that file and never passed through the parent process's own environment — proving `--env-file` itself, not just env-driven behavior
- [ ] 3.6 Add `verify:env-file` npm script to `package.json`; add a corresponding step to `.github/workflows/ci.yml` after the existing verify steps, matching the other four `verify-*.mjs` CI entries
- [ ] 3.7 **Real run (not author-and-assume) — carry-forward item 2:** actually execute `npm run verify:env-file`; confirm it exits 0 against the real build, not a mocked/assumed one
- [ ] 3.8 Document in `README.md`: new "Setup" section covering `npm run setup`, the Node ≥20.6 requirement for `--env-file` (CI pinned to 22), and that `npm run dev`/`npm run start` now load `.env` automatically
- [ ] 3.9 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint`, `npm run build` all exit 0
- [ ] 3.10 Commit as one work unit; open PR3 → PR2 branch (final child; cascades to tracker → main)

## Next Step

Ready for `sdd-apply`, starting with PR1 (Phase 1). Given `auto-chain`, proceed with Unit 1 without further confirmation; re-check the Review Workload Forecast per-unit estimate as each PR's real diff lands, and re-verify the `dev`/`start`/`verify:env-file` invocation shapes empirically in Phase 3 rather than trusting the design's reading of Astro's package.json.
