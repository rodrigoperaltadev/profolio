# Design: Git-as-CMS Publishing Layer

## Technical Approach

`ContentWriter` is a plain port/adapter pair, no server layer. The port's two operations (`create`, `edit`) never throw — every call resolves to a discriminated `WriteResult`, the same `{ ok: true | false }` shape family as the existing `ParseResult<T>` in `validate-entry.ts`, so callers pattern-match instead of wrapping every call in `try/catch`. `GithubContentWriterAdapter` implements the port with native `fetch` (constructor-injected, not global-patched) against the GitHub Contents API: GET to check existence/SHA, PUT to write. `FakeContentWriter` is an in-memory `Map`-backed double that mirrors the same validation and conflict semantics. Every write funnels through exactly one `parseEntry()` call and exactly one sanitizing catch boundary before producing a result — both are structural guarantees, not conventions callers must remember.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Error modeling | Discriminated `WriteResult`/`WriteError` union; adapter never throws to its public API | Thrown typed error classes (`ConflictError`, `ValidationError`) | Matches the existing `ParseResult<T>` idiom exactly (same `ok`-discriminant family); no `try/catch` needed at call sites, keeps `max-depth`/`complexity` low, and makes exhaustive error handling a compile-time check via the `kind` union |
| `content` param shape | Structured `{ frontmatter: Record<string, unknown>; body: string }`, not raw markdown text | Raw markdown string (frontmatter serialized by caller) | `parseEntry()` validates a structured object against `postsSchema`/`projectsSchema`; a raw-string param would need frontmatter parsing first (a new dependency, out of scope) before validation could run at all |
| Edit semantics | Full-content replacement (caller resupplies entire frontmatter + body, including unchanged fields) | Partial patch merged with the existing file's frontmatter | Merging requires reading and interpreting the existing file's fields — that is inference, which the proposal explicitly excludes; full replacement keeps `edit()` symmetrical with `create()` |
| Not-found vs conflict | Two distinct `WriteError` kinds: `not-found` (edit target missing, create target already exists) and `conflict` (SHA precondition failed on PUT) | One overloaded `conflict` kind for both | Different caller responses are warranted (retry with a fresh read vs. pick a different slug); collapsing them would force callers to string-match `message` to tell them apart |
| `fetch` injection | Constructor parameter defaulting to global `fetch` | `vi.spyOn(globalThis, "fetch")` in tests, real global `fetch` in adapter | Avoids mutating global state in tests and keeps the adapter's dependency explicit, consistent with the config-injection convention already established in this repo |
| Fake also validates | `FakeContentWriter` calls `parseEntry()` too | Fake stores whatever it's given, unvalidated | A fake that skips validation would let a future caller's tests pass against invalid frontmatter that fails against the real adapter — defeats the point of testing against the port |
| Frontmatter serialization | Hand-rolled minimal YAML writer scoped to the four primitive shapes `postsSchema`/`projectsSchema` actually use (`string`, `boolean`, `Date`, `string[]`) | `js-yaml`/`yaml` npm package | Same minimal-dependency rationale already used for choosing native `fetch` over `@octokit/rest`; the serialization surface is small, fixed, and fully covered by unit tests |
| Global `fetch`/`Buffer` types | Add `@types/node` devDependency + `"types": ["node"]` in `tsconfig.json` | Add `"dom"` to `tsconfig.json` `lib` | `tsconfig.json` currently has `lib: ["ES2022"]` only — no ambient `fetch`/`Response`/`Buffer` types exist yet. `"dom"` would also pull in browser globals (`Window`, `document`) irrelevant to this Node/Astro-SSG codebase and risks type-mismatches between DOM `Response` and undici's; `@types/node` is a dev-only, type-only addition — it does not violate "no new runtime dependency" |
| Sanitization mechanism | Single `sanitizeError(err, secrets)` funnel called from the one catch boundary in `write()`; does literal substring redaction, not JSON-field stripping | Strip known fields (`headers.Authorization`) from the parsed error body | Field-stripping only catches leaks through fields we anticipated; substring redaction catches the token wherever it appears in the message text, including if GitHub's response body unexpectedly echoes it back |

