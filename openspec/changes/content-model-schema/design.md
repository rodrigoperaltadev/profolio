# Design: Content-Agnostic Content Model & Schema

## Technical Approach

Two native Astro Content Collections (`posts`, `projects`) are defined via `defineCollection` + Zod. Each collection's Zod-inferred frontmatter type is converted, by a single dispatch-table mapper in `src/content/**`, into one shared `ContentEntry` shape — the only type `src/presentation/**` is allowed to import (already enforced by `boundaries/element-types`: `view -> [lib, content]`, `content -> [lib]`). Raw Zod schemas are split into their own module with no `astro:content` import, so the schema-validation surface is unit-testable without an Astro runtime. `vitest.config.ts` moves to `getViteConfig()`, which is also what makes `astro:content` resolvable inside Vitest at all (the prior `defineConfig` deviation existed only because `astro.config.mjs` didn't exist yet).

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Mapper shape | One dispatch-table object (`{ posts: fn, projects: fn }`) + generic `toContentEntry()` lookup | `switch` on `entry.collection`; one exported function per collection called ad hoc from view code | A 3rd collection adds one object key, zero new branches/control-flow in the dispatcher — matches the proposal's "no code changes" claim literally, including at ESLint's cognitive-complexity/branch-counting level |
| Schema/config split | `src/content/schemas.ts` (pure Zod, no `astro:content` import) separate from `src/content/config.ts` (`defineCollection` wiring) | One file with schemas inlined in `config.ts` | Isolates the coverage-risk surface: schemas are directly unit-testable via `.safeParse()` with zero Astro runtime dependency; `config.ts` stays declarative and near-zero-branch |
| Collections API | Legacy `defineCollection({ type: "content", schema })` | Content Layer API (`loader: glob(...)`) | Sufficient for the locked folder-per-collection markdown layout; avoids introducing loader-config decisions out of this change's scope; swappable later without touching `ContentEntry` or the mapper |
| Legacy collections flag | `astro.config.mjs` sets `legacy: { collectionsBackwardsCompat: true }` | Leave unset (default) | **Required**, not optional, for the "Collections API" choice above: Astro 7.1.4's legacy `defineCollection({ type: "content" })` only wires into `store.hasCollection()`/`getCollection()` when this flag is set — without it, `getCollection()` silently returns `[]` for both valid and malformed content (no error, no warning beyond a console.warn), so the model never actually loads through Astro's runtime despite `astro build` exiting 0. Found post-merge by `sdd-verify` reproducing with a temporary page; fixed in the same fix cycle that relocated `mappers/` below |
| Non-collection folder in `src/content/` | Rename `src/content/mappers/` → `src/content/_mappers/` (leading underscore) | (a) Move mapper module to a new sibling directory (e.g. `src/content-logic/**`) and extend `eslint.config.js`'s `boundaries/elements` glob for the `content` element type; (b) migrate to Content Layer API `loader: glob()` now instead of later | With `collectionsBackwardsCompat` on, Astro auto-detects every top-level folder under `src/content/` that isn't an explicitly defined collection and turns it into a phantom auto-generated collection (here: `mappers`, which holds `.ts` files, so it matches 0 markdown files and only produces a `console.warn`) — root-caused in `node_modules/astro/dist/content/utils.js`'s `autogenerateCollections()`. That function explicitly skips any top-level directory name starting with `_` or `.` (the same convention Astro's own content-entry glob already uses to ignore files, e.g. `!**/_*.md`), so a plain rename resolves the collision with a one-line diff, no relocation, no eslint boundaries change, and `src/content/_mappers/**` still matches the existing `content` element's `src/content/**` pattern unchanged. Verified: `_mappers` never appears in `astro sync`/`astro build` output; `getCollection()` still returns real data (`posts:1`/`projects:1`) with the flag on |
| Shared shape ownership | `ContentEntry` type lives in `src/content/entry.ts` | Move it to `src/lib/**` | `view -> content` is already an allowed boundary edge; the type is content-domain output, not a generic utility — no reason to relocate it into `lib` |
| Facet unification | `posts.tags` and `projects.stack` both map to `ContentEntry.tags` | Keep separate `tags`/`stack` fields on the shared shape | Both are semantically "descriptive facet lists"; a shared shape with per-collection field names would leak collection identity into the view layer |
| Validation seam | Dedicated `parseEntry()` wrapper around `schema.safeParse()` | Call `.safeParse()` ad hoc at each call site | One reusable, directly-testable function with a real (non-vacuous) success/failure branch; also gives issue #4's publishing pipeline a stable validation entry point |

