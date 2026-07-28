# Tasks: Git-as-CMS Publishing Layer

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~560-650 (excl. `package-lock.json`) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 → PR3 → PR4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Note on the estimate:** the proposal's own Review Workload Forecast flagged ~300-450 lines as "plausibly at or slightly over the 400-line budget." Breaking the design's File Changes table down file-by-file (impl + matching test file, per the Testing Strategy table's 9 rows) puts this change meaningfully higher than that — the GitHub adapter alone needs ~7-8 distinct mocked-`fetch` scenarios (happy path × 2 collections, create-vs-edit branching × 2, SHA-conflict, validation failure, error-sanitization × 2 branches), which is more test surface than either prior archived change carried in a single file. Splitting into 4 units keeps every individual PR safely under 400 lines even though the total is not.

### Suggested Work Units

Tracker branch `feature/publishing-layer` (draft, no-merge until all children land). Cascade: PR4 → PR3 branch → PR2 branch → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | Schema field + ESLint boundaries + TS/`@types/node` wiring | `feat/publishing-schema-boundaries` (base: tracker) | ~25-35 | Pure config/schema, no `src/publishing/**` code exists yet — smallest, lowest-risk unit |
| 2 | Port interface + `sanitize-error` + frontmatter serializer (TDD) | `feat/publishing-port-primitives` (base: PR1) | ~175-210 | All pure functions, no `fetch`, easily unit-tested; `content-writer.ts` is declarative (types only, no dedicated test, same idiom as `entry.ts` in content-model-schema) |
| 3 | `GithubContentWriterAdapter` (TDD) — security-critical surface | `feat/publishing-github-adapter` (base: PR2) | ~230-270 | Sanitization, SHA-conflict, create-vs-edit branching, mocked `fetch` only; largest and most sensitive unit — recommend extra review attention here given this is the repo's first external-API/credential-handling code |
| 4 | Config loader + `FakeContentWriter` (TDD) | `feat/publishing-config-fake-writer` (base: PR3) | ~135-165 | The only `process.env` read for this layer; the fake test double future callers (issue #5) will import |

## Phase 1: Schema Field, ESLint Boundaries, TS Wiring (Unit 1 — satisfies Posts/Projects Schema Shape, Draft Field Is Schema-Only [delta], No Ambient Token Access foundation)

- [x] 1.1 RED: extend `src/content/schemas.test.ts` — assert `deleted` defaults to `false` when omitted and accepts an explicit `true` for both `postsSchema` and `projectsSchema` via `.safeParse()` — fails, field doesn't exist yet
- [x] 1.2 GREEN: add `deleted: z.boolean().default(false)` to `postsSchema` and `projectsSchema` in `src/content/schemas.ts`
- [x] 1.3 Add the `publishing` boundaries element (`src/publishing/**`) and its `element-types` rule (`publishing -> [lib, content, config]`) to `eslint.config.js`; confirm `content`/`view`/`lib` rows are untouched (no new `allow` entry pointing at `publishing`)
- [x] 1.4 Add `"types": ["node"]` to `tsconfig.json`; add `@types/node` as a devDependency in `package.json` (type-only — does not violate "no new runtime dependency")
- [x] 1.5 Verify: `npm run test` passes with the updated schema assertions (existing `hello-world.md`/`profolio.md` sample content still validates unchanged); `npm run typecheck` passes with `fetch`/`Buffer` ambient types resolvable; `npm run lint` passes with the new boundaries element in place (no `src/publishing/**` files exist yet, so this only validates the config itself)
- [x] 1.6 Commit as one work unit; open PR1 → tracker branch

## Phase 2: Port Interface, Sanitize-Error, Frontmatter Serializer (Unit 2 — satisfies ContentWriter Port Contract, Sanitized Error Handling)

- [x] 2.1 Create `src/publishing/content-writer.ts` — `Collection`, `WriteEntryInput`, `WriteError`, `WriteResult`, `ContentWriter` interface, verbatim per design's Interfaces/Contracts. Declarative type-only file — no dedicated test (same "zero-branch file" idiom noted for `entry.ts` in the content-model-schema design; TS exhaustiveness of the `WriteError` union is compiler-enforced, not re-tested)
- [x] 2.2 RED: write `src/publishing/sanitize-error.test.ts` — secret present in message → replaced with `[REDACTED]`; secret absent/empty secrets list → message passes through unchanged — fails, module doesn't exist
- [x] 2.3 GREEN: create `src/publishing/sanitize-error.ts` — `sanitizeError(err, secrets)`, literal substring redaction, per design's Interfaces/Contracts
- [x] 2.4 RED: write `src/publishing/frontmatter.test.ts` — one fixture per collection (`posts`, `projects`) exercising all four primitive shapes (`string`, `boolean`, `Date`, `string[]`); assert `buildMarkdownFile()`'s output re-parses and round-trips through `postsSchema`/`projectsSchema` `.safeParse()` successfully — fails, module doesn't exist
- [x] 2.5 GREEN: create `src/publishing/frontmatter.ts` — `buildMarkdownFile(frontmatter, body)`, minimal hand-rolled YAML serializer scoped to the four shapes actually used
- [x] 2.6 Verify: `npm run test` (coverage) exits 0 on `sanitize-error.test.ts` + `frontmatter.test.ts`, all four metrics non-vacuous; `npm run typecheck` and `npm run lint` exit 0
- [x] 2.7 Commit as one work unit; open PR2 → PR1 branch

## Phase 3: GithubContentWriterAdapter (Unit 3 — satisfies GithubContentWriterAdapter Request Shape, Validation Before Write, SHA-Conflict Handling, No Ambient Token Access in the Adapter, No Real Network Calls in Automated Tests)

- [x] 3.1 RED: write `src/publishing/github-content-writer-adapter.test.ts` — happy-path `create()` for `posts` (mocked `fetchFn`: GET 404 → PUT 2xx); assert `PUT` method, correct Contents API URL, base64-encoded body, and `Authorization` header key present (never assert its literal value) — fails, module doesn't exist
- [x] 3.2 GREEN: create `src/publishing/github-content-writer-adapter.ts` — `GithubContentWriterAdapter` implementing `create`/`edit` via the shared private `write()`/`writeValidated()` per design's Interfaces/Contracts and the `edit()` sequence diagram
- [x] 3.3 RED→GREEN: extend the suite — happy-path `edit()` for `projects` (mocked `fetchFn`: GET 200 → PUT 2xx); assert the GET-for-SHA call happens first and the returned SHA is included in the `PUT` body
- [x] 3.4 RED→GREEN: create-vs-edit branching — GET 200 on `create()` → `{ ok: false, error: { kind: "conflict" } }`; GET 404 on `edit()` → `{ ok: false, error: { kind: "not-found" } }`
- [x] 3.5 RED→GREEN: SHA-conflict — GET 200 (sha), PUT 409 → assert `{ ok: false, error: { kind: "conflict" } }` and `fetchFn` called exactly twice (GET + PUT), no automatic retry. **Empirical-confirmation flag:** this test bakes in the assumption that GitHub's Contents API returns HTTP 409 for a stale-SHA `PUT` — the design's Open Questions section states this is not independently confirmed, since the automated suite only mocks `fetch`. The mock enforces the *code's* handling of a 409, not that GitHub genuinely returns 409 in this scenario against the real API; real-API verification is a separate manual/maintainer-triggered step, out of scope for this change
- [x] 3.6 RED→GREEN: validation failure — invalid frontmatter passed to `create()`/`edit()` → assert zero `fetchFn` calls and `{ ok: false, error: { kind: "validation" } }`, proving `parseEntry()` runs before any network call
- [x] 3.7 RED→GREEN: error sanitization — (a) mocked `fetchFn` throws an `Error` whose message embeds the exact fake token string; (b) a mocked non-ok response body embeds it. Assert both results exclude the token substring and contain `[REDACTED]` — the dedicated test the proposal's Success Criteria requires
- [x] 3.8 Verify: `npm run test` (coverage) exits 0 on the full adapter suite, all four metrics non-vacuous; confirm no test path ever reaches the real global `fetch` (every test injects a `vi.fn()` as `fetchFn`)
- [x] 3.9 Verify: `npm run lint` exits 0 — no `process.env` reference anywhere in `src/publishing/**` (the existing `no-restricted-syntax` rule already blocks it repo-wide outside `src/config/**`; no override/exception added); `npm run typecheck` exits 0
- [x] 3.10 Commit as one work unit; open PR3 → PR2 branch

## Phase 4: Publishing Config Loader + FakeContentWriter (Unit 4 — satisfies FakeContentWriter Test Double, No Ambient Token Access in the Adapter [injection side], Logical Delete Semantics, Single-File Commits Only)

- [x] 4.1 RED: write `src/config/publishing-config.test.ts` — all required env vars present → returns config, `branch` defaults to `"main"` when `GITHUB_CONTENT_BRANCH` is unset; any of `GITHUB_TOKEN`/`GITHUB_REPO_OWNER`/`GITHUB_REPO_NAME` missing → throws — fails, module doesn't exist
- [x] 4.2 GREEN: create `src/config/publishing-config.ts` — `loadPublishingConfig()`, the only `process.env` read for this layer, per design's Interfaces/Contracts (deliberate exception to "the adapter never throws" — composition-root, fail-fast startup validation, not a write-path result)
- [x] 4.3 RED: write `src/publishing/fake-content-writer.test.ts` — `create` → `edit` → `create`-on-existing-slug yields `conflict` → `edit`-on-missing-slug yields `not-found`; assert `parseEntry()` still runs (invalid frontmatter rejected on both `create` and `edit`) and the module has no `fetch` import — fails, module doesn't exist
- [x] 4.4 GREEN: create `src/publishing/fake-content-writer.ts` — `FakeContentWriter`, in-memory `Map`-backed, same validation/conflict semantics as the real adapter, per design's Interfaces/Contracts
- [x] 4.5 Verify: `npm run test` (coverage) exits 0 across the full `src/publishing/**` + `src/config/**` suite, all four metrics ≥80% and non-vacuous; no real network call anywhere in the automated suite (structural guarantee, not just a lint rule)
- [x] 4.6 Verify: `npm run build` succeeds, confirming no route/output-mode change was made to `astro.config.mjs` (this change stays a pure module addition, no server/API route)
- [x] 4.7 Verify: `eslint .` exits 0 clean end-to-end — `publishing -> [lib, content, config]` boundary holds, `content`/`view`/`lib` gained no path back into `publishing`
- [x] 4.8 Commit as one work unit; open PR4 → PR3 branch (final child; cascades to tracker → main)

## Next Step

All 4 phases complete (PR1-PR4). Ready for `sdd-verify`.