## Sequence — `edit()` happy path + SHA conflict

    caller ──▶ adapter.edit(input)
                 │
                 ├─ parseEntry(schema, frontmatter) ──▶ invalid? return {ok:false, kind:"validation"}
                 │
                 ├─ GET .../contents/{path}  ──▶ 404 ──▶ return {ok:false, kind:"not-found"}
                 │                             └─ 200 ──▶ sha
                 │
                 ├─ PUT .../contents/{path} {content, sha, message}
                 │      ├─ 409 (sha stale) ──▶ return {ok:false, kind:"conflict"}
                 │      ├─ !ok              ──▶ return {ok:false, kind:"api-error", message: sanitizeError(...)}
                 │      └─ ok                ──▶ return {ok:true}
                 │
                 └─ any thrown exception (network, parse) ──▶ single catch ──▶ sanitizeError(...) ──▶ {ok:false, kind:"api-error"}

## File Changes

| File | Action | Description |
|---|---|---|
| `src/publishing/content-writer.ts` | Create | `ContentWriter` port, `WriteEntryInput`, `WriteResult`/`WriteError` union, `Collection` type |
| `src/publishing/github-content-writer-adapter.ts` | Create | `GithubContentWriterAdapter` — GET-for-SHA, PUT, create-vs-edit branching, single sanitizing catch |
| `src/publishing/fake-content-writer.ts` | Create | In-memory test double, same validation/conflict semantics |
| `src/publishing/frontmatter.ts` | Create | `buildMarkdownFile(frontmatter, body)` — minimal YAML serializer for the four schema primitive shapes |
| `src/publishing/sanitize-error.ts` | Create | `sanitizeError(err, secrets)` — literal substring redaction |
| `src/config/publishing-config.ts` | Create | `loadPublishingConfig()` — the only `process.env` read for this layer |
| `src/content/schemas.ts` | Modify | Add `deleted: z.boolean().default(false)` to `postsSchema`/`projectsSchema` |
| `eslint.config.js` | Modify | New `publishing` boundaries element + `element-types` rule |
| `tsconfig.json` | Modify | Add `"types": ["node"]` |
| `package.json` | Modify | Add `@types/node` devDependency (types-only) |

## Interfaces / Contracts

```ts
// src/publishing/content-writer.ts
export type Collection = "posts" | "projects";

export interface WriteEntryInput {
  readonly collection: Collection;
  readonly slug: string;
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
  readonly commitMessage: string;
}

export type WriteError =
  | { readonly kind: "validation"; readonly message: string }
  | { readonly kind: "not-found"; readonly message: string }
  | { readonly kind: "conflict"; readonly message: string }
  | { readonly kind: "api-error"; readonly status: number; readonly message: string };

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: WriteError };

export interface ContentWriter {
  create(input: WriteEntryInput): Promise<WriteResult>;
  edit(input: WriteEntryInput): Promise<WriteResult>;
}
```

```ts
// src/publishing/github-content-writer-adapter.ts (shape; helper bodies omitted for brevity)
import { postsSchema, projectsSchema } from "../content/schemas";
import { parseEntry } from "../content/validate-entry";
import { sanitizeError } from "./sanitize-error";
import { buildMarkdownFile } from "./frontmatter";
import type { ContentWriter, Collection, WriteEntryInput, WriteResult } from "./content-writer";

export interface GithubContentWriterConfig {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
}

const SCHEMAS = { posts: postsSchema, projects: projectsSchema } as const;

export class GithubContentWriterAdapter implements ContentWriter {
  constructor(
    private readonly config: GithubContentWriterConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async create(input: WriteEntryInput): Promise<WriteResult> {
    return this.write(input, "create");
  }

  async edit(input: WriteEntryInput): Promise<WriteResult> {
    return this.write(input, "edit");
  }

  private async write(
    input: WriteEntryInput,
    mode: "create" | "edit",
  ): Promise<WriteResult> {
    const parsed = parseEntry(SCHEMAS[input.collection], input.frontmatter);
    if (!parsed.ok) {
      return { ok: false, error: { kind: "validation", message: parsed.error } };
    }
    try {
      return await this.writeValidated(input, mode, parsed.data);
    } catch (err) {
      // single sanitizing catch boundary — see sanitize-error.ts
      return {
        ok: false,
        error: { kind: "api-error", status: 0, message: sanitizeError(err, [this.config.token]) },
      };
    }
  }
  // writeValidated(): GET for sha, branch on mode/existing, build markdown, PUT — omitted here
}
```