## File Changes

| File | Action | Description |
|---|---|---|
| `astro.config.mjs` | Create | First Astro install; enables `astro:content` and `getViteConfig()`. **Post-merge fix**: also sets `legacy: { collectionsBackwardsCompat: true }` — required for the legacy `defineCollection({ type: "content" })` API to actually wire `getCollection()` to real data (see Architecture Decisions) |
| `src/content/schemas.ts` | Create | Raw Zod schemas for `posts`/`projects`, no `astro:content` import |
| `src/content/config.ts` | Create | `defineCollection` + `collections` export, wires `schemas.ts` |
| `src/content/entry.ts` | Create | `ContentEntry` shared display shape |
| `src/content/validate-entry.ts` | Create | `parseEntry()` pure validation wrapper |
| `src/content/_mappers/to-content-entry.ts` | Create | Per-collection mapping table + `toContentEntry()` dispatcher. **Post-merge fix**: relocated from `src/content/mappers/` to `src/content/_mappers/` — see Architecture Decisions, "Non-collection folder in `src/content/`" |
| `src/content/posts/hello-world.md` | Create | Sample `posts` entry |
| `src/content/projects/profolio.md` | Create | Sample `projects` entry |
| `vitest.config.ts` | Modify | `defineConfig` → `getViteConfig()` |
| `package.json` | Modify | Add `astro` and `zod` dependencies (`zod` standalone, so `schemas.ts` resolves in Vitest without Astro's Vite plugin). **Post-merge fix**: add `verify:content` script |
| `scripts/verify-content-collections.mjs` | Create (post-merge fix) | Build-time proof that `getCollection()` resolves real content and rejects malformed content — see "Build-Time Content Proof" below |
| `.github/workflows/ci.yml` | Modify (post-merge fix) | Add `verify:content` as a CI step after `build` |
| `eslint.config.js` | Modify (post-merge fix) | Add a narrow `scripts/**/*.mjs` override (`disableTypeChecked` + explicit Node globals + `explicit-function-return-type: off`, since a plain `.mjs` run via `node` cannot carry TS return-type syntax) — `boundaries/element-types` itself is unmodified |

## Interfaces / Contracts

```ts
// src/content/schemas.ts — pure Zod, no astro:content import (directly unit-testable)
import { z } from "zod"; // standalone package, NOT astro:content's re-export — this is what makes
// this module resolvable in Vitest without Astro's Vite plugin, which is the entire point of
// splitting schemas.ts out from config.ts (see Architecture Decisions: "Schema/config split")
export const postsSchema = z.object({
  title: z.string(),
  date: z.coerce.date(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
});
export const projectsSchema = z.object({
  name: z.string(),
  stack: z.array(z.string()).default([]),
  link: z.string().url(),
  date: z.coerce.date(),
  draft: z.boolean().default(false),
});
```

```ts
// src/content/config.ts — declarative only, near-zero branches
import { defineCollection } from "astro:content";
import { postsSchema, projectsSchema } from "./schemas";

export const collections = {
  posts: defineCollection({ type: "content", schema: postsSchema }),
  projects: defineCollection({ type: "content", schema: projectsSchema }),
};
```

```ts
// src/content/entry.ts — the single contract src/presentation/** may import
export interface ContentEntry {
  readonly id: string;
  readonly title: string;
  readonly date: Date;
  readonly draft: boolean;
  readonly tags: readonly string[];
  readonly link?: string;
  readonly body: string;
}
```

```ts
// src/content/validate-entry.ts — one real branch, testable in isolation
import type { z } from "zod";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseEntry<T>(schema: z.ZodType<T>, input: unknown): ParseResult<T> {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, data: result.data }
    : { ok: false, error: result.error.message };
}
```

```ts
// src/content/mappers/to-content-entry.ts
import type { CollectionEntry, CollectionKey } from "astro:content";
import type { ContentEntry } from "../entry";

type Mapper<C extends CollectionKey> = (entry: CollectionEntry<C>) => ContentEntry;

const mappers: { posts: Mapper<"posts">; projects: Mapper<"projects"> } = {
  posts: (entry) => ({
    id: entry.id,
    title: entry.data.title,
    date: entry.data.date,
    draft: entry.data.draft,
    tags: entry.data.tags,
    body: entry.body ?? "",
  }),
  projects: (entry) => ({
    id: entry.id,
    title: entry.data.name,
    date: entry.data.date,
    draft: entry.data.draft,
    tags: entry.data.stack,
    link: entry.data.link,
    body: entry.body ?? "",
  }),
};

export function toContentEntry<C extends CollectionKey>(entry: CollectionEntry<C>): ContentEntry {
  return mappers[entry.collection](entry);
}
```

Adding a 3rd collection = one `schemas.ts` block + one `defineCollection` line + one `mappers` object key. No `switch`, no new `if`, no edit to `entry.ts` or `to-content-entry.ts`'s dispatcher logic.

## `vitest.config.ts` Migration

```ts
import { getViteConfig } from "astro/config";

export default getViteConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

Gotchas:
- `getViteConfig()` requires `astro.config.mjs` at repo root — this change adds it, resolving the documented prior deviation.
- It merges Astro's own Vite plugins (including the content-collections virtual-module resolver), which is what makes `astro:content` importable from test files at all — without it, importing `schemas.ts`/`config.ts` in a `.test.ts` fails to resolve.
- First test run after migration is measurably slower (Astro dev-server-style setup cost); acceptable, isolate as its own task/commit before layering content work on top per the proposal's risk mitigation.
- No component tests exist yet, so the default test environment (`node`) stays; if `.astro` component tests are added later, `environment: 'happy-dom'` will need to be set explicitly — not needed for this change.

## Testing Strategy

| What | Approach | Why (coverage-gate honesty) |
|---|---|---|
| `postsSchema`/`projectsSchema` happy + failure path | Vitest, call `.safeParse()` directly, no Astro runtime | Real success/failure branches, no `astro:content` needed since schemas import only `z` |
| `parseEntry()` ok/error branches | Vitest, valid + invalid fixtures | The one deliberate branch this file exists to hold — both outcomes must be asserted, not just declared |
| `mappers.posts` / `mappers.projects` field mapping | Vitest, plain fixture objects cast `as CollectionEntry<'posts'|'projects'>` | Pure functions; no Astro build required to test them |
| `toContentEntry()` dispatch | Vitest, one fixture per collection, assert correct routing | Proves the lookup table over both current keys |
| `collections` export smoke check | Vitest (via `getViteConfig`, `astro:content` resolvable), assert both keys exist | Trivial statement coverage on a genuinely zero-branch file — no fake branches invented to satisfy the gate |
| Full pipeline | `npm run build` with both sample `.md` files present | Outside Vitest coverage scope; proves the model end-to-end (real Astro build, not simulated) |
| `getCollection()` end-to-end (valid + malformed) | `npm run verify:content` (`scripts/verify-content-collections.mjs`) — real `astro build`, not Vitest | See "Build-Time Content Proof" below — post-merge fix, added after `sdd-verify` found this gap |
| Not re-tested | Zod's own `.default()`/`.coerce.date()` behavior; TS structural typing of `ContentEntry` | Guaranteed by the library and `tsc --strict`; re-testing it would be testing the dependency, not this change's code |

This mirrors the prior change's coverage-gate lesson: a pass-through with zero branches trivially satisfies branch coverage without proving anything (`config.ts`, by design, is exactly that and is *not* relied on to carry the 80% bar). `parseEntry()` and the mapper table are where the real, non-vacuous branch/function coverage lives.

## Build-Time Content Proof (post-merge fix)

`sdd-verify` found that all 13 unit tests, typecheck, lint, and `npm run build` passed while `getCollection()` silently returned `[]` for both valid and malformed content — because the unit tests hand-build `CollectionEntry`-shaped fixtures and cast them (a legitimate, deliberate choice for unit-testing the mapper/schema in isolation per the Testing Strategy table above), and `npm run build` never had a page that actually called `getCollection()`, so nothing exercised Astro's real content-loading pipeline end-to-end.

Investigated and rejected two lighter-weight alternatives before landing on a build script:
- **A Vitest test importing `astro:content` directly** (even with `getViteConfig()`, which is what makes the module resolvable at all) — confirmed empirically that `getCollection()` returns `[]` every time in a bare Vitest process, with or without a prior `astro sync`. Root cause: Astro's content store (`globalDataStore`) is populated by the content-layer sync that runs as part of a real `astro build`/`astro dev` process lifecycle, not by importing the virtual module cold.
- **`astro/container`'s `experimental_AstroContainer`** (Astro's own documented API for testing `.astro` components in isolation) — same result, confirmed empirically: rendering a component that calls `getCollection()` through the container API still reads an empty store, because the container API renders a component, it does not run Astro's content-layer sync either.

Both alternatives were falsified by direct reproduction, not assumption — see `scripts/verify-content-collections.mjs`'s own header comment for the same reasoning inline.

**Chosen approach**: `scripts/verify-content-collections.mjs`, wired as `npm run verify:content` and a dedicated CI step after `npm run build`. It:
1. Writes a temporary `src/pages/content-proof.astro` page that calls the real `getCollection("posts")` / `getCollection("projects")` and renders the counts.
2. Runs a genuinely clean `astro build` (`.astro/` + `dist/` removed first) and asserts the built HTML contains `posts:1` / `projects:1` — proving valid content actually resolves through the real pipeline, not just types/build-exits-0.
3. Adds a second, deliberately malformed content entry (wrong type + missing required field) and re-runs a clean `astro build`, asserting the build now fails (non-zero exit) — proving the schema validation gate is real, not just declared.
4. Cleans up all temporary files (probe page, malformed entry, `.astro`/`dist`) in a `finally` block regardless of outcome, so the working tree is unaffected by a `verify:content` run.

Gotcha discovered while writing this script: the temporary malformed fixture's filename must not start with `_` — Astro's own content glob (`!**/_*.md`) silently excludes underscore-prefixed entries from loading entirely, which would make the malformed-content assertion falsely pass (build succeeds because the bad file was never read, not because it was validated and accepted). The probe *page* has the opposite constraint: it must NOT be named with a leading underscore either, since Astro's router also ignores underscore-prefixed files/folders under `src/pages/` — that would make the proof falsely pass because the page (and its `getCollection()` call) was simply never built.

## Sample Content

```md
<!-- src/content/posts/hello-world.md -->
---
title: "Hello World"
date: 2026-07-27
tags: ["meta", "profolio"]
draft: false
---
First sample post proving the `posts` schema end-to-end.
```

```md
<!-- src/content/projects/profolio.md -->
---
name: "Profolio"
stack: ["Astro", "TypeScript", "Zod"]
link: "https://github.com/rodrigoperaltadev/profolio"
date: 2026-07-27
draft: false
---
Git-as-CMS content engine — the project this repo builds.
```

## Migration / Rollout

No migration required — first feature-code change, fully additive plus one isolated `vitest.config.ts` modification. Rollback per proposal: remove `astro.config.mjs`, `src/content/**`, revert `vitest.config.ts` and `package.json`.

## Open Questions

- [ ] Content Layer API (`loader: glob()`) migration timing — not blocking; internal to `config.ts`, invisible to `ContentEntry`/mapper consumers, revisit whenever Astro deprecates the legacy `type: "content"` shorthand.
