# Design: Admin Authoring UI with Local-Dev Fallback

## Technical Approach

Flip `astro.config.mjs` to `output: "server"` + `@astrojs/node` (standalone), so `/admin/**` gets a real request/response cycle while every other route opts back into static generation via `export const prerender = true`. Admin write paths are plain server-rendered `.astro` pages posting to colocated `.ts` API routes (`export const POST`) — no Astro Actions, no client JS. A new `LocalFsContentWriterAdapter` implements the existing `ContentWriter` port (issue #4), sharing `parseFrontmatter()`/`buildMarkdownFile()` and a newly-extracted `buildContentPath()` with `GithubContentWriterAdapter`. A composition-root factory in `src/config/**` picks the adapter based on a new non-throwing `isPublishingConfigured()` check. Auth is a thin `src/middleware.ts` wrapper around a pure, fully unit-testable `checkAdminAuth()` function, gating `/admin/**` only in full/server mode with a timing-safe Basic-Auth check, fail-closed if the secret is unset. Delete reuses `edit({ deleted: true })` on the full frontmatter, read server-side via `getEntry()` before the edit form renders.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Public pages needing `prerender = true` | **None exist yet.** `src/pages/**` and `src/presentation/**` are both empty today (confirmed via glob) — this change is the first to add any page. Only the two verify-script probe pages need the flag (see Migration/Rollout) | N/A | Can't retrofit pages that don't exist; the *convention* (every future public page gets `prerender = true`) is documented here for #6/future changes to follow |
| Admin route mechanism | Plain `.ts` API routes (`export const POST: APIRoute`) under `src/pages/admin/api/**` | Astro Actions (`astro:actions`) | Actions add an implicit dispatch layer (`astro:actions` virtual module, action-result cookie plumbing for progressive enhancement, framework-owned Zod wiring) — more moving parts than 4 CRUD forms need. Plain API routes are Astro's most primitive server mechanism (same "no new framework" posture as the hand-rolled YAML serializer and native `fetch` elsewhere in this repo) |
| Shared path-building | Extract `buildContentPath(collection, slug)` into a new `src/publishing/content-path.ts`, used by both adapters | Leave it private in `github-content-writer-adapter.ts`, duplicate in the local adapter | `content-writer.ts` is documented as a "declarative type-only file" — adding a runtime function there breaks that framing. A dedicated module keeps one implementation, avoids `sonarjs/no-identical-functions` |
| Local adapter path resolution | Config takes `projectRoot` (defaults to `process.cwd()`), joins with `buildContentPath()`'s repo-relative output | Config takes `contentRoot` pointing at `src/content/` directly | Reusing `buildContentPath()` verbatim (which already returns `src/content/<collection>/<slug>.md`) means one function, not two path-building rules that could drift |
| Local fs write failure → `WriteError` kind | Reuse existing `kind: "api-error"` (status `0`), same convention `GithubContentWriterAdapter` already uses for unexpected thrown exceptions | New `kind: "fs-error"` | Proposal explicitly locks "no change to the `ContentWriter` port shape itself" — `WriteError` is part of that shape. `api-error` already serves as this codebase's generic "unexpected/environmental failure" bucket, not a literal HTTP-only label |
| Non-throwing config check | New `isPublishingConfigured(): boolean` reads the same 3 env vars directly, no `try/catch` around `loadPublishingConfig()` | Wrap `loadPublishingConfig()` in try/catch to derive a boolean | Using exceptions for control flow to get a boolean is wasteful (builds then discards a `PublishingConfig`) and conflates "not configured" with any other thrown error from that function. A direct predicate is the cheaper, clearer primitive the factory actually needs |
| Factory boundary | `config -> publishing` added to `boundaries/element-types` | Put the factory in `src/publishing/**` instead | `config/**` is already the composition root (only place allowed ambient env access); constructing concrete adapters and returning the `ContentWriter` port type is a composition-root responsibility, matching `loadPublishingConfig()`'s own composition comment in that file |
| Auth-gate testability | Gate logic lives in a pure `checkAdminAuth(request, config)` function in `src/config/admin-auth.ts`; `src/middleware.ts` is a ~10-line Astro-glue wrapper | Put all logic inline in `defineMiddleware(...)` | `astro:middleware` runtime isn't easily unit-tested in isolation. A pure function taking a real `Request` (Node's global `Request`/`Headers` construct trivially in Vitest) makes every security branch (bypass, fail-closed, timing-safe compare) coverage-gate-testable without mocking Astro internals |
| Timing-safe comparison | `node:crypto`'s `timingSafeEqual`, with an explicit length-mismatch branch that still performs a dummy `timingSafeEqual` call before returning `false` | Plain `===` string comparison | `===` short-circuits on the first differing byte — a measurable timing side channel for a shared secret. `timingSafeEqual` throws on mismatched buffer lengths, so length must be checked first; doing a dummy same-length compare on that early-return path avoids the length check itself becoming a (weaker) timing oracle |
| Delete's frontmatter source | Edit page does a single `getEntry(collection, \`${slug}.md\`)` server-side lookup before rendering; delete POST re-fetches via `getEntry()` again (not trusting client-submitted hidden fields for anything but display) | Trust a hidden `<input>` echoing the full frontmatter from the edit form | Re-reading server-side is one extra `getEntry()` call, already fast (in-memory content store), and removes any incentive to trust client-supplied frontmatter for the delete path |
| **[Empirically confirmed during apply, task 4.1]** `getEntry()` id shape under legacy collections | `getEntry(collection, id)` (two-arg string form) exists exactly as assumed and works, but under `legacy: { collectionsBackwardsCompat: true }` the real `CollectionEntry.id` for `type: "content"` collections includes the file extension (`"hello-world.md"`), not the extensionless slug. Calling `getEntry("posts", "hello-world")` silently resolves to `undefined` (console warning only, no throw) — the URL/`ContentWriter`/`buildContentPath()` slug convention (`"hello-world"`, no extension) must be suffixed with `.md` before every `getEntry()` call: `getEntry(collection, \`${slug}.md\`)` | Assuming the design's original `getEntry(collection, slug)` shape (extensionless) — proven wrong by build-time probe (see apply-progress) | This is the third Astro-version-specific runtime surprise this change area has hit (after the `src/content.config.ts` path and `legacy.collectionsBackwardsCompat` requirement itself), confirming task 4.1's mandate to empirically verify rather than trust the type signature alone. `entry.id` (used as-is by the existing `toContentEntry` mapper) therefore also carries the `.md` suffix; admin pages must strip it (`entry.id.replace(/\.md$/, "")`) before building route slugs, so the round-trip stays consistent with `buildContentPath()`'s extensionless convention |
| Third build-time proof script | Add `scripts/verify-admin-server.mjs` (real `astro build` + real `node dist/server/entry.mjs` + real HTTP requests) | Rely on unit tests of `checkAdminAuth()` alone | Unit tests prove the auth *logic* is correct; they cannot prove Astro's `src/middleware.ts` convention is actually wired into the live request pipeline, or that the adapter build produces a runnable `dist/server/entry.mjs`. Matches this repo's established two-script pattern of catching real integration bugs (e.g. the `legacy.collectionsBackwardsCompat` gap) that mocks can't reach |