```ts
// src/publishing/sanitize-error.ts — the leak-prevention guarantee
export function sanitizeError(err: unknown, secrets: readonly string[]): string {
  const raw = err instanceof Error ? err.message : String(err);
  return secrets.reduce(
    (msg, secret) => (secret.length > 0 ? msg.split(secret).join("[REDACTED]") : msg),
    raw,
  );
}
```

Literal substring redaction is deliberate: it catches the token wherever it appears in the message text — including a mocked/real GitHub error body that echoes request data — without depending on knowing which JSON field it might surface in.

```ts
// src/config/publishing-config.ts — the only process.env read for this layer
export interface PublishingConfig {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
}

export function loadPublishingConfig(): PublishingConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) {
    throw new Error(
      "Missing required publishing config: GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME",
    );
  }
  return { token, owner, repo, branch: process.env.GITHUB_CONTENT_BRANCH ?? "main" };
}
// Composition (future caller, e.g. issue #5):
//   const writer: ContentWriter = new GithubContentWriterAdapter(loadPublishingConfig());
```

`loadPublishingConfig()` throwing is a deliberate exception to "the adapter never throws" — this is composition-root, fail-fast startup validation, not a write-path operation result.

```ts
// src/publishing/fake-content-writer.ts
export class FakeContentWriter implements ContentWriter {
  private readonly store = new Map<string, { frontmatter: Record<string, unknown>; body: string }>();

  async create(input: WriteEntryInput): Promise<WriteResult> {
    const parsed = parseEntry(SCHEMAS[input.collection], input.frontmatter);
    if (!parsed.ok) return { ok: false, error: { kind: "validation", message: parsed.error } };
    const key = `${input.collection}/${input.slug}`;
    if (this.store.has(key)) {
      return { ok: false, error: { kind: "conflict", message: "file already exists" } };
    }
    this.store.set(key, { frontmatter: input.frontmatter, body: input.body });
    return { ok: true };
  }

  async edit(input: WriteEntryInput): Promise<WriteResult> {
    const parsed = parseEntry(SCHEMAS[input.collection], input.frontmatter);
    if (!parsed.ok) return { ok: false, error: { kind: "validation", message: parsed.error } };
    const key = `${input.collection}/${input.slug}`;
    if (!this.store.has(key)) {
      return { ok: false, error: { kind: "not-found", message: "no file to edit" } };
    }
    this.store.set(key, { frontmatter: input.frontmatter, body: input.body });
    return { ok: true };
  }

  get(collection: Collection, slug: string) {
    return this.store.get(`${collection}/${slug}`);
  }
}
```

### `src/content/schemas.ts` diff

```diff
 export const postsSchema = z.object({
   title: z.string(),
   date: z.coerce.date(),
   tags: z.array(z.string()).default([]),
   draft: z.boolean().default(false),
+  deleted: z.boolean().default(false),
 });

 export const projectsSchema = z.object({
   name: z.string(),
   stack: z.array(z.string()).default([]),
   link: z.url(),
   date: z.coerce.date(),
   draft: z.boolean().default(false),
+  deleted: z.boolean().default(false),
 });
```

### `eslint.config.js` diff

