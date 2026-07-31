# Content Listing Specification

## Purpose

Defines the public listing and detail routes for `posts` and `projects` — literal per-collection routes (no dynamic `[collection]` segment), `getStaticPaths()`-driven detail pages, the date-descending sort order applied to listings and the home teaser, and the `.md`-suffix slug-shape handling required by `legacy.collectionsBackwardsCompat`.

## Requirements

### Requirement: Literal Per-Collection Listing Routes

The system MUST provide `/posts` (`src/pages/posts/index.astro`) and `/projects` (`src/pages/projects/index.astro`) as two independent, literal routes, each calling `getCollection()` for its own named collection directly. The system MUST NOT provide a `[collection]` dynamic-segment route on the public side.

#### Scenario: /posts lists only the posts collection

- GIVEN the `/posts` route
- WHEN it renders
- THEN it lists entries from `getCollection("posts")` only, via its own literal file

#### Scenario: /projects lists only the projects collection

- GIVEN the `/projects` route
- WHEN it renders
- THEN it lists entries from `getCollection("projects")` only, via its own literal file

#### Scenario: No dynamic collection segment exists publicly

- GIVEN the public route tree
- WHEN inspected
- THEN no `src/pages/[collection]/**` route exists; `/posts` and `/projects` are the only public listing entry points

### Requirement: Date-Descending Listing and Teaser Sort

Both listing routes and the home-page teaser MUST sort their visible entries by `date` descending (most recent first).

#### Scenario: /posts is sorted newest first

- GIVEN two or more visible `posts` entries with different `date` values
- WHEN `/posts` renders
- THEN they appear in descending `date` order

#### Scenario: /projects is sorted newest first

- GIVEN two or more visible `projects` entries with different `date` values
- WHEN `/projects` renders
- THEN they appear in descending `date` order

### Requirement: Detail Routes via getStaticPaths()

The system MUST provide `/posts/[slug]` (`src/pages/posts/[slug].astro`) and `/projects/[slug]` (`src/pages/projects/[slug].astro`), each generating its static paths via its own `getStaticPaths()` from its own named collection only.

#### Scenario: A post detail page resolves for a visible entry

- GIVEN a visible `posts` entry
- WHEN the site builds
- THEN `getStaticPaths()` generates a resolvable `/posts/{slug}` page for it

#### Scenario: A project detail page resolves for a visible entry

- GIVEN a visible `projects` entry
- WHEN the site builds
- THEN `getStaticPaths()` generates a resolvable `/projects/{slug}` page for it

### Requirement: Slug Shape Handles the .md-Suffix Entry Id

Under `legacy.collectionsBackwardsCompat: true`, entry `id` values carry a `.md` suffix. `getStaticPaths()` for both detail routes MUST produce `params.slug` as the extensionless slug a visitor types in a URL, while still resolving correctly back to the suffixed `entry.id` for re-fetching or linking the entry.

#### Scenario: Generated param is extensionless

- GIVEN a `posts` or `projects` entry whose `id` carries a `.md` suffix
- WHEN `getStaticPaths()` builds its `params`
- THEN `params.slug` does not include the `.md` suffix

#### Scenario: Extensionless slug still resolves the entry against real build output

- GIVEN a built detail page reached via its extensionless URL slug
- WHEN the page re-fetches or links its own entry
- THEN it resolves correctly against the entry's suffixed `id`, verified against a real `astro build`, not assumed from the existing `toSlug()` pattern transferring unmodified