## Data Flow — admin edit + delete

    GET /admin/posts/hello-world/edit
        └─ getEntry("posts", `${slug}.md`) ──▶ prefill form (full frontmatter)
               (empirically confirmed: legacy CollectionEntry.id carries the
               ".md" extension — see "getEntry() id shape" decision above;
               URL slug stays extensionless, ".md" appended only for the call)

    POST /admin/api/posts/hello-world/edit
        └─ createContentWriter() ──▶ writer.edit({ collection, slug, frontmatter, body })
               └─ parseFrontmatter() invalid? ──▶ 303 redirect back to edit form + ?error=
               └─ ok ──▶ 303 redirect to /admin?updated=hello-world

    POST /admin/api/posts/hello-world/delete
        └─ getEntry("posts", `${slug}.md`)  (re-read, not client-trusted)
        └─ writer.edit({ ...entry.data, deleted: true }, body: entry.body })
               └─ 303 redirect to /admin?deleted=hello-world

    Every /admin/** request first passes through src/middleware.ts:
        pathname not under /admin ──▶ next()
        !isPublishingConfigured()  ──▶ next()                         (local-fallback: no gate)
        isPublishingConfigured() && !expectedToken ──▶ 401             (fail-closed)
        supplied token via Basic Auth, timingSafeEqual mismatch ──▶ 401
        match ──▶ next()

## File Changes

| File | Action | Description |
|---|---|---|
| `astro.config.mjs` | Modify | `output: "server"`, `adapter: node({ mode: "standalone" })` |
| `package.json` | Modify | Add `@astrojs/node` to `dependencies`; new `verify:admin-server` script |
| `src/publishing/content-path.ts` | Create | `buildContentPath(collection, slug)` extracted, shared by both adapters |
| `src/publishing/github-content-writer-adapter.ts` | Modify | Import shared `buildContentPath()`, remove private copy |
| `src/publishing/local-fs-content-writer-adapter.ts` | Create | `LocalFsContentWriterAdapter implements ContentWriter` |
| `src/config/publishing-config.ts` | Modify | Add `isPublishingConfigured()`, `loadAdminAccessToken()` |
| `src/config/content-writer-factory.ts` | Create | `createContentWriter(): ContentWriter` composition-root factory |
| `src/config/admin-auth.ts` | Create | `checkAdminAuth()`, `parseBasicAuthToken()`, `timingSafeStringEqual()` — pure, unit-tested |
| `src/middleware.ts` | Create | Thin Astro glue calling `checkAdminAuth()`, scoped to `/admin/**` |
| `src/pages/admin/index.astro` | Create | List view (`getCollection` + existing `toContentEntry` mapper) |
| `src/pages/admin/[collection]/new.astro` | Create | Create form |
| `src/pages/admin/[collection]/[slug]/edit.astro` | Create | Edit form, `getEntry()` prefill |
| `src/pages/admin/api/[collection]/create.ts` | Create | POST handler → `writer.create()` |
| `src/pages/admin/api/[collection]/[slug]/edit.ts` | Create | POST handler → `writer.edit()` |
| `src/pages/admin/api/[collection]/[slug]/delete.ts` | Create | POST handler → `getEntry()` + `writer.edit({ deleted: true })` |
| `eslint.config.js` | Modify | New `admin`, `middleware` boundaries elements; `config -> publishing` added |
| `scripts/verify-content-collections.mjs` | Modify | Probe page gets `prerender = true`; dist path → `dist/client/...` |
| `scripts/verify-frontmatter-round-trip.mjs` | Modify | Same two changes as above |
| `scripts/verify-admin-server.mjs` | Create | Real build + real server + real HTTP requests proving the auth gate and local-fallback bypass |
| `.github/workflows/ci.yml` | Modify | New `verify:admin-server` step |

## Interfaces / Contracts

```ts
// src/publishing/local-fs-content-writer-adapter.ts (shape)
export interface LocalFsContentWriterConfig {
  readonly projectRoot: string; // defaults to process.cwd(), same injection idiom as fetchFn
}

export class LocalFsContentWriterAdapter implements ContentWriter {
  constructor(private readonly config: LocalFsContentWriterConfig = { projectRoot: process.cwd() }) {}

  async create(input: WriteEntryInput): Promise<WriteResult> { return this.write(input, "create"); }
  async edit(input: WriteEntryInput): Promise<WriteResult> { return this.write(input, "edit"); }

  private async write(input: WriteEntryInput, mode: "create" | "edit"): Promise<WriteResult> {
    const parsed = parseFrontmatter(input.collection, input.frontmatter);
    if (!parsed.ok) return { ok: false, error: { kind: "validation", message: parsed.error } };
    const absPath = join(this.config.projectRoot, buildContentPath(input.collection, input.slug));
    const fileExists = await exists(absPath);
    if (mode === "create" && fileExists) {
      return { ok: false, error: { kind: "conflict", message: "file already exists" } };
    }
    if (mode === "edit" && !fileExists) {
      return { ok: false, error: { kind: "not-found", message: "no file to edit" } };
    }
    try {
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, buildMarkdownFile(parsed.data, input.body), "utf-8");
      return { ok: true };
    } catch (err) {
      return { ok: false, error: { kind: "api-error", status: 0, message: sanitizeError(err, []) } };
    }
  }
}
```

```ts
// src/config/publishing-config.ts — additions
export function isPublishingConfigured(): boolean {
  return Boolean(
    process.env.GITHUB_TOKEN && process.env.GITHUB_REPO_OWNER && process.env.GITHUB_REPO_NAME,
  );
}

export function loadAdminAccessToken(): string | undefined {
  return process.env.ADMIN_ACCESS_TOKEN;
}
```

```ts
// src/config/content-writer-factory.ts
export function createContentWriter(): ContentWriter {
  return isPublishingConfigured()
    ? new GithubContentWriterAdapter(loadPublishingConfig())
    : new LocalFsContentWriterAdapter();
}
```

```ts
// src/config/admin-auth.ts — the security-critical, pure, unit-tested surface
export interface AdminAuthConfig {
  readonly isConfigured: boolean;
  readonly expectedToken: string | undefined;
}
export type AdminAuthResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly status: 401; readonly wwwAuthenticate?: string };

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // dummy compare — avoid a length-based timing oracle
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

function parseBasicAuthToken(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  const sep = decoded.indexOf(":");
  return sep === -1 ? null : decoded.slice(sep + 1); // password field carries the token
}

export function checkAdminAuth(request: Request, config: AdminAuthConfig): AdminAuthResult {
  if (!config.isConfigured) return { allowed: true }; // local-fallback: no gate
  if (!config.expectedToken) return { allowed: false, status: 401 }; // fail closed
  const supplied = parseBasicAuthToken(request.headers.get("authorization"));
  if (!supplied || !timingSafeStringEqual(supplied, config.expectedToken)) {
    return { allowed: false, status: 401, wwwAuthenticate: 'Basic realm="admin"' };
  }
  return { allowed: true };
}
```

```ts
// src/middleware.ts — thin Astro glue only
import { defineMiddleware } from "astro:middleware";
import { checkAdminAuth } from "./config/admin-auth";
import { isPublishingConfigured, loadAdminAccessToken } from "./config/publishing-config";

export const onRequest = defineMiddleware((context, next) => {
  if (!context.url.pathname.startsWith("/admin")) return next();
  const result = checkAdminAuth(context.request, {
    isConfigured: isPublishingConfigured(),
    expectedToken: loadAdminAccessToken(),
  });
  if (!result.allowed) {
    const headers = result.wwwAuthenticate ? { "WWW-Authenticate": result.wwwAuthenticate } : undefined;
    return new Response("Unauthorized", { status: result.status, headers });
  }
  return next();
});
```

### `astro.config.mjs` diff

```diff
 import { defineConfig } from "astro/config";
+import node from "@astrojs/node";

 export default defineConfig({
+  output: "server",
+  adapter: node({ mode: "standalone" }),
   legacy: { collectionsBackwardsCompat: true },
 });
```

### `eslint.config.js` diff

```diff
   "boundaries/elements": [
     { type: "content", pattern: "src/content/**" },
     { type: "view", pattern: "src/presentation/**" },
     { type: "config", pattern: "src/config/**" },
     { type: "lib", pattern: "src/lib/**" },
     { type: "publishing", pattern: "src/publishing/**" },
+    { type: "admin", pattern: "src/pages/admin/**" },
+    { type: "middleware", pattern: "src/middleware.ts" },
   ],
 ...
       rules: [
         { from: "content", allow: ["lib"] },
         { from: "view", allow: ["lib", "content"] },
         { from: "lib", allow: ["lib"] },
-        { from: "config", allow: ["lib"] },
+        { from: "config", allow: ["lib", "publishing"] },
         { from: "publishing", allow: ["lib", "content", "config"] },
+        { from: "admin", allow: ["content", "publishing", "config", "lib"] },
+        { from: "middleware", allow: ["config", "lib"] },
       ],
```

`view` gains no new edge; only `config` (factory needs to construct adapters) and the two new elements change.

## Testing Strategy

| Layer | What | Approach | Coverage-gate honesty |
|---|---|---|---|
| Unit | `LocalFsContentWriterAdapter` create/edit happy path, conflict, not-found, fs write failure | `vi.mock("node:fs/promises")`; assert `WriteResult` shapes, zero real disk I/O | Real branches per mode × outcome, mirrors the existing github-adapter test style |
| Unit | `buildContentPath()` | Pure fixture per collection/slug | Trivial but real — proves both adapters share one path rule |
| Unit | `isPublishingConfigured()` | `vi.stubEnv`; all-present / any-one-missing | Same idiom as `loadPublishingConfig()`'s existing test |
| Unit | `createContentWriter()` | Mock `isPublishingConfigured`; assert `instanceof GithubContentWriterAdapter` / `instanceof LocalFsContentWriterAdapter` | Real branch, proves composition-root wiring without hitting either real adapter's I/O |
| Unit | `checkAdminAuth()` | Real `Request`/`Headers` objects (Node globals, no Astro runtime needed): local-fallback bypass, fail-closed (no token), missing/malformed header, wrong token, correct token | The full security surface, unit-tested without mocking Astro — see "Auth-gate testability" decision |
| Unit | `timingSafeStringEqual()` | Equal match, equal-length mismatch, unequal-length mismatch | Proves the length-mismatch branch still exercises `timingSafeEqual` rather than short-circuiting |
| Not unit-testable | Astro actually invoking `src/middleware.ts` for real `/admin/**` requests; `prerender` flags producing real static files under the adapter's `dist/client/`+`dist/server/` split; `dist/server/entry.mjs` being runnable | **New `scripts/verify-admin-server.mjs`**: real `astro build`, spawn `node dist/server/entry.mjs`, real HTTP requests to `/admin` with/without correct Basic Auth and with publishing env vars unset — same genuine build-level proof pattern as the two existing verify scripts |
| Not re-tested | TS exhaustiveness of `WriteError`/`AdminAuthResult` unions (compiler-enforced); Astro's own routing/adapter internals | Re-testing the compiler or a third-party adapter isn't this change's job |

## Migration / Rollout

**`scripts/verify-content-collections.mjs` and `scripts/verify-frontmatter-round-trip.mjs` WILL break under `output: "server"` without changes** — this was verified by reading both scripts, not assumed:

1. Both scripts dynamically write a probe `.astro` page with no `prerender` export. Under `output: "server"`, a page with no explicit flag defaults to **server-rendered**, so `astro build` emits no static HTML for it at all — `readFileSync(probeDistPath)` would throw `ENOENT` immediately.
2. Both scripts hardcode `probeDistPath = dist/<route>/index.html`. Astro's adapter build splits output into `dist/client/` (static/prerendered assets) and `dist/server/` (SSR entry) — the flat `dist/<route>/index.html` path stops existing regardless of point 1.

Required fix, identical in both scripts: add `export const prerender = true;` to each `PROBE_PAGE_SOURCE` string, and change `probeDistPath` to `${rootDir}/dist/client/<route>/index.html`. No other changes needed — `cleanAstroBuildState()` already wipes all of `dist/`, and the Vite `ssrLoadModule` path in the round-trip script never touches Astro's content store or build output shape.

`npm run build`'s deployable artifact becomes `dist/server/entry.mjs` (run via `node ./dist/server/entry.mjs`) instead of a static `dist/` tree — CI's `Build` step is unaffected (`astro build` still exits 0), but a new `.github/workflows/ci.yml` step running `verify:admin-server` should follow it. No data migration: all new files are additive; existing `hello-world.md`/`profolio.md` content is untouched; rollback per proposal (revert `astro.config.mjs`, `package.json`, `eslint.config.js`, delete new files) requires no cleanup of written content since `LocalFsContentWriterAdapter` only ever writes plain markdown files a human can keep or discard independently of the code revert.

## Open Questions

- [ ] Should `src/middleware.ts` need its own boundaries element (`middleware` type added above), or does eslint-plugin-boundaries leave files outside all declared patterns unrestricted regardless? Included the element defensively; confirm via `npm run lint` during apply and drop it if redundant.
- [ ] Error-display UX on invalid create/edit POST: this design redirects back to the form with `?error=` and accepts losing unsaved input on create (edit still shows the last-persisted values). Acceptable given proposal's explicit "no theming/UX polish" scope, but flagged as a known rough edge.