```diff
       "boundaries/elements": [
         { type: "content", pattern: "src/content/**" },
         { type: "view", pattern: "src/presentation/**" },
         { type: "config", pattern: "src/config/**" },
         { type: "lib", pattern: "src/lib/**" },
+        { type: "publishing", pattern: "src/publishing/**" },
       ],
...
           { from: "content", allow: ["lib"] },
           { from: "view", allow: ["lib", "content"] },
           { from: "lib", allow: ["lib"] },
           { from: "config", allow: ["lib"] },
+          { from: "publishing", allow: ["lib", "content", "config"] },
```

`content`, `view`, and `lib` rows are untouched — none gains `publishing` in its `allow` list, so no path back into `publishing` exists.

## Testing Strategy

| What | Approach | Why (coverage-gate honesty) |
|---|---|---|
| Adapter create/edit happy path (both collections) | Mocked `fetchFn` returns 404-then-2xx (create) / 200-then-2xx (edit); assert method, URL, base64 body, `Authorization` header key present (never assert its literal value) | Real, distinct branches per collection and per mode |
| Create-vs-edit branching | Mocked `fetchFn`: GET 200 on `create()` → `conflict`; GET 404 on `edit()` → `not-found` | Proves the mode/existence matrix, not just one path |
| SHA-conflict | Mocked `fetchFn`: GET 200 (sha), PUT 409 → assert `{ ok:false, error:{ kind:"conflict" } }`, no retry call made | Exercises the exact scenario the proposal calls out; asserts `fetchFn` called exactly twice (GET+PUT), never a third auto-retry call |
| Validation failure | Invalid frontmatter → assert zero `fetchFn` calls, `kind:"validation"` returned | Proves `parseEntry()` runs *before* any network call, per locked scope |
| Error sanitization | Mocked `fetchFn` throws an `Error` whose message embeds the exact fake token string; separately, a mocked non-ok response body embeds it | Assert result message excludes the token substring and contains `[REDACTED]` in both cases — two real branches (secret present / absent) for `sanitizeError` itself |
| `loadPublishingConfig()` | All env vars present → returns config; any missing → throws | Real branch pair, same idiom as `parseEntry()`'s own test |
| `buildMarkdownFile()` | One fixture per collection, assert frontmatter block + body round-trip through `postsSchema`/`projectsSchema` `.safeParse()` | Proves the serializer produces schema-valid output, not just "some string" |
| `FakeContentWriter` | create → edit → conflict/not-found paths | Reused directly by future caller tests (issue #5); tested here so its contract is proven before anyone depends on it |
| Not re-tested | TS exhaustiveness of the `WriteError` discriminated union (compiler-enforced); Zod's own `.safeParse()` internals (already covered by `content-model-schema`'s tests) | Re-testing these tests the compiler/dependency, not this change's code — same lesson as the two prior archived designs' "zero-branch file" note |
| No real network call | All adapter tests inject a `vi.fn()` as `fetchFn`; `FakeContentWriter` never imports the adapter | Structural guarantee, not a lint rule — the constructor-injected `fetch` makes a real call impossible to reach accidentally in a test |

## Migration / Rollout

No migration required. All new files are additive (`src/publishing/**`, `src/config/publishing-config.ts`); `deleted` defaults to `false` so existing sample content (`hello-world.md`, `profolio.md`) validates unchanged. Rollback per proposal: remove `src/publishing/**`, `src/config/publishing-config.ts`, the `publishing` boundaries entries, and revert `schemas.ts`/`tsconfig.json`/`package.json` via git. No caller exists yet, so no deployed behavior is affected.

## Open Questions

- [ ] Should `branch` default to the repo's actual default branch (via an extra GET `/repos/{owner}/{repo}`) instead of a hardcoded `"main"` fallback? Low risk — caller can already override via `GITHUB_CONTENT_BRANCH`; not blocking for this change.
- [ ] Exact GitHub Contents API status code for a stale-SHA PUT (proposal states 409; GitHub's docs describe this as the SHA-mismatch case) — confirm empirically during `sdd-apply`/manual verification against a real repo, since the automated suite only exercises mocked `fetch`.
