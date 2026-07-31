# Content Schema Specification

## Purpose

Defines the per-collection Astro Content Collection schemas (`posts`, `projects`) that give compile-time types and build-time validation for all content authored under `src/content/**`, and fixes the folder-per-collection file layout that issue #4's publishing pipeline will write into.

## Requirements

### Requirement: Content Collections Configuration

The system MUST define `posts` and `projects` as Astro Content Collections via `defineCollection` with a Zod schema, registered in `src/content.config.ts`.

#### Scenario: Both collections are registered

- GIVEN `src/content.config.ts`
- WHEN the Astro content config is loaded
- THEN it exports a `collections` object containing both `posts` and `projects`, each defined via `defineCollection` with a Zod `schema`

### Requirement: Posts Schema Shape

The `posts` collection schema MUST require `title` (string), `date`, and `body` (string), MUST accept `tags` as a free-form `array(string())` with no controlled vocabulary or min/max count, and MUST include `draft` (boolean, default `false`) and `deleted` (boolean, default `false`).

(Previously: schema included `draft` only; this change adds `deleted` for issue #4's logical-delete semantics.)

#### Scenario: Valid post entry passes validation

- GIVEN a `posts` content file with `title`, `date`, `body`, and a `tags` array of strings
- WHEN the content collection is parsed
- THEN the entry validates successfully and `draft` and `deleted` both default to `false` if omitted

#### Scenario: Invalid post entry fails validation

- GIVEN a `posts` content file missing `title` or with a non-string `body`
- WHEN the content collection is parsed
- THEN schema validation rejects the entry with a Zod error

#### Scenario: Existing sample content is unaffected

- GIVEN a pre-existing `posts` content file authored before `deleted` was added, with no `deleted` field present
- WHEN the content collection is parsed
- THEN the entry still validates successfully and `deleted` defaults to `false`

### Requirement: Projects Schema Shape

The `projects` collection schema MUST require `name`, `stack`, `link`, and `date`, and MUST include `draft` (boolean, default `false`) and `deleted` (boolean, default `false`).

(Previously: schema included `draft` only; this change adds `deleted` for issue #4's logical-delete semantics.)

#### Scenario: Valid project entry passes validation

- GIVEN a `projects` content file with `name`, `stack`, `link`, and `date`
- WHEN the content collection is parsed
- THEN the entry validates successfully and `draft` and `deleted` both default to `false` if omitted

#### Scenario: Invalid project entry fails validation

- GIVEN a `projects` content file missing `name` or `link`
- WHEN the content collection is parsed
- THEN schema validation rejects the entry with a Zod error

#### Scenario: Existing sample content is unaffected

- GIVEN a pre-existing `projects` content file authored before `deleted` was added, with no `deleted` field present
- WHEN the content collection is parsed
- THEN the entry still validates successfully and `deleted` defaults to `false`

### Requirement: Folder-Per-Collection File Layout

The system MUST store content files under `src/content/<collection>/`, one subdirectory per collection, and this path convention MUST be treated as the fixed contract that issue #4's publishing pipeline writes into.

#### Scenario: Sample content resolves per collection

- GIVEN at least one sample file under `src/content/posts/` and one under `src/content/projects/`
- WHEN `getCollection("posts")` and `getCollection("projects")` are called
- THEN each returns the corresponding sample entry from its own subdirectory

### Requirement: Draft Field Is Schema-Only

Both schemas MUST expose `draft: boolean` defaulting to `false`, and `deleted: boolean` defaulting to `false`, and no filtering, rendering, or publish/unpublish logic in this change MAY consume either field except as documented by issue #4's logical-delete semantics (setting `deleted: true` via `edit()`, not filtering or hiding the entry at read time).

(Previously: this requirement covered only `draft`; it now also covers `deleted`, since both are write-only markers with no read-side filtering in scope for either change.)

#### Scenario: Draft entries are not filtered

- GIVEN a `posts` or `projects` entry with `draft: true`
- WHEN `getCollection` is called without an explicit filter
- THEN the draft entry is returned unfiltered, since no consumer in this change reads `draft` to exclude it

#### Scenario: Deleted entries are not filtered by content collections

- GIVEN a `posts` or `projects` entry with `deleted: true`
- WHEN `getCollection` is called without an explicit filter
- THEN the entry is returned unfiltered; no read-side consumer in this change hides entries based on `deleted`

### Requirement: Build-Time Schema Validation

`npm run build` MUST fail when any content file does not conform to its collection's Zod schema.

#### Scenario: Malformed content blocks the build

- GIVEN a content file under `src/content/posts/` or `src/content/projects/` missing a required field
- WHEN `npm run build` runs
- THEN the build fails with a content-collection schema validation error

### Requirement: Profile Collection Schema Shape

The system MUST define a `profile` Astro Content Collection via `defineCollection` with a Zod schema, registered alongside `posts` and `projects`. The `profile` schema MUST require `name` (string), `role` (string), `bio` (string), and `email` (string), and MUST include `links` as an array of `{ label: string; url: string }` objects — labeled pairs, not bare URL strings.

#### Scenario: Valid profile entry passes validation

- GIVEN a `profile` content file with `name`, `role`, `bio`, `email`, and a `links` array of `{ label, url }` objects
- WHEN the content collection is parsed
- THEN the entry validates successfully

#### Scenario: Bare-string links are rejected

- GIVEN a `profile` content file whose `links` array contains bare URL strings instead of `{ label, url }` objects
- WHEN the content collection is parsed
- THEN schema validation rejects the entry with a Zod error

#### Scenario: Invalid profile entry fails validation

- GIVEN a `profile` content file missing `name` or `email`
- WHEN the content collection is parsed
- THEN schema validation rejects the entry with a Zod error

### Requirement: Profile Singleton Is Convention-Only, Not Schema-Enforced

The `profile` collection MUST NOT define any schema-level constraint limiting it to one entry; singleton-ness is enforced exclusively by the write/UI layer always targeting a fixed slug (`me`), never by `content.config.ts`. This is a deliberate asymmetry with `posts`/`projects`, which impose no cardinality limit at all: `profile` also imposes none at the schema level, but every write path MUST target `me`.

#### Scenario: Schema permits multiple entries

- GIVEN the `profile` collection's Zod schema
- WHEN inspected for cardinality constraints
- THEN no such constraint exists; a second hand-added file under `src/content/profile/` with a different slug would pass schema validation

#### Scenario: Fixed slug is enforced only by the write path

- GIVEN a call to `ContentWriter.create` or `.edit` targeting the `profile` collection
- WHEN the call is made through the admin write path
- THEN the `slug` parameter is always `"me"`, hardcoded by the caller, never accepted from external input
