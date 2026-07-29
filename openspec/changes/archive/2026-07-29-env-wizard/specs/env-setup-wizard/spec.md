# Env Setup Wizard Specification

## Purpose

Defines `scripts/setup-wizard.mjs` (run via `npm run setup`) and its separately-tested core module: a CLI that writes a correct, idempotent `.env` for the env var contracts already shipped by `publishing-config.ts`, `admin-auth.ts`, and `theme-config.ts`, plus the `dev`/`start` npm scripts that make `.env` actually load at runtime via `node --env-file=.env`. This spec formalizes how the wizard PRODUCES those values; it does not redefine the contracts themselves.

## Requirements

### Requirement: CLI Entry Point and Testable Core Module

`scripts/setup-wizard.mjs` MUST be a thin CLI entry point (readline I/O only) that delegates all `.env` parsing/merging/serialization, per-field validation, PAT-link construction, and token generation to a separately importable core module (e.g. `scripts/lib/env-wizard-core.mjs`).

#### Scenario: Core logic is importable without CLI execution

- GIVEN `scripts/lib/env-wizard-core.mjs`
- WHEN it is imported by a test file
- THEN its exported functions run without requiring stdin or invoking `scripts/setup-wizard.mjs`

#### Scenario: CLI entry point holds no untested business logic

- GIVEN the coverage report
- WHEN parse/merge/serialize/validate/token/PAT-link logic is attributed
- THEN it is attributed to the core module, not `scripts/setup-wizard.mjs`

### Requirement: GitHub Publishing Prompt Group (Skippable as a Set)

The wizard MUST prompt whether to configure GitHub publishing before asking for `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, or `GITHUB_REPO_NAME`. If declined, all three MUST be skipped together, leaving local-fallback mode intact. If accepted, all three MUST be required (non-empty).

#### Scenario: Declining skips all three vars

- GIVEN the operator declines GitHub publishing configuration
- WHEN the wizard proceeds
- THEN it never prompts for `GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, or `GITHUB_REPO_NAME` and none are written

#### Scenario: Accepting requires all three

- GIVEN the operator accepts GitHub publishing configuration
- WHEN any of the three fields is left empty
- THEN the wizard rejects and re-prompts that field

### Requirement: Conditional Content Branch Prompt

`GITHUB_CONTENT_BRANCH` MUST be prompted only when GitHub publishing is being configured, MUST be optional, and MUST default to `"main"` when left blank.

#### Scenario: Skipped when GitHub publishing is declined

- GIVEN the operator declined GitHub publishing
- WHEN the wizard runs
- THEN it never prompts for `GITHUB_CONTENT_BRANCH`

#### Scenario: Defaults to main when left blank

- GIVEN GitHub publishing is being configured
- WHEN the operator leaves `GITHUB_CONTENT_BRANCH` blank
- THEN the wizard writes `GITHUB_CONTENT_BRANCH=main`

### Requirement: Admin Access Token Generation Without Hashing

`ADMIN_ACCESS_TOKEN` MUST be optional, offered whenever GitHub vars are being configured, and satisfiable either by operator-supplied input or by a wizard-generated `crypto.randomBytes(32).toString("hex")` value. The wizard MUST NOT hash or otherwise transform the value before writing it, matching `checkAdminAuth()`'s direct comparison.

#### Scenario: Generated token is written verbatim

- GIVEN the operator selects "generate"
- WHEN the wizard writes `.env`
- THEN `ADMIN_ACCESS_TOKEN` is a 64-character hex string with no hashing applied

#### Scenario: Custom token is accepted verbatim

- GIVEN the operator supplies a custom token value
- WHEN the wizard writes `.env`
- THEN the value is stored exactly as entered, unhashed

### Requirement: Theme Preset Confirmation

The wizard MUST prompt to confirm or override `THEME_PRESET`, defaulting to `"brutalist"`, the only preset recognized by `theme-config.ts` today.

#### Scenario: Confirming keeps the default

- GIVEN the operator accepts the default prompt
- WHEN the wizard writes `.env`
- THEN `THEME_PRESET=brutalist` is written

### Requirement: Format and Presence Validation Only

The wizard MUST validate `GITHUB_TOKEN` (plausible PAT prefix), `GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` (slug shape), and required-field presence using local checks only. It MUST NOT make a live GitHub API call to verify token validity or scope.

