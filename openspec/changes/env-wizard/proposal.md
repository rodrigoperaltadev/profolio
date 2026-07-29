# Proposal: Env Var Setup Wizard

Cross-references: GitHub #7 (this change), #4 (publishing-layer, archived — supplies `GITHUB_TOKEN`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME`/`GITHUB_CONTENT_BRANCH` via `publishing-config.ts`), #5 (admin-ui, archived — supplies `ADMIN_ACCESS_TOKEN` via `admin-auth.ts`, explicitly deferred this wizard), #6/theme-system (archived — supplies `THEME_PRESET` via `theme-config.ts`).

## Intent

Three archived changes (#4, #5, #6) each added env vars their own config readers expect, but nothing in the repo helps an operator actually set them, and — more critically — nothing in the repo actually *loads* a `.env` file at runtime: not `astro dev`, not the built `node dist/server/entry.mjs` process. Today, configuring Profolio means hand-writing a `.env` file that the running process never reads, then discovering that fact only when publishing/admin/theme features silently fail closed. Issue #7 closes both gaps: a CLI wizard that writes a correct `.env`, and real `--env-file` wiring so that file is actually consumed.

## Scope

### In Scope

- `scripts/setup-wizard.mjs` — plain Node CLI wizard, following the existing `scripts/verify-*.mjs` precedent (no new framework, no web route), run via a new `npm run setup` script
- Prompts, in order: (1) whether to configure GitHub publishing at all — if declined, `GITHUB_TOKEN`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` are skipped together and the operator stays in local-fallback mode; if accepted, all three are required as a set; (2) `GITHUB_CONTENT_BRANCH` (optional, default `"main"`, only asked if GitHub publishing is being configured); (3) `ADMIN_ACCESS_TOKEN` (optional, generate-random or accept-custom, strongly recommended — not forced — whenever GitHub vars are being configured, since `checkAdminAuth()` fails closed without it); (4) `THEME_PRESET` (optional, default/confirm `"brutalist"`, presented honestly as "confirm or override" rather than a real menu, since it is the only preset that exists today)
- Format/presence-only validation for v1: non-empty checks, a plausible PAT-prefix check for `GITHUB_TOKEN`, slug-shape checks for `GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` — no live GitHub API call
- `ADMIN_ACCESS_TOKEN` generation via `crypto.randomBytes(32).toString("hex")` (256-bit, 64 hex chars) when the operator chooses "generate" — no hashing step, matching `checkAdminAuth()`'s direct `timingSafeStringEqual` comparison
- Idempotent `.env` handling: if `.env` already exists, parse it, show each of the wizard's known keys' current value (secrets masked to first/last few characters), and let the operator keep or replace each one individually; any existing key outside the wizard's known surface is preserved untouched
- A printed GitHub fine-grained PAT template link (`github.com/settings/personal-access-tokens/new?...`) pre-filling `name`/`description`/`contents=write`, with an explicit, honest note that per-repo pre-scoping is not confirmed and the operator must select the target repository manually in GitHub's UI
- `.gitignore` fix: add `.env` (and `.env.*` local-override variants) — currently NOT excluded, so a wizard writing real credentials into it would otherwise be a security regression
- New `dev`/`start` npm scripts using Node's native `--env-file=.env` flag (Node ≥20.6; CI is pinned to Node 22, confirmed in `.github/workflows/ci.yml`) so `astro dev` and the built `node dist/server/entry.mjs` process actually load `.env` — neither script exists today
- Real unit tests (Vitest) for the wizard's actual logic — env-file parse/merge/serialize, per-field validation, PAT-link construction, token generation — with stdin prompting and file I/O isolated/mocked, split into a thin CLI entry point and a separately-tested core module

### Out of Scope

- Live GitHub API validation of token scope/access (format/presence only, matches this repo's "don't build beyond what's asked" pattern)
- The admin UI and publishing layer themselves (#5/#4, already built — this only configures them)
- A second `THEME_PRESET` option or any real preset-selection UX (only one preset exists; out of scope per #6)
- A static `.env.example` template file — the wizard itself is the onboarding mechanism; a template can be added later without contradicting this design
- Any change to `checkAdminAuth()`'s comparison mechanism, `publishing-config.ts`, or `theme-config.ts` — this change only reads their existing env var contracts

## Capabilities

### New Capabilities

- `env-setup-wizard`: `scripts/setup-wizard.mjs` (CLI) plus real `--env-file` runtime wiring in `dev`/`start` npm scripts — covers writing a correct, idempotent `.env` and making it actually load at runtime, for both dev and production processes

### Modified Capabilities

- None — this is additive tooling around already-established config contracts (`publishing-config.ts`, `admin-auth.ts`, `theme-config.ts`); none of their requirements change.

## Approach

**Script shape.** `scripts/setup-wizard.mjs` is a thin CLI entry point (readline prompts, calls into a separately importable core module, e.g. `scripts/lib/env-wizard-core.mjs`) holding the real, pure logic: `.env` parsing/merging/serialization, per-field validators, PAT-link construction, token generation. This split exists specifically so Vitest can unit-test the real logic with stdin/fs mocked at the thin boundary — avoiding the "vacuous coverage gate" trap this project has flagged in every prior change.

**No hashing for `ADMIN_ACCESS_TOKEN`** (unilateral call, not user-asked): confirmed directly in `src/config/admin-auth.ts` — `checkAdminAuth()` does a plain `timingSafeStringEqual` on the raw token, no hashed-password path exists anywhere in this codebase. The wizard only needs to generate or accept a plaintext value.

**`.gitignore` fix is in scope** (unilateral call): confirmed `.env` is not currently excluded. Writing real credentials to a git-tracked file would be a regression introduced by this very change if left unfixed.

**PAT link honesty** (unilateral call): GitHub's fine-grained PAT template URLs are real and do pre-fill `name`/`description`/scope params (per GitHub's 2025-08-26 changelog), but single-repo pre-selection was not confirmed during exploration. The wizard prints the link with the params that are confirmed, and states plainly — to the operator, in the CLI output, and in this proposal — that repo selection is manual. It does not assert a capability that was not verified.

**`no-restricted-syntax` (ambient `process.env` ban) does not need an exception for this script.** Checked `eslint.config.js` directly: the rule's selector matches three-level `process.env.KEY` member expressions and applies repo-wide except `src/config/**` (line 102) — there is currently no `scripts/**` override for it, unlike the `explicit-function-return-type`/type-checked overrides `scripts/**` already has. The wizard sidesteps this entirely by design: its idempotency check parses the `.env` file's own text content directly (it is a standalone tool that runs before any process ever loads that file), never reading `process.env.KEY`. No lint exception is requested or needed.

**Runtime env loading.** `dev`/`start` scripts invoke `node --env-file=.env` against Astro's dev CLI and the built `dist/server/entry.mjs` respectively. This is the first time `package.json` gains scripts for actually running the app (today only `typecheck`/`lint`/`test`/`build` exist) — exact invocation shape (e.g. `node --env-file=.env ./node_modules/astro/astro.js dev`) is verified empirically during design/apply, not assumed from documentation, consistent with this project's track record of real Astro-integration surprises.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `scripts/setup-wizard.mjs` | New | Thin CLI entry point: prompts, orchestration |
| `scripts/lib/env-wizard-core.mjs` (name indicative) | New | Real, unit-tested logic: parse/merge/serialize `.env`, validators, PAT-link builder, token generator |
| `scripts/setup-wizard.test.mjs` (+ core module tests) | New | Vitest coverage for all real logic above, I/O mocked |
| `package.json` | Modified | New `setup`, `dev`, `start` scripts; `dev`/`start` use `node --env-file=.env` |
| `.gitignore` | Modified | Add `.env` / `.env.*` local-override exclusion |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Exact `node --env-file=.env` invocation against Astro's CLI/built entry point doesn't work cleanly for this repo's Astro version | Medium | Verify empirically during design/apply against actual `node_modules/astro` layout and `dist/server/entry.mjs`; document the exact working command, not an assumed one |
| Wizard script or its core module is thinly tested, letting the 80% coverage gate pass vacuously (only possible today because Vitest's v8 provider doesn't count untested files unless `coverage.all` is set) | Medium | Core logic (validators, `.env` merge, PAT-link, token gen) lives in a separately imported, directly-tested module — not folded invisibly into the untested CLI entry point |
| Operator runs the wizard against an existing `.env` and loses previously-set values | Low-Medium | Idempotent per-key keep-or-replace flow; unrelated existing keys are never touched or dropped |
| `--env-file` requires Node ≥20.6; a contributor's local Node version predates it even though CI (Node 22) is fine | Low-Medium | Document the minimum Node version requirement plainly (README/HANDOFF); CI pin is verified, not assumed, per `.github/workflows/ci.yml` |
| PAT template link is read as "fully pre-configured" when repo-scoping isn't actually confirmed | Low | CLI output and this proposal both state explicitly that repo selection is manual |
| Generated `ADMIN_ACCESS_TOKEN` entropy is judged insufficient later | Low | 256-bit (`crypto.randomBytes(32)`) — same order of magnitude as common `openssl rand -hex 32` shared-secret generation |

## Rollback Plan

Remove `scripts/setup-wizard.mjs`, its core module, and their tests; remove the `setup`/`dev`/`start` entries from `package.json`; revert the `.gitignore` addition. No data migration — nothing this change writes is committed or shared state; a locally-existing `.env` file is untouched by reverting the code.

## Dependencies

- Depends on `publishing-config.ts` (#4, archived) for the exact `GITHUB_TOKEN`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME`/`GITHUB_CONTENT_BRANCH` contract.
- Depends on `admin-auth.ts` (#5, archived) for the exact `ADMIN_ACCESS_TOKEN` contract and its no-hashing comparison.
- Depends on `theme-config.ts` (#6, archived) for the exact `THEME_PRESET` contract and its current single-preset whitelist.
- Node ≥20.6 for `--env-file` support (CI pinned to 22, confirmed).

## Success Criteria

- [ ] `npm run setup` runs `scripts/setup-wizard.mjs`, prompting for the full env var surface in the documented order, with GitHub publishing vars skippable as a set
- [ ] Re-running the wizard against an existing `.env` shows current values (secrets masked) and lets the operator keep or replace each key individually, never silently dropping unrelated keys
- [ ] `ADMIN_ACCESS_TOKEN` can be generated (`crypto.randomBytes(32)`-based) or supplied by the operator, with no hashing step anywhere
- [ ] Wizard performs format/presence validation only — no live GitHub API call
- [ ] `.gitignore` excludes `.env`; a freshly-written `.env` is confirmed untracked by git
- [ ] `npm run dev` and `npm run start` both load `.env` via `node --env-file=.env`, verified empirically against this repo's actual Astro CLI/build output
- [ ] Wizard's core logic (parsing, merging, validation, PAT-link construction, token generation) is unit-tested with I/O mocked, not left untested inside the CLI entry point
- [ ] Coverage gate holds at 80% under strict TDD for all new testable logic

## Review Workload Forecast

- Estimated changed lines: ~400-600 (CLI entry point, core logic module, tests for both, `package.json` script additions, `.gitignore` line, README/HANDOFF documentation of the `--env-file` requirement). Sits near or over the 400-line budget depending on how thoroughly the core module's branches are tested.
- Chained PRs: Possibly. Natural two-slice split if needed: (1) wizard script + core module + tests + `.gitignore` fix (pure tooling, no runtime behavior change); (2) `package.json` `dev`/`start` scripts + `--env-file` wiring + verification (the actual runtime-loading behavior change, higher-risk review target since it touches the run/build surface for the first time).
- Decision needed before apply: Possibly — recommend the orchestrator re-check against the cached `delivery_strategy` once `sdd-tasks` produces exact line counts.

## Proposal question round

All product-level questions from exploration were answered by the user and are locked above (CLI script not a web route; `.env` writing plus real `--env-file` loading wiring; format/presence-only validation for v1). The additional calls this proposal makes unilaterally — no hashing for `ADMIN_ACCESS_TOKEN`, the `.gitignore` fix, PAT-link honesty, the exact prompt order/skip logic, idempotent per-key keep-or-replace behavior, 256-bit token entropy, and the `no-restricted-syntax` scoping finding — are flagged explicitly throughout Approach/Risks for review rather than presented as pre-approved.
