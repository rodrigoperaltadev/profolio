# Design: Real Public Blog/Portfolio Page (Home, Listings, Detail Routes)

## Technical Approach

Four new/rewritten `.astro` pages consume the existing, unmodified read accessors (`getProfile()`, `getCollection()` + `toContentEntry()`) directly — no new data-access abstraction, matching `admin/index.astro`'s precedent. Two new pure-function modules (`isPubliclyVisible`, sort/slug helpers) sit under `src/content/**` and are called at every public read site. `Layout.astro` gains three static anchors. A new sibling build-time proof script exercises real `astro build` output. The `getStaticPaths()` `.md`-suffix risk (below) is resolved empirically, not assumed.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| Predicate signature | `isPubliclyVisible(entry: CollectionEntry<"posts"\|"projects">): boolean` in new `src/content/visibility.ts` | Take `ContentEntry` instead | `ContentEntry` (`entry.ts`) has no `deleted` field — filtering must happen on the raw entry, *before* `toContentEntry()` |
| Sort/slice shape | `byDateDesc(a: {date: Date}, b: {date: Date}): number` (comparator) + `takeRecent<T>(items: readonly T[], n: number): T[]` (generic slice), both in new `src/content/sort.ts` | A single `sortByDateDesc(ContentEntry[])` returning `ContentEntry[]` | The home teaser must merge `posts` + `projects` while keeping per-collection `href`s (see below); a generic comparator works on any `{date}`-shaped object, including that local teaser-item type, without touching the shared `ContentEntry` contract |
| Slug derivation | New `src/content/slug.ts::toSlug(id): string` = `id.replace(/\.md$/, "")`, used by all 6 public call sites | Import/refactor admin's local `toSlug()` in `collection-section.astro` | Admin is explicitly out of scope; duplicating a 1-line pure function is cheaper than touching admin's file for a non-functional refactor |
| Navigation links vs. `BrutalistButton` | Plain `<a>` for all navigation (teaser "view all", placeholder CTA, `Layout.astro` nav); `BrutalistButton` stays reserved for its existing JS-triggered `<button>` role (theme toggle) | Extend `BrutalistButton`'s `Props` with an `href`/anchor-rendering mode | `BrutalistButton` renders a hardcoded `<button>` (confirmed in its source); it isn't in this proposal's Affected Areas. Semantic `<a>` for navigation is also simply correct HTML |
| Body rendering on detail pages | Render `entry.body` as raw markdown text in a `<pre>` | Render to HTML via `entry.render()`/`<Content />` | No call site in this repo renders markdown to HTML today (`edit.astro` shows raw body in a `<textarea>`); introducing a renderer is unrequested scope |
| Build-time proof script | New `scripts/verify-public-content-routes.mjs`, not an extension of `verify-content-collections.mjs` | Extend the existing script | `verify-content-collections.mjs` proves schema/store resolution only (2 scenarios, ~90 code lines under `max-lines: 300`). This change needs ~6 build passes (filtered listing×2, detail resolution×2, home with/without profile) — extending would push it well past 300 code lines, the exact shape that forced `verify-profile-export-import.mjs` as a new sibling script in profile-wizard Phase 5 |

## The `getStaticPaths()` / `.md`-suffix risk — resolved

Confirmed via `node_modules/astro/dist/types/public/common.d.ts`: `GetStaticPathsItem = { params: Params; props?: Props }`. `params` values become the literal URL segment; `props` is passed to the page untouched (no re-fetch needed). Confirmed via `profile.ts`'s and `collection-section.astro`'s comments (and the raw sample content) that `entry.id` carries the `.md` suffix under `legacy.collectionsBackwardsCompat: true`. So `params.slug` must be `toSlug(entry.id)`, and `props.entry` must carry the already-mapped `ContentEntry` so the page body needs zero additional fetches.

`src/pages/posts/[slug].astro`:
```astro
---
export const prerender = true;
import { getCollection } from "astro:content";
import type { GetStaticPaths, InferGetStaticPropsType } from "astro";
import Layout from "../../presentation/Layout.astro";
import TerminalWindow from "../../presentation/brutalist/TerminalWindow.astro";
import { isPubliclyVisible } from "../../content/visibility";
import { toContentEntry } from "../../content/_mappers/to-content-entry";
import { toSlug } from "../../content/slug";

export const getStaticPaths = (async () => {
  const entries = await getCollection("posts");
  return entries.filter(isPubliclyVisible).map((entry) => ({
    params: { slug: toSlug(entry.id) },
    props: { entry: toContentEntry(entry) },
  }));
}) satisfies GetStaticPaths;

type Props = InferGetStaticPropsType<typeof getStaticPaths>;
const { entry } = Astro.props as Props;
---
<Layout title={entry.title}>
  <main class="min-h-screen p-4">
    <TerminalWindow>
      <h1 class="text-text-primary font-mono">{entry.title}</h1>
      <pre class="whitespace-pre-wrap font-mono text-text-secondary">{entry.body}</pre>
    </TerminalWindow>
  </main>
</Layout>
```

