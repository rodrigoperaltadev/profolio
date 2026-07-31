# Proposal: Real Public Blog/Portfolio Page (Home, Listings, Detail Routes)

Cross-references: GitHub #52 (this change), #53 ("Add read-side filtering for logically-deleted entries" — this change absorbs and effectively CLOSES #53's core gap; a comment noting this absorption was already left on #53), #57 (profile-wizard, archived — `getProfile()`/`Profile` is this change's home-page data source), #6/#9 (theme-system, archived — `Layout.astro`, `TerminalWindow`, `BrutalistButton`, `themes/brutalist/theme.css` are what this change composes from; `src/pages/index.astro`'s "Minimal Scope Boundary" requirement is explicitly superseded, not silently violated). Explicitly OUT of scope per issue #52: a second theme preset (#54), admin UI changes, publishing-layer changes.

## Intent

profolio has a real content model (`posts`/`projects`/`profile`), a real write path (`/admin/**`), and a real theme system — but the only public route today, `src/pages/index.astro`, is a deliberately minimal proof page that its own spec forbids from importing `src/content/**` at all. A fresh clone that completes the setup wizard and writes a profile plus a few posts/projects still has nothing to show a real visitor: no home page that renders the profile, no way to browse posts or projects, no page for an individual entry. This is the one remaining piece between "the machinery works" and "this is actually a personal site," per the README's own stated Vision (clone → fill profile → pick theme → deploy → a real site like rodrigoperalta.ar).

This change also closes a latent correctness gap discovered during exploration and confirmed by the user: today NOTHING filters `deleted:true` or `draft:true` entries anywhere — `admin-authoring`'s own spec requires admin to show everything (correct, unchanged), but no public read path has ever existed to filter for, so the gap has been theoretical until now. Shipping this change's public pages without filtering would ship a real, immediately-visible bug on day one of having any public content page — the same reasoning already recorded on issue #53, which this change absorbs.

## Scope

### In Scope

- **Home page rewrite** (`src/pages/index.astro`): profile hero (via `getProfile()`, reusing `TerminalWindow`) followed by a "recent posts/projects" teaser (a handful of the most recent, filtered entries) linking out to `/posts` and `/projects` — **locked decision** (user-confirmed): not a profile-only home.
- **Listing routes**: `/posts` and `/projects` (`src/pages/posts/index.astro`, `src/pages/projects/index.astro`) — separate literal routes, one per collection.
- **Detail routes**: `/posts/[slug]` and `/projects/[slug]` (`src/pages/posts/[slug].astro`, `src/pages/projects/[slug].astro`) with `getStaticPaths()` — **locked decision** (user-confirmed): no `[collection]` dynamic-segment generalization on the public side; admin's `parseCollectionParam` pattern solves a different problem (shared write-form dispatch) and does not cleanly generalize to a fixed two-collection public read side.
- **"No profile yet" public placeholder** — **locked decision** (user-confirmed, in scope): when `getProfile()` returns `undefined`, the home page renders a friendly placeholder state inviting the operator to visit `/admin` and complete setup, instead of an empty/broken-looking hero. This is distinct from and not covered by #57's `/admin/**`-only first-run redirect.
- **Deleted/draft filtering on the public read side** — **locked decision** (user-confirmed, in scope): every public `getCollection("posts"/"projects")` call (home teaser, listings, detail-route `getStaticPaths()`) applies a filter predicate excluding `deleted: true` AND `draft: true`, symmetrically. Admin's own `getCollection()` calls in `src/pages/admin/**` are untouched — admin must still show everything, per its own already-shipped `admin-authoring` spec. **This effectively closes issue #53.**
- **Sort order** — **locked as a sensible default, not an open question**: listings and the home teaser sort by `date` descending (most recent first).
- **Minimal shared navigation** — **this proposal's own call, not asked to the user, decided concretely**: yes, a minimal nav is needed for the site to be navigable between Home/`/posts`/`/projects` — without it, a visitor on `/posts` has no way back to Home or over to `/projects` short of editing the URL. Scoped minimally: a few static links (`Home`, `Posts`, `Projects`) added directly into `src/presentation/Layout.astro`'s `<body>`, above `<slot />` — the one shared entry point every public page already imports. No new component file, no active-link highlighting, no mobile menu, no nav "system."
- Unit-testable logic extracted and covered under the 80% Vitest gate: the deleted/draft filter predicate, the "no profile yet" detection, and the date-descending sort/teaser-slice logic.
- A build-time proof script (new or extended — design/apply decides) that runs a real `astro build` and asserts, against real emitted output: listing pages exclude `deleted`/`draft` entries and are sorted date-descending; detail routes resolve for non-deleted/non-draft entries via `getStaticPaths()`; the home page renders the profile hero when a profile exists and the placeholder when it doesn't.

