# Design: Env Var Setup Wizard

## Technical Approach

Two-file split (per proposal): `scripts/lib/env-wizard-core.mjs` holds pure,
unit-tested logic (`.env` parse/merge/serialize, validators, PAT-link builder,
token generator). `scripts/setup-wizard.mjs` is a thin `readline/promises` CLI
that imports the core, prompts, and does the only I/O (read/write `.env`).
`package.json` gains `setup`, `dev`, `start` scripts; `dev`/`start` load
`.env` via Node's native `--env-file` flag against the *real*, verified Astro
entry points (see Architecture Decisions).

## Architecture Decisions

| Decision | Choice | Alternative(s) rejected | Rationale |
|---|---|---|---|
| `.env` parse model | Ordered list of `{type:"raw", raw}` \| `{type:"entry", key, value, raw}` lines | Plain `Record<string,string>` map | A map loses comments/blank lines/unrelated-key formatting. Line-based model lets `serialize` reproduce untouched lines byte-for-byte and only rewrite wizard-owned keys — required for "preserve unrelated keys untouched." |
| `.env` value syntax | `KEY=value`, optional surrounding `"`/`'` stripped, `#`-prefixed and blank lines passed through as raw | Full dotenv-spec parser (multiline, `export`, interpolation) | Proposal says "keep it minimal but correct." No existing `.env` in this repo uses advanced syntax; over-building contradicts the project's "don't build beyond what's asked" pattern already cited in the proposal. |
| `dev` script command | `node --env-file=.env node_modules/astro/bin/astro.mjs dev` | `node --env-file=.env node_modules/.bin/astro dev` | Confirmed `node_modules/astro/package.json` `bin.astro = "./bin/astro.mjs"`. `.bin/astro` is a symlink to that file on POSIX but a `.cmd`/`.ps1` shim on Windows — not executable by `node <path>`. `bin/astro.mjs` reads `process.argv` directly (`cli(process.argv)`), so `node <path> dev` is argv-identical to the shimmed CLI call on every OS. |
| `start` script command | `node --env-file=.env dist/server/entry.mjs` | Assume a `preview`/`serve` wrapper exists | `scripts/verify-admin-server.mjs` already spawns exactly `node dist/server/entry.mjs` (line 74) against the `@astrojs/node` standalone-adapter build output — proven working today, just without `--env-file`. Reusing the exact proven entry point removes guesswork. |
| Runtime `--env-file` proof | New 5th script `scripts/verify-env-file-loading.mjs` | Manual verification only | This repo has 4 prior `verify-*.mjs` scripts, each added specifically because a mock/unit test could not prove a real integration behavior. `--env-file` actually loading `.env` into a spawned process is exactly that class of claim (Risk table, proposal). `verify-admin-server.mjs` proves the auth *gate*; it injects env vars via the child's `env:` option — it does **not** prove `--env-file` itself works. A dedicated proof closes that specific gap. |
| PAT link params | Only `name`, `description`, `contents=write` on `https://github.com/settings/personal-access-tokens/new` | Attempt per-repo pre-scoping param (e.g. `target_name`) | Per-repo pre-fill was not confirmed during exploration (proposal, "PAT link honesty"). Printing only confirmed params avoids asserting an unverified capability; CLI output states repo selection is manual. |
| Secret masking | Show first 4 + last 4 chars, `*` for the rest; if `value.length <= 8`, mask everything | Show full value / show none | Balances operability (recognize *which* token) against not echoing secrets to a terminal/log in full. |

## Data Flow

    setup-wizard.mjs (CLI)
      ├─ fs.readFileSync(".env") [if exists] ──▶ core.parseEnvFile(text)
      ├─ readline prompts (uses core.maskSecret() to display current values)
      ├─ answers ──▶ core.mergeEnvEntries(parsed, answers)
      └─ core.serializeEnv(merged) ──▶ fs.writeFileSync(".env")

    dev:   node --env-file=.env node_modules/astro/bin/astro.mjs dev
    start: node --env-file=.env dist/server/entry.mjs
             │
             ▼ (both read process.env via src/config/*.ts at runtime)

## File Changes

| File | Action | Description |
|---|---|---|
| `scripts/lib/env-wizard-core.mjs` | Create | Pure logic: parse/merge/serialize, validators, PAT-link builder, token generator |
| `scripts/lib/env-wizard-core.test.mjs` | Create | Vitest coverage for all core functions |
| `scripts/setup-wizard.mjs` | Create | Thin CLI: readline prompts, calls core, does the only fs I/O |
| `scripts/verify-env-file-loading.mjs` | Create | 5th build-time proof script: spawns built server via `--env-file`, no manual `env:` injection |
| `package.json` | Modify | Add `setup`, `dev`, `start`, `verify:env-file` scripts |
| `.gitignore` | Modify | Add `.env`, `.env.*` |
| `README.md` | Modify | Document `npm run setup`, Node ≥20.6 requirement, `dev`/`start` |

## Interfaces / Contracts

```js
// scripts/lib/env-wizard-core.mjs
export function parseEnvFile(text)                          // -> EnvLine[]
export function getEntryValue(lines, key)                   // -> string | undefined
export function mergeEnvEntries(lines, answers)              // answers: Record<key, string|undefined>; -> EnvLine[]
export function serializeEnv(lines)                          // -> string (trailing newline)
export function maskSecret(value)                            // -> string
export function isNonEmpty(value)                             // -> boolean
export function looksLikeGithubToken(value)                   // -> boolean (ghp_|github_pat_|gho_|ghu_|ghs_|ghr_ prefix)
export function isRepoSlug(value)                              // -> boolean
export function generateAdminToken()                          // -> crypto.randomBytes(32).toString("hex")
export function buildPatTemplateUrl({ name, description })     // -> string (confirmed params only)
```

`EnvLine = { type: "raw", raw: string } | { type: "entry", key: string, value: string, raw: string }`

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | `parseEnvFile`/`mergeEnvEntries`/`serializeEnv` round-trip, incl. unrelated-key preservation and comment/blank passthrough | Vitest, table-driven cases |
| Unit | Validators (`isNonEmpty`, `looksLikeGithubToken`, `isRepoSlug`), `generateAdminToken` (length/hex-format assertions, not exact value), `buildPatTemplateUrl` (exact query string), `maskSecret` (short/boundary/long values) | Vitest, real branches, no mocks needed (pure functions) |
| Not unit-tested | Interactive `readline` prompting itself (`setup-wizard.mjs` orchestration) | Kept out of coverage gate by design — thin, I/O-only, matches the project's "vacuous coverage" precedent noted in the proposal |
| Build-time proof | `--env-file` actually loads `.env` into the spawned `dist/server/entry.mjs` process | New `scripts/verify-env-file-loading.mjs`, run manually / in CI like the other 4 `verify-*.mjs` scripts — follows this project's consistent precedent of a real proof script for anything a mock can't reach |

## Migration / Rollout

- Node ≥20.6 required for `--env-file` (CI pinned to 22, confirmed in `.github/workflows/ci.yml`). Document in `README.md` under a new "Setup" section, next to the `npm run setup` instructions — no runtime version-guard script, since Node itself already fails clearly (`node: bad option: --env-file` on <20.6) without extra tooling.
- No data migration. `.env` is local, untracked, and never touched by this change's rollback (removing the scripts and `package.json` entries).

## Open Questions

None blocking.
