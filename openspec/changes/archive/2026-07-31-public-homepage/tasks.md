# Tasks: Real Public Blog/Portfolio Page (Home, Listings, Detail Routes)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~650-800 (three new pure-logic modules + tests, home-page rewrite, four new page files including two `getStaticPaths()` routes, `Layout.astro` nav diff, one new build-time proof script extended incrementally across phases, one modified + two new spec docs). Tighter than the proposal's pre-design ~700-1000 once design's File Changes table is priced bottom-up — smaller than profile-wizard's ~900-1300 (no publishing-port/middleware surface), larger than theme-system's ~350-500 (driven by four new page files) |
| 400-line budget risk | Low per-slice under the 4-way split below; the proposal's own aggregate estimate would have been Medium-High risk if shipped as one PR |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 → PR3 → PR4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low (per-slice)

**Note on the phase-count decision:** the proposal suggested a 3-slice split (predicate/sort/slug helpers → home+nav → listings/detail/proof-script), explicitly flagging that slice 3's `getStaticPaths()`/`.md`-suffix risk concentration might warrant isolating it further. Pricing design's File Changes table bottom-up confirms that flag is correct: slice 3 as proposed would have bundled two listing pages, two `getStaticPaths()` detail routes, AND the build-time proof script's six build passes (listing filter/sort ×2, detail resolution ×2, home ×2) into one PR — the single unit carrying this change's only genuinely unverified technical risk (`getStaticPaths()` + the `.md`-suffix id shape, never exercised through `getStaticPaths()` in this repo before) alongside its highest line count. This plan splits that slice in two, mirroring profile-wizard's precedent of isolating its highest-risk, most-novel module (`parseFrontmatterBlock()`) into its own dedicated unit rather than riding along with the feature that consumes it: **listing routes** (Unit 3, filtered/sorted, using Unit 1's helpers, lower risk — no `getStaticPaths()` involved) are separated from **detail routes + the `getStaticPaths()`/`.md`-suffix empirical proof + the admin-unaffected re-check** (Unit 4, the highest-risk unit, isolated for focused review exactly because it carries the change's one real unknown). This yields **4 units**, one more than the proposal's suggested 3, and keeps every unit's build-time proof-script extension scoped to what that unit itself introduces rather than deferring all verification to a final catch-all phase.

### Suggested Work Units

Tracker branch `feature/public-homepage` (draft, no-merge until all children land). Cascade: PR4 → PR3 branch → PR2 branch → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | Filter/sort/slug pure-logic helpers (TDD) | `feat/public-content-helpers` (base: tracker) | ~130-170 | Lowest risk, highest test density; no UI, no wiring; matches proposal's slice 1 exactly |
| 2 | Home page rewrite + minimal nav | `feat/public-home-nav` (base: PR1) | ~180-230 | First filter call site (home teaser); first empirical build proof of both home-page profile-presence states; nav regression check against every existing page rendered through `Layout.astro` |
| 3 | `/posts`, `/projects` listing routes | `feat/public-listing-routes` (base: PR2) | ~110-150 | Two more filter call sites; no `getStaticPaths()` involved — deliberately kept separate from Unit 4's higher-risk work |
| 4 | `/posts/[slug]`, `/projects/[slug]` detail routes + `getStaticPaths()`/`.md`-suffix empirical proof + admin-unaffected re-check | `feat/public-detail-routes` (base: PR3) | ~150-200 | Highest-risk unit, isolated per the note above; closes the final two of five filter call sites and issue #53 in full |

## Phase 1: Filter/Sort/Slug Helpers (Unit 1 — satisfies Symmetric Deleted/Draft Filter Predicate, Date-Descending Listing and Teaser Sort [helper logic], Slug Shape Handles the .md-Suffix Entry Id [helper logic])

- [x] 1.1 RED: `src/content/visibility.test.ts` — table-driven: `deleted:true` → `false`; `draft:true` (deleted unset/`false`) → `false`; both `true` → `false`; both unset/`false` → `true` — fails, module doesn't exist
- [x] 1.2 GREEN: create `src/content/visibility.ts` — `isPubliclyVisible(entry: CollectionEntry<"posts"|"projects">): boolean` exactly per design's Interfaces/Contracts (`!entry.data.deleted && !entry.data.draft`)
- [x] 1.3 RED: `src/content/sort.test.ts` — `byDateDesc()`: later date sorts before earlier; equal dates return `0`; already-descending and already-ascending inputs both sort correctly. `takeRecent()`: slices the first N; `count: 0` returns `[]`; `count` greater than array length returns the full array unchanged
- [x] 1.4 GREEN: create `src/content/sort.ts` — `byDateDesc()`, `takeRecent<T>()` exactly per design's Interfaces/Contracts
- [x] 1.5 RED: `src/content/slug.test.ts` — `toSlug()` strips exactly one trailing `.md` suffix; an id with no `.md` suffix is returned unchanged; an id containing `.md` as an interior substring (not a trailing suffix, e.g. `"my.md-post"`) is NOT altered — confirms the regex is anchored, not a blind string replace
- [x] 1.6 GREEN: create `src/content/slug.ts` — `toSlug(id): string` exactly per design's Interfaces/Contracts (`id.replace(/\.md$/, "")`)
- [x] 1.7 Verify: `npm run test` (coverage ≥80% all metrics), `npm run typecheck`, `npm run lint` all exit 0
- [x] 1.8 Commit as one work unit; open PR1 → tracker branch `feature/public-homepage`

## Phase 2: Home Page Rewrite + Minimal Nav (Unit 2 — satisfies First Public Route Consumes the Theme System [MODIFIED], Minimal Scope Boundary [MODIFIED, superseded], No-Profile Public Placeholder, Minimal Public Navigation, Filter Applied at the Home Teaser)

- [x] 2.1 RED: `src/content/profile-presence.test.ts` — `hasProfile(undefined)` → `false`; `hasProfile(<Profile>)` → `true` — the profile-presence branch condition, extracted per design's Testing Strategy so it is genuinely unit-tested rather than left as an untestable inline ternary
- [x] 2.2 GREEN: create `src/content/profile-presence.ts` — `hasProfile(profile): boolean`
- [x] 2.3 Rewrite `src/pages/index.astro`: `getProfile()` → `hasProfile()` branch renders either (a) profile hero via `TerminalWindow` using `title`/`role`/`bio`/`links` off `Profile`, or (b) the "no profile yet" placeholder (`TerminalWindow`/`BrutalistButton`, plain `<a href="/admin">` per design's plain-`<a>`-for-navigation decision) inviting the visitor to `/admin`; teaser: `getCollection("posts")`/`getCollection("projects")` → `.filter(isPubliclyVisible)` → map to the local `TeaserItem` shape (`{...toContentEntry(entry), href: "/posts/"+toSlug(entry.id)}` / `/projects/...`) → merge both collections → `.sort(byDateDesc)` → `takeRecent(3)` → render, each item linking to its detail route, plus "view all" links to `/posts` and `/projects`; keep `export const prerender = true` and the existing `data-theme-toggle` trigger working in both states
- [x] 2.4 Modify `src/presentation/Layout.astro` — add the `<nav>` with three static `<a>` links (`Home` → `/`, `Posts` → `/posts`, `Projects` → `/projects`) above `<slot />`, exactly per design's `Layout.astro` diff; no active-state highlighting, no mobile menu
- [x] 2.5 Create `scripts/verify-public-content-routes.mjs` (new sibling script, NOT an extension of `verify-content-collections.mjs` — per design's decision, the existing script proves schema/store resolution only and is already near its `max-lines: 300` budget) — first two scenarios: seed a `profile` fixture, real `astro build`, assert `dist/client/index.html` contains the hero's `title`/`role` and does NOT contain the placeholder copy; then remove the fixture, rebuild, assert the placeholder copy inviting the visitor to `/admin` IS present and the hero content is NOT — both real build passes, not mocked
- [x] 2.6 Register `"verify:public-routes": "node scripts/verify-public-content-routes.mjs"` in `package.json`
- [x] 2.7 **Nav regression check (carry-forward, mandatory — do not assume the nav addition is purely additive):** run the full existing verify-script suite (`npm run verify:content`, `verify:frontmatter`, `verify:admin-server`, `verify:profile-export-import`, `verify:theme`, `verify:env-file`) after the `Layout.astro` change; specifically confirm the admin login page, the admin listing, and the theme toggle still render and function correctly through the widened `Layout.astro` — actually run them, not author-and-assume
- [x] 2.8 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:public-routes` all exit 0
- [x] 2.9 Commit as one work unit; open PR2 → PR1 branch

## Phase 3: `/posts`, `/projects` Listing Routes (Unit 3 — satisfies Literal Per-Collection Listing Routes, Date-Descending Listing and Teaser Sort [listing build-proof half], Filter Applied at the /posts Listing, Filter Applied at the /projects Listing)

- [x] 3.1 Create `src/pages/posts/index.astro` — `getCollection("posts")` → `.filter(isPubliclyVisible)` → `.map(toContentEntry).sort(byDateDesc)` → render list, each entry linking to `/posts/${toSlug(entry.id)}`; own literal file, no `[collection]` dynamic segment
- [x] 3.2 Create `src/pages/projects/index.astro` — identical pattern against `getCollection("projects")`, linking to `/projects/${toSlug(entry.id)}`
- [x] 3.3 Extend `scripts/verify-public-content-routes.mjs` — seed one `deleted:true` and one `draft:true` fixture in EACH of `posts`/`projects`, real `astro build`, assert `dist/client/posts/index.html` and `dist/client/projects/index.html` do NOT contain either fixture's title, and that the remaining visible entries appear in the rendered HTML in descending `date` order
- [x] 3.4 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:public-routes` all exit 0
- [x] 3.5 Commit as one work unit; open PR3 → PR2 branch

## Phase 4: `/posts/[slug]`, `/projects/[slug]` Detail Routes + `getStaticPaths()`/`.md`-Suffix Proof + Admin-Unaffected Re-Check (Unit 4 — satisfies Detail Routes via getStaticPaths(), Slug Shape Handles the .md-Suffix Entry Id [build-verified half], Filter Applied at /posts/[slug]'s getStaticPaths(), Filter Applied at /projects/[slug]'s getStaticPaths(), Admin Reads Remain Unfiltered)

- [x] 4.1 Create `src/pages/posts/[slug].astro` — `getStaticPaths()` exactly per design's resolved code: `getCollection("posts")` → `.filter(isPubliclyVisible)` → `.map((entry) => ({ params: { slug: toSlug(entry.id) }, props: { entry: toContentEntry(entry) } }))`; page body renders `entry.title` and raw `entry.body` in a `<pre>` inside `TerminalWindow`, zero additional fetch
- [x] 4.2 Create `src/pages/projects/[slug].astro` — identical pattern against `getCollection("projects")`, same `../../` import depth, no other line changes per design's note
- [x] 4.3 **Empirical `getStaticPaths()`/`.md`-suffix verification (carry-forward, mandatory — do not trust design's derivation alone, even though it was read directly from Astro's real type definitions):** extend `scripts/verify-public-content-routes.mjs` — real `astro build`, assert `dist/client/posts/<real-slug>/index.html` and `dist/client/projects/<real-slug>/index.html` (extensionless paths) genuinely exist for a real non-deleted/non-draft fixture in each collection, and that the rendered HTML contains that entry's correct title/body — confirms the extensionless-slug-to-suffixed-`entry.id` resolution actually works against real build output, not assumed from `toSlug()`'s existing pattern transferring unmodified
- [x] 4.4 **Five-call-site fixture verification, detail-route half (carry-forward, mandatory):** extend the same script — seed one `deleted:true` and one `draft:true` fixture in EACH collection, real `astro build`, assert NO file exists at all at `dist/client/posts/<deleted-slug>/index.html`, `dist/client/posts/<draft-slug>/index.html`, and the equivalent `projects/**` paths — confirms `getStaticPaths()` generated no path whatsoever for these entries, not merely that they're absent from a listing
- [x] 4.5 **Admin-unaffected re-verification (carry-forward, mandatory — do not assume unchanged):** confirm via `scripts/verify-admin-server.mjs` (extend if it does not already assert this) that `/admin`'s listing still shows the same `deleted:true`/`draft:true` fixture entries this change's public build-time proof excludes — proving the two read paths genuinely diverge as designed, not silently coupled. Implemented as a new sibling script (`scripts/verify-admin-listing-unfiltered.mjs`) instead of extending `verify-admin-server.mjs` directly — that file was already at its `max-lines: 300` ESLint budget and extending it in place pushed it over; the new script follows the same self-contained-proof-script precedent as `verify-public-content-routes.mjs`.
- [x] 4.6 **Cross-check task (mandatory, carry-forward):** inspect all five public call sites together — home teaser (2.3), `/posts` (3.1), `/projects` (3.2), `/posts/[slug]`'s `getStaticPaths()` (4.1), `/projects/[slug]`'s `getStaticPaths()` (4.2) — confirm every one applies `isPubliclyVisible()` consistently and none was missed; note the result in the PR description as closing issue #53 in full. **Result: confirmed — all five call sites apply `isPubliclyVisible()` consistently; `admin/index.astro` correctly has no filter. Noted in PR #70's description, closing issue #53 in full.**
- [x] 4.7 Verify: `npm run test` (coverage ≥80% all metrics under strict TDD — this is the 10th real feature-code change under that gate), `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:public-routes`, and the full existing verify-script suite (`verify:content`, `verify:frontmatter`, `verify:admin-server`, `verify:profile-export-import`, `verify:theme`, `verify:env-file`) all exit 0. Also ran the new `verify:admin-listing` script — all exit 0.
- [x] 4.8 Commit as one work unit; open PR4 → PR3 branch (final child; cascades to tracker → main). PR4 = https://github.com/rodrigoperaltadev/profolio/pull/70, CI (Quality Gate) passed in 1m12s.

## Next Step

All 4 phases complete (30/30 tasks: 8+9+5+8). PR4 (#70) is open targeting `feat/public-listing-routes`, CI green. Next: cascade-merge the chain (PR4 → PR3 → PR2 → PR1 → tracker `feature/public-homepage` → `main`), then close issues #52 and #53. This change is otherwise fully implemented.