### Out of Scope

- A second theme preset (#54) — explicitly out of scope per the issue; this change ships against the existing single `brutalist` preset only.
- Admin UI changes of any kind — `src/pages/admin/**`'s listing, forms, and the `admin-authoring` spec's "Logical-Delete Visibility Disclosure" requirement are untouched. That requirement's wording ("remains publicly visible on the live site, since no read-side filtering exists") is **not** revised by this change, per explicit instruction — filtering reduces how many visitors will ever encounter a deleted entry going forward, it does not retroactively change what admin must disclose at delete-time.
- Publishing-layer changes — `ContentWriter`, both adapters, `buildMarkdownFile()`/`parseFrontmatter()`/`parseEntry()` are untouched.
- Pagination on `/posts`/`/projects` — not addressed by this change; if entry counts grow large enough to matter, that is future work.
- RSS/sitemap generation, SEO metadata beyond what `Layout.astro`'s existing `<title>` prop already provides, comment systems, search, tag-filtering UI — none of these were asked for and none are built speculatively here.
- Any change to `getProfile()`, the `profile` schema, or `Profile`'s shape — this change is a pure consumer of profile-wizard's (#57) already-shipped read accessor.
- A generic `[collection]` dynamic-segment router for the public side — explicitly rejected per the routing decision above.

## Capabilities

### New Capabilities

- `content-listing`: `/posts`, `/projects` listing routes and `/posts/[slug]`, `/projects/[slug]` detail routes — literal per-collection routes (no dynamic `[collection]` segment), `getStaticPaths()`-driven, date-descending sort, and the `.md`-suffix slug-shape handling required by `legacy.collectionsBackwardsCompat` (see Risks).
- `public-content-visibility`: the deleted/draft filter predicate applied to every public `getCollection()` read site (home teaser, listings, detail-route static-path generation); admin's own reads are explicitly out of this capability's scope. **This capability's Success Criteria are also #53's closing criteria.**

### Modified Capabilities

- `public-pages`: this change **supersedes** the "Minimal Scope Boundary" requirement from theme-system (#6) — `src/pages/index.astro` is no longer forbidden from importing `src/content/**`; it now renders a real profile hero plus a recent-entries teaser. The "First Public Route Consumes the Theme System" requirement is retained in spirit (still `prerender = true`, still composes `Layout`/theme components) but its scenarios are rewritten to describe the new home content instead of the old bare `TerminalWindow` proof. New requirements are added for the "no profile yet" placeholder and the minimal shared nav in `Layout.astro`.

## Approach

**Home page composition.** `getProfile()` (profile-wizard's existing, unmodified accessor) drives the hero; a filtered, date-descending slice of `getCollection("posts")`/`getCollection("projects")` (mapped via the existing `toContentEntry()`, unmodified) drives the teaser. Both calls happen directly in `index.astro`, matching `admin/index.astro`'s existing precedent of calling `getProfile()` and `getCollection()` side-by-side without a shared "page data" abstraction — there is no reason to introduce one for two calls.

**Filtering lives as a small, shared, unit-tested predicate**, not duplicated inline at each of the (at least four) public call sites (home teaser, `/posts`, `/projects`, both `getStaticPaths()`). A single exported function (e.g. `isPubliclyVisible(entry): boolean` checking `!data.deleted && !data.draft`) is called via `.filter()` immediately after each `getCollection()` — small enough to not warrant a new capability-spanning module, but explicit enough that `sdd-tasks` can enumerate "one call site, one filter application" the same way profile-wizard enumerated its three hardcoded touch points, rather than leaving consistency to be discovered mid-apply.

**Routing stays literal, not generalized.** `/posts/index.astro`, `/projects/index.astro`, `/posts/[slug].astro`, `/projects/[slug].astro` are four independent files, each calling its own named collection directly. This intentionally does not reuse or extend admin's `parseCollectionParam`/`[collection]` pattern, which exists to dedupe *write*-form dispatch across two collections sharing one form shape — the public read side has no shared form to dedupe, and a dynamic segment would only reintroduce a runtime-string-to-collection-name mapping this change has no need for.

**`getStaticPaths()` and the `.md`-suffix gotcha (flagged as this change's primary technical risk).** `collection-section.astro`'s `toSlug()` already worked around the fact that `getEntry()`/`getCollection()` ids carry a `.md` suffix under `legacy.collectionsBackwardsCompat: true`. Both detail routes' `getStaticPaths()` must produce `params: { slug }` values that are the extensionless slug (matching what a real visitor types in a URL), while `entry.id` (used to re-fetch or link the entry) carries the suffix — this exact shape has never been exercised through `getStaticPaths()` in this repo before (only through direct `getEntry()`/`getCollection()` reads in admin). Design/apply must verify this empirically against a real `astro build` before assuming the existing `toSlug()` pattern transfers unmodified — consistent with this project's track record of real Astro-version/legacy-flag surprises (three already documented across four prior changes, per security-hardening's proposal).

**Minimal nav in `Layout.astro`, not a new component.** `Layout.astro` is already the one shared entry point every public page imports (title prop, theme CSS, toggle script) and currently has no nav slot. Adding three static anchors (`Home` → `/`, `Posts` → `/posts`, `Projects` → `/projects`) directly in its `<body>`, above `<slot />`, makes every page navigable with the smallest possible diff — no new `.astro` file, no active-route-highlighting logic, no responsive/mobile-menu behavior. If a future change needs a real navigation system, it starts from this minimal baseline rather than this change inventing one speculatively.

**"No profile yet" placeholder is a home-page-local conditional**, not a redirect (unlike #57's `/admin/**`-only first-run redirect, which the public side has no equivalent trust boundary to hook into). `index.astro` checks `getProfile()`'s result and renders either the hero or a plain placeholder ("This site's profile hasn't been set up yet — visit `/admin` to get started") reusing `TerminalWindow`/`BrutalistButton` for visual consistency with the rest of the theme, not a bespoke unstyled fallback.

**Testability given heavy `.astro` markup work** (this project's established Testing Strategy discipline, per theme-system's and admin-ui's precedent): the filter predicate, the profile-presence branch condition, and the date-descending sort/teaser-slice function are all pure, unit-testable logic and are extracted accordingly, hitting the 80% Vitest coverage gate. The `.astro` templates themselves are proven via a build-time script — design decides whether to extend `scripts/verify-content-collections.mjs` (which already runs a real `astro build` against `posts`/`projects`) or add a 7th script (following the existing `verify-*.mjs` naming/pattern) scoped to this change's specific new assertions (listing filtering/sort, detail-route resolution, both home-page states).

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/pages/index.astro` | Modified (rewrite) | Profile hero + recent-entries teaser + "no profile yet" placeholder; drops the old bare `TerminalWindow` proof content |
| `src/pages/posts/index.astro`, `src/pages/projects/index.astro` | New | Listing routes, filtered + date-descending |
| `src/pages/posts/[slug].astro`, `src/pages/projects/[slug].astro` | New | Detail routes, `getStaticPaths()`, filtered |
| `src/content/_visibility.ts` (name indicative) | New | `isPubliclyVisible()` predicate + unit tests |
| `src/content/_sort.ts`/inline helper (name indicative) | New | Date-descending sort/teaser-slice logic + unit tests |
| `src/presentation/Layout.astro` | Modified | Adds three static nav links (`Home`/`Posts`/`Projects`) above `<slot />` |
| `scripts/verify-content-collections.mjs` (extended) or a new `scripts/verify-public-content-routes.mjs` | Modified or New | Build-time proof: filtering, sort order, detail-route resolution, both home-page profile-presence states |
| `openspec/specs/public-pages/spec.md` | Modified | Delta: supersedes "Minimal Scope Boundary"; rewrites the home-content scenarios; adds nav + no-profile-placeholder requirements |
| `openspec/specs/content-listing/spec.md` | New | New capability spec: literal listing/detail routes, sort order, `.md`-suffix handling |
| `openspec/specs/public-content-visibility/spec.md` | New | New capability spec: the filter predicate and its call-site coverage; this is also #53's closing spec |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| `getStaticPaths()` + `legacy.collectionsBackwardsCompat`'s `.md`-suffix id shape has never been exercised in this repo before (only direct `getEntry()`/`getCollection()` reads have) — this project has a real track record of Astro-version/legacy-flag surprises (three documented across four prior changes) | Medium-High | Empirically verify against a real `astro build` early during apply, before writing slug-matching logic on assumption; the build-time proof script asserts detail-route resolution against real output, not a mocked one |
| The filter predicate is applied at some public call sites but missed at others (e.g. listings filtered but a detail route's `getStaticPaths()` still generates a path for a `deleted:true` entry, making it reachable by direct URL despite being hidden from listings) | Medium | All public call sites are enumerated explicitly in Affected Areas/Success Criteria, not left as an implicit consequence — same pattern profile-wizard used for its three hardcoded touch points; `sdd-tasks` should generate one task per call site with an explicit cross-check |
| Superseding `public-pages`'s "Minimal Scope Boundary" requirement is done incompletely, leaving the old spec text contradicting the new one | Low-Medium | The spec delta explicitly states supersession in its own text (not a silent removal); `sdd-spec` must show the requirement is replaced, not just newly added alongside |
| Minimal nav scope creep — "add a few links" is an easy place to over-build (active-state styling, mobile menu, dropdown) beyond what was asked | Low-Medium | Explicit scope statement above (three static links, no highlighting, no responsive menu); any expansion is flagged as a separate future change |
| This project's Testing Strategy discipline (heavy `.astro` markup that isn't meaningfully unit-testable) could tempt writing vacuous unit tests just to hit the coverage number, or under-covering the genuinely testable logic (predicate/sort/placeholder-branch) | Low-Medium | Real testable logic (filter predicate, sort/teaser-slice, profile-presence branch) is extracted into plain functions and unit-tested normally; `.astro` markup is proven via the build-time script instead, consistent with theme-system's and admin-ui's already-established precedent |
| In full/GitHub mode, `getCollection()`/`getProfile()` reflect the last build/deploy, not live git state — a just-created profile or just-published post won't appear on the public home/listing pages until the next deploy | Low | This is the same, already-documented build/deploy lag from profile-wizard (#57), now extended to the public side; no new disclosure UI is required on the public pages themselves (visitors have no "why isn't this here yet" context to disclose to — only the operator, who already sees the equivalent disclosure in `/admin`) |

## Rollback Plan

Revert `src/pages/index.astro` to its prior minimal-proof-page state, delete `src/pages/posts/**`/`src/pages/projects/**`, revert `src/presentation/Layout.astro`'s nav addition, remove the filter-predicate/sort-helper modules and their tests, and remove or revert the build-time proof script changes — all via git. Revert the `public-pages` spec delta and remove the new `content-listing`/`public-content-visibility` spec files. No data migration: `posts`/`projects`/`profile` content files and their schemas are untouched by this change; filtering is pure read-side logic with no write-path or schema effect.

## Dependencies

- Depends on `profile-identity` (#57, archived) for `getProfile()`/`Profile` — this change's home-page data source, consumed unmodified.
- Depends on `content-view-contract`/`content-schema` (#3, archived) for `ContentEntry`/`toContentEntry()` and the `deleted`/`draft` schema fields this change's filter predicate reads.
- Depends on `theme-system` (#6/#9, archived) for `Layout.astro`, `TerminalWindow`, `BrutalistButton`, and `themes/brutalist/theme.css` — this change composes from these, does not modify their internals (only adds three static links to `Layout.astro`'s body).
- **Absorbs and effectively closes #53** ("Add read-side filtering for logically-deleted entries") — this change's `public-content-visibility` capability is #53's filtering requirement, scoped to the public read side only; #53's broader scope (if any existed beyond filtering, e.g. sitemap/RSS exclusion) is not addressed since no such surface exists yet in this codebase.
- No dependency on and no coupling with #54 (second theme preset), admin UI changes, or publishing-layer changes — all explicitly out of scope per the issue.

## Success Criteria

- [x] `src/pages/index.astro` renders a profile hero (via `getProfile()`) and a date-descending, filtered recent-entries teaser linking to `/posts` and `/projects`, when a profile exists
- [x] `src/pages/index.astro` renders a friendly "no profile yet, visit `/admin`" placeholder when `getProfile()` returns `undefined`, instead of an empty/broken-looking page
- [x] `/posts` and `/projects` list filtered, date-descending entries via their own literal routes; no `[collection]` dynamic segment exists on the public side
- [x] `/posts/[slug]` and `/projects/[slug]` resolve correctly via `getStaticPaths()` for non-deleted/non-draft entries, with slug matching verified against a real `astro build` (not assumed from the existing `toSlug()` pattern)
- [x] Every public `getCollection("posts"/"projects")` call site (home teaser, both listings, both detail routes' `getStaticPaths()`) excludes `deleted: true` AND `draft: true` entries via a single shared, unit-tested predicate — **closing issue #53's read-side filtering gap as this change's own requirement**
- [x] Admin's `getCollection()` calls in `src/pages/admin/**` remain unfiltered and continue to show everything, unchanged from the existing `admin-authoring` spec
- [x] `src/presentation/Layout.astro` includes three static nav links (Home/Posts/Projects) navigable from every public page, with no active-state highlighting or mobile-menu logic added
- [x] `openspec/specs/public-pages/spec.md`'s "Minimal Scope Boundary" requirement is explicitly superseded (not silently contradicted) by a delta describing the new home-page content
- [x] The filter predicate, the profile-presence branch, and the date-descending sort/teaser-slice logic are unit-tested and count toward the 80% Vitest coverage gate
- [x] A build-time proof script (extended or new) asserts against real `astro build` output: listing filtering/sort order, detail-route resolution for filtered entries, and both home-page profile-presence states
- [x] Coverage gate holds at 80% under strict TDD for all new/modified testable logic (this is the 10th real feature-code change under that gate)

## Note on Source Verification

This proposal was written from: the task's full restatement of issue #52 and the locked decisions 1-4 above, exploration findings at `sdd/public-homepage/explore` (read via `mem_get_observation`), and direct reads of `src/content/profile.ts`, `src/content/entry.ts`, `src/content/_mappers/to-content-entry.ts`, `src/content/schemas.ts`, `src/presentation/Layout.astro`, `src/presentation/brutalist/{TerminalWindow,BrutalistButton}.astro`, `themes/brutalist/theme.css`, `src/pages/index.astro`, `src/pages/admin/index.astro`, `src/pages/admin/_lib/collection-section.astro`, `eslint.config.js`, and `openspec/specs/{public-pages,content-view-contract,profile-identity,admin-authoring}/spec.md`, plus the archived proposals for `theme-system`, `security-hardening`, and `profile-wizard` as structural templates.