`src/pages/projects/[slug].astro` is identical except `getCollection("projects")` and the import path depth (same `../../` prefix, same file names) — no other line changes.

## Data Flow

```
getCollection("posts"/"projects") ──filter(isPubliclyVisible)──┬─→ listings: .map(toContentEntry).sort(byDateDesc)
                                                                 └─→ home teaser: .map(toContentEntry) + local href → merge both collections → sort(byDateDesc) → takeRecent(3)
getStaticPaths(): filter(isPubliclyVisible) → { params: {slug: toSlug(id)}, props: {entry: toContentEntry(entry)} } → detail page (zero extra fetch)
getProfile() ──→ index.astro: profile ? hero : placeholder
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/content/visibility.ts` | New | `isPubliclyVisible()` + unit tests |
| `src/content/sort.ts` | New | `byDateDesc()`, `takeRecent()` + unit tests |
| `src/content/slug.ts` | New | `toSlug()` + unit tests (public-side only, admin untouched) |
| `src/pages/index.astro` | Rewrite | Profile hero / placeholder + merged, sorted, sliced teaser |
| `src/pages/posts/index.astro`, `src/pages/projects/index.astro` | New | Filtered, sorted listings linking to detail routes via `toSlug()` |
| `src/pages/posts/[slug].astro`, `src/pages/projects/[slug].astro` | New | `getStaticPaths()` per above |
| `src/presentation/Layout.astro` | Modify | 3 static `<a>` links above `<slot />` |
| `scripts/verify-public-content-routes.mjs` | New | Build-time proof (see below) |
| `openspec/specs/public-pages/spec.md` | Modify (via sdd-spec) | See coordination note below |

## Interfaces / Contracts

```ts
// src/content/visibility.ts
export function isPubliclyVisible(entry: CollectionEntry<"posts" | "projects">): boolean {
  return !entry.data.deleted && !entry.data.draft;
}
// src/content/sort.ts
export function byDateDesc(a: { date: Date }, b: { date: Date }): number {
  return b.date.getTime() - a.date.getTime();
}
export function takeRecent<T>(items: readonly T[], count: number): T[] {
  return items.slice(0, count);
}
// src/content/slug.ts
export function toSlug(id: string): string {
  return id.replace(/\.md$/, "");
}
```

`index.astro`'s teaser type is local, not exported: `type TeaserItem = ContentEntry & { href: string }`, built as `{ ...toContentEntry(entry), href: `/posts/${toSlug(entry.id)}` }` (and `/projects/...`), so `[...posts, ...projects].sort(byDateDesc)` works without any shared-contract change. `TerminalWindow`/`BrutalistButton` `Props` are unmodified — `title`/`role`/`bio`/`links` come straight off `Profile` (`profile.ts`'s `CollectionEntry<"profile">["data"]`).

## `Layout.astro` diff

Above `<slot />`, inside `<body>`:
```html
<nav>
  <a href="/">Home</a>
  <a href="/posts">Posts</a>
  <a href="/projects">Projects</a>
</nav>
```

## Coordination note for `sdd-spec` (running in parallel)

`openspec/specs/public-pages/spec.md` needs:
- `## REMOVED Requirements` → `### Requirement: Minimal Scope Boundary` with `(Reason: superseded by public-homepage (#52) — index.astro now renders real profile/content data by design)`.
- `## MODIFIED Requirements` → full replacement of `### Requirement: First Public Route Consumes the Theme System`, scenarios rewritten for profile hero + teaser (keep `prerender = true`, keep `Layout`/theme composition framing).
- `## ADDED Requirements` → home content rendering, "no profile yet" placeholder, minimal nav — each with Given/When/Then scenarios per this design's composition above.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit (Vitest) | `isPubliclyVisible`, `byDateDesc`, `takeRecent`, `toSlug`, profile-presence branch (extracted as a pure `hasProfile(profile): boolean`-style condition if not trivially inline-testable) | Table-driven, fixtures matching `CollectionEntry` shape |
| Build-time proof | Listing filter/sort order, `getStaticPaths()` resolution for both collections, home page with/without profile fixture | New `scripts/verify-public-content-routes.mjs`, real `astro build`, asserting `dist/client/**/index.html` content (same pattern as `verify-content-collections.mjs`) |
| Not tested | `.astro` markup/styling itself | Covered structurally by the build-time proof's HTML assertions, not Vitest |

## Migration / Rollout

No schema/data migration. Both existing sample entries have `deleted` defaulted `false` and explicit `draft: false` (`hello-world.md`, `profolio.md`) — both become publicly visible for the first time (previously no public read path existed at all). No entry is newly *hidden* by this change; the filtering gap this change closes (#53) has been theoretical until now, exactly as the proposal states.

## Open Questions

- [x] Whether `sdd-tasks` splits delivery per the proposal's 3-slice recommendation (predicate/sort/slug helpers → home+nav → listings/detail/proof-script) given slice 3's `getStaticPaths()` risk concentration. **RESOLVED: 4-way split adopted per tasks.md Phase breakdown, isolating the highest-risk unit (detail routes + `getStaticPaths()` verification) into its own PR for focused review.**