#### Scenario: Malformed input is rejected locally

- GIVEN the operator enters a `GITHUB_REPO_NAME` containing invalid characters
- WHEN the wizard validates the input
- THEN it is rejected and re-prompted without any network call

#### Scenario: No network call is made

- GIVEN a complete wizard run with valid-format inputs
- WHEN GitHub-related fields are validated
- THEN no HTTP request is issued to any GitHub API endpoint

### Requirement: Idempotent .env Handling with Masked Display

When `.env` already exists, the wizard MUST parse it, display each of its own known keys' current value with secrets masked (first/last few characters only), and let the operator keep or replace each key individually. Keys outside the wizard's known surface MUST be preserved untouched.

#### Scenario: Existing secret is shown masked

- GIVEN an existing `.env` with `GITHUB_TOKEN` set
- WHEN the wizard re-runs
- THEN it displays the value with only its first/last few characters visible, never in full

#### Scenario: Keeping a key preserves its value

- GIVEN the operator chooses "keep" for an existing key
- WHEN the wizard writes `.env`
- THEN that key's original value is unchanged

#### Scenario: Unrelated existing keys are never touched or dropped

- GIVEN `.env` contains a key the wizard does not manage
- WHEN the wizard writes `.env`
- THEN that key and its value remain present and unmodified

### Requirement: Honest PAT Template Link

The wizard MUST print a GitHub fine-grained PAT template link pre-filling only the confirmed parameters (`name`, `description`, `contents=write`) and MUST state explicitly, in the same output, that repository scoping is not pre-confirmed and must be selected manually by the operator.

#### Scenario: Link omits unconfirmed parameters

- GIVEN the printed PAT template link
- WHEN its query parameters are inspected
- THEN only `name`, `description`, and `contents=write` are present, with no repo-scoping parameter asserted

#### Scenario: Manual scoping note is shown

- GIVEN the PAT link is printed
- WHEN the operator reads the wizard output
- THEN an explicit note states repository selection must be done manually in GitHub's UI

### Requirement: .env Exclusion from Version Control

`.gitignore` MUST exclude `.env` and `.env.*` so any `.env` file written by the wizard is never tracked by git.

#### Scenario: Freshly written .env is untracked

- GIVEN the wizard has just written `.env`
- WHEN `git status` is checked
- THEN `.env` does not appear as trackable or staged

### Requirement: Runtime Env Loading for dev and start

`package.json` MUST provide `dev` and `start` npm scripts that invoke their respective processes with `node --env-file=.env`, so `.env` values are actually loaded at runtime; no equivalent loading mechanism exists in this repo today for either the dev server or the built entry point.

#### Scenario: dev script loads .env

- GIVEN a `.env` file with `THEME_PRESET` set
- WHEN `npm run dev` starts the dev server via `--env-file=.env`
- THEN the running process observes the configured `THEME_PRESET` value

#### Scenario: start script loads .env

- GIVEN a built app and a `.env` file with configured values
- WHEN `npm run start` runs the built entry point via `--env-file=.env`
- THEN the running process observes the `.env`-configured values

### Requirement: Idempotency Check Never Reads process.env

The wizard's check for an existing `.env` and its current values MUST read the `.env` file's own text content directly; it MUST NOT read any target key via `process.env.KEY`, so the script requires no `no-restricted-syntax` lint exception.

#### Scenario: Existing values come from the file, not the environment

- GIVEN a shell environment variable `GITHUB_TOKEN` is set but no `.env` file exists
- WHEN the wizard checks for existing values
- THEN it reports no existing `GITHUB_TOKEN` value, since only file content is read

### Requirement: Unit-Tested Core Logic

All core wizard logic (parse/merge/serialize `.env`, per-field validators, PAT-link builder, token generator) MUST be covered by Vitest unit tests with stdin prompting and file I/O mocked, counting toward the 80% coverage gate.

#### Scenario: Core module tests run without real file I/O

- GIVEN the core module's test suite
- WHEN tests execute
- THEN file reads/writes are mocked, not performed against the real filesystem

#### Scenario: Coverage gate reflects real logic

- GIVEN the full wizard test suite
- WHEN the Vitest v8 coverage report is generated
- THEN core module branches (validators, merge logic, token generation, PAT-link construction) meet the 80% threshold non-vacuously
