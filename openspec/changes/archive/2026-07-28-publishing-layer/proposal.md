# Proposal: Git-as-CMS Publishing Layer

Cross-references: GitHub #4 (this change), #3 (content-model-schema, archived — supplies the schemas/`parseEntry` this change validates against and the file-layout contract it writes into), #5 (admin UI, blocked by this change).

## Intent

Profolio's content model (issue #3) defines schemas and a file-layout contract, but nothing can write content back into the repo programmatically — every change to `src/content/**` today requires a manual commit. Issue #4 closes that gap with a callable module that creates/edits content files via the GitHub Contents API, validated against the existing schemas before any commit is assembled. This is the first change in the repo that talks to an external API using real credentials, so it also establishes the security pattern (token handling, least privilege, safe error handling) every later network-facing change will follow.

## Scope

### In Scope

- `ContentWriter` port (TypeScript interface): explicit-parameter create/edit operations (collection, slug, file content) — no slug/path inference, no HTTP route
- `GithubContentWriterAdapter`: implements the port using native `fetch` against the GitHub Contents API
- `FakeContentWriter`: in-memory test double for future callers (e.g. issue #5), not exercising `fetch`
- Token loading confined to `src/config/**` (existing DI convention), injected into the adapter — never read ambient in `src/publishing/**`
- Logical delete: extend `postsSchema`/`projectsSchema` with `deleted: z.boolean().default(false)`; "delete" = edit with `deleted: true`, no port `delete()` method, no Contents API DELETE call
- Every write validated through `parseEntry()` before a commit payload is assembled
- New `publishing` ESLint boundaries element (`src/publishing/**`) with rules allowing `publishing -> [lib, content, config]`
- Unit tests for the adapter using a mocked `fetch` only (method, URL, base64 body, `Authorization` header presence, SHA handling) — no real network call in the automated suite

### Out of Scope

- Admin UI (#5) — no caller exists yet
- HTTP/API route and any Astro `output: "server"` / hosting-adapter decision — deferred until #5 actually needs HTTP exposure
- Hard delete (Contents API `DELETE`) — not implemented; logical delete only
- Atomic multi-file commits — single-file commits only
- Slug/path derivation or inference from title/content — caller's responsibility
- Real, network-hitting integration tests in CI — genuine end-to-end verification against the live API is a manual/maintainer-triggered step, documented but not part of automated CI

## Capabilities

### New Capabilities

- `content-publishing`: `ContentWriter` port + `GithubContentWriterAdapter` + `FakeContentWriter`, single-file create/edit against the GitHub Contents API, schema-validated via `parseEntry()` before commit assembly, token supplied via `src/config/**` injection

### Modified Capabilities

- `content-schema`: adds `deleted: z.boolean().default(false)` to `postsSchema` and `projectsSchema` (same pattern as `draft` in #3); no other requirement changes

## Approach

Plain port/adapter module, no server layer: a `ContentWriter` interface with `create`/`edit` operations plus `GithubContentWriterAdapter` (native `fetch`, no `@octokit/rest` dependency — matches this repo's existing minimal-dependency style seen in `schemas.ts`/`validate-entry.ts`) and a `FakeContentWriter` for future test consumers. Native `fetch` is preferred over adding an SDK dependency; Node 22 (this repo's CI runtime) has it built in and the Contents API surface this change needs (GET for current SHA, PUT for create/update) is small enough not to justify the extra dependency.

Security is structural, not incidental:
- The GitHub token is read exactly once, inside `src/config/**` (the only place `no-restricted-syntax` permits ambient `process.env` access), and injected into `GithubContentWriterAdapter` at construction — the adapter never reads `process.env` itself.
- Recommend a fine-grained GitHub PAT scoped to `contents:write` on this repo only, not a classic broad-scope PAT — least privilege in case the token ever leaks.
- The adapter sanitizes any GitHub API error body before logging or throwing (error messages/response bodies can echo request data, including the file path/content, but must never echo the `Authorization` header or token).
- The automated test suite only exercises `FakeContentWriter` or a mocked `fetch`; it never makes a real network call. This is also a practical necessity, not just a preference — GitHub withholds repo secrets from fork-triggered `pull_request` CI runs, so a real-token test would silently fail or skip on fork contributions regardless.

Logical delete: no `delete()` port method removes a file from git history. "Deleting" means calling `edit()` with `deleted: true` set on the frontmatter; the file remains in the repo and in git history, just flagged. This keeps the write surface to two operations (create, edit) and avoids building irreversible-by-design behavior into the first version of this layer.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/publishing/**` | New | `ContentWriter` port, `GithubContentWriterAdapter`, `FakeContentWriter` |
| `src/config/**` | New | First module in this layer — reads `GITHUB_TOKEN` (and repo owner/name) once, constructs the adapter |
| `src/content/schemas.ts` | Modified | Add `deleted: z.boolean().default(false)` to `postsSchema` and `projectsSchema` |
| `eslint.config.js` | Modified | New `publishing` boundaries element (`src/publishing/**`), allow `publishing -> [lib, content, config]`; `content`/`view`/`lib` unchanged, do not gain a path to `publishing` |
| `package.json` | Unchanged | No new runtime dependency — native `fetch` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Token or raw GitHub API error body leaks into logs/thrown errors | Medium | Adapter sanitizes error bodies before logging/throwing; unit tests assert no token substring appears in any thrown error message |
| An overly broad (classic) PAT is provisioned instead of a fine-grained one, widening blast radius on leak | Medium | Proposal/design explicitly recommends a fine-grained PAT scoped to `contents:write` on this repo only; documented as an operational setup step, not just code |
| Ambient `process.env` read is accidentally added inside `src/publishing/**`, bypassing the DI convention | Low (ESLint already blocks it repo-wide outside `src/config/**`) | No override/exception is added for `src/publishing/**`; the existing `no-restricted-syntax` rule stays in force |
| A real network call is accidentally added to the automated test suite (e.g. someone imports the real adapter without mocking `fetch`) | Low | Adapter tests only ever use a mocked `fetch`; `FakeContentWriter` is the only writer test fixtures for future callers should import; real-API verification is a separate manual/maintainer-triggered step, not part of `npm run test` or CI |
| Future callers (issue #5) misread logical delete as a real delete and expect the file to disappear from git history | Medium | Port has no `delete()` method; design/spec explicitly document `edit({ deleted: true })` as the only delete semantic |
| Concurrent edits collide on GitHub's required `sha` for updates (stale SHA gets rejected) | Medium | Adapter reads the current file SHA before `PUT` and surfaces a typed conflict error rather than silently overwriting; retry/merge policy is left to the caller |

## Rollback Plan

All changes are additive (`src/publishing/**`, `src/config/**`) plus one isolated, backward-compatible schema addition (`deleted` defaults to `false`, so existing content files remain valid without edits). Revert by removing `src/publishing/**`, `src/config/**`, and the new `boundaries/elements`/`element-types` entries in `eslint.config.js`, and reverting `src/content/schemas.ts` via git. No caller exists yet, so no deployed behavior or data migration is affected.

## Dependencies

- Depends on content-model-schema (archived) for `postsSchema`/`projectsSchema`, `parseEntry()`, and the `src/content/<collection>/*.md` file-layout contract.
- Blocks issue #5 (admin UI), the first real caller of this port.
- Operational prerequisite (outside this change's code): a fine-grained GitHub PAT scoped to `contents:write` on this repo must be provisioned before any real-API manual verification can run.

## Success Criteria

- [ ] `ContentWriter` port defines `create`/`edit` with explicit `collection`/`slug`/content params — no path/slug inference
- [ ] `GithubContentWriterAdapter` implements the port over native `fetch`; unit-tested with a mocked `fetch` only (method, URL, base64 body, `Authorization` header presence, SHA handling) — never a real network call
- [ ] `FakeContentWriter` exists as the test double for future callers
- [ ] GitHub token is read only inside `src/config/**` and injected into the adapter; `eslint .` passes with no `no-restricted-syntax` exception added for `src/publishing/**`
- [ ] No token or unsanitized GitHub API error body ever appears in a log line or thrown error message (verified by a dedicated unit test)
- [ ] `deleted: boolean` (default `false`) added to `postsSchema` and `projectsSchema`; existing sample content still validates unchanged
- [ ] Every create/edit call path invokes `parseEntry()` before assembling a commit payload
- [ ] New `publishing` boundaries element added; `content`/`view`/`lib` gain no import path to `publishing`
- [ ] Coverage gate holds at 80% with no real network call in the automated suite
- [ ] `npm run build` succeeds with no route/output-mode changes made to `astro.config.mjs`

## Review Workload Forecast

- Estimated changed lines: ~300-450 (port interface, GitHub adapter, fake adapter, config token loader, one schema field across two schemas, eslint boundaries update, adapter unit tests including error-sanitization and SHA-conflict cases). Mid-range, plausibly at or slightly over the 400-line budget once tests are included.
- Chained PRs: Not obviously required by scope, but plausible if the security-focused test surface (error sanitization, SHA conflict, mocked-fetch shape assertions) grows large enough to warrant separating the adapter+tests from the schema/eslint wiring. Flagging for delivery-strategy planning rather than deciding here.
- Decision needed before apply: Possibly — recommend the orchestrator re-check actual task-level line estimates once `sdd-tasks` breaks this down, and apply the cached `delivery_strategy` if the 400-line/chained-PR risk materializes.
