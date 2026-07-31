# Public Content Visibility Specification

## Purpose

Defines the `isPubliclyVisible()` filter predicate that excludes logically-deleted and draft entries from every public read path, and enumerates each call site required to apply it. This capability's Success Criteria are also GitHub issue #53's closing criteria for read-side filtering.

## Requirements

### Requirement: Symmetric Deleted/Draft Filter Predicate

The system MUST provide a single, shared, exported predicate function (e.g. `isPubliclyVisible(entry): boolean`) that excludes an entry when `data.deleted === true` OR `data.draft === true`. The predicate MUST NOT be duplicated inline at individual call sites.

#### Scenario: Deleted entry is excluded

- GIVEN an entry with `deleted: true`
- WHEN `isPubliclyVisible()` evaluates it
- THEN it returns `false`

#### Scenario: Draft entry is excluded

- GIVEN an entry with `draft: true` and `deleted` unset or `false`
- WHEN `isPubliclyVisible()` evaluates it
- THEN it returns `false`

#### Scenario: Entry that is both deleted and draft is excluded

- GIVEN an entry with both `deleted: true` and `draft: true`
- WHEN `isPubliclyVisible()` evaluates it
- THEN it returns `false`, confirming exclusion is symmetric across both fields, not conditioned on only one

#### Scenario: Normal published entry is included

- GIVEN an entry with `deleted` and `draft` both unset or `false`
- WHEN `isPubliclyVisible()` evaluates it
- THEN it returns `true`

### Requirement: Filter Applied at the Home Teaser

The home page's recent-entries teaser MUST filter its `getCollection("posts")`/`getCollection("projects")` results through `isPubliclyVisible()` before sorting/slicing for display.

#### Scenario: Deleted or draft entries never appear in the teaser

- GIVEN a `posts` or `projects` collection containing at least one `deleted:true` or `draft:true` entry
- WHEN the home page builds its recent-entries teaser
- THEN that entry is excluded from the teaser output

### Requirement: Filter Applied at the /posts Listing

`src/pages/posts/index.astro` MUST filter its `getCollection("posts")` results through `isPubliclyVisible()` before rendering.

#### Scenario: Deleted or draft posts never appear on /posts

- GIVEN the `posts` collection containing a `deleted:true` or `draft:true` entry
- WHEN `/posts` renders
- THEN that entry is excluded from the listing

### Requirement: Filter Applied at the /projects Listing

`src/pages/projects/index.astro` MUST filter its `getCollection("projects")` results through `isPubliclyVisible()` before rendering.

#### Scenario: Deleted or draft projects never appear on /projects

- GIVEN the `projects` collection containing a `deleted:true` or `draft:true` entry
- WHEN `/projects` renders
- THEN that entry is excluded from the listing

### Requirement: Filter Applied at /posts/[slug]'s getStaticPaths()

`src/pages/posts/[slug].astro`'s `getStaticPaths()` MUST filter through `isPubliclyVisible()` before generating paths, so a `deleted:true` or `draft:true` post has no reachable detail page, not merely a hidden listing entry.

#### Scenario: A deleted or draft post has no generated detail path

- GIVEN a `posts` entry with `deleted: true` or `draft: true`
- WHEN the site builds and `getStaticPaths()` runs for `/posts/[slug]`
- THEN no static path is generated for that entry, making it unreachable even by direct URL

### Requirement: Filter Applied at /projects/[slug]'s getStaticPaths()

`src/pages/projects/[slug].astro`'s `getStaticPaths()` MUST filter through `isPubliclyVisible()` before generating paths, so a `deleted:true` or `draft:true` project has no reachable detail page, not merely a hidden listing entry.

#### Scenario: A deleted or draft project has no generated detail path

- GIVEN a `projects` entry with `deleted: true` or `draft: true`
- WHEN the site builds and `getStaticPaths()` runs for `/projects/[slug]`
- THEN no static path is generated for that entry, making it unreachable even by direct URL

### Requirement: Admin Reads Remain Unfiltered

`src/pages/admin/**`'s existing `getCollection()` calls MUST NOT apply `isPubliclyVisible()` or any equivalent filter; admin continues to show every entry regardless of `deleted`/`draft`, unchanged from the existing `admin-authoring` spec's Logical-Delete Visibility Disclosure requirement.

#### Scenario: Admin listing still shows deleted and draft entries

- GIVEN a `posts` or `projects` collection containing `deleted:true` and `draft:true` entries
- WHEN an admin listing route under `/admin/**` renders via its existing `getCollection()` call
- THEN both entries remain visible in the admin listing, exactly as before this change

#### Scenario: All five public call sites close issue #53's filtering gap

- GIVEN this capability's five public call sites — the home teaser, `/posts`, `/projects`, `/posts/[slug]`'s `getStaticPaths()`, and `/projects/[slug]`'s `getStaticPaths()` — all apply `isPubliclyVisible()`, while admin's reads remain unfiltered
- WHEN evaluated against issue #53's original ask for read-side filtering of logically-deleted entries
- THEN #53's gap is satisfied in full, with no public call site left unfiltered
