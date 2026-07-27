# Content Schema Specification

## Purpose

Defines the per-collection Astro Content Collection schemas (`posts`, `projects`) that give compile-time types and build-time validation for all content authored under `src/content/**`, and fixes the folder-per-collection file layout that issue #4's publishing pipeline will write into.

## Requirements

### Requirement: Content Collections Configuration

The system MUST define `posts` and `projects` as Astro Content Collections via `defineCollection` with a Zod schema, registered in `src/content/config.ts`.

#### Scenario: Both collections are registered

- GIVEN `src/content/config.ts`
- WHEN the Astro content config is loaded
- THEN it exports a `collections` object containing both `posts` and `projects`, each defined via `defineCollection` with a Zod `schema`

### Requirement: Posts Schema Shape

The `posts` collection schema MUST require `title` (string), `date`, and `body` (string), MUST accept `tags` as a free-form `array(string())` with no controlled vocabulary or min/max count, and MUST include `draft` (boolean, default `false`).

#### Scenario: Valid post entry passes validation

- GIVEN a `posts` content file with `title`, `date`, `body`, and a `tags` array of strings
- WHEN the content collection is parsed
- THEN the entry validates successfully and `draft` defaults to `false` if omitted

#### Scenario: Invalid post entry fails validation

- GIVEN a `posts` content file missing `title` or with a non-string `body`
- WHEN the content collection is parsed
- THEN schema validation rejects the entry with a Zod error

### Requirement: Projects Schema Shape

The `projects` collection schema MUST require `name`, `stack`, `link`, and `date`, and MUST include `draft` (boolean, default `false`).

#### Scenario: Valid project entry passes validation

- GIVEN a `projects` content file with `name`, `stack`, `link`, and `date`
- WHEN the content collection is parsed
- THEN the entry validates successfully and `draft` defaults to `false` if omitted

#### Scenario: Invalid project entry fails validation

- GIVEN a `projects` content file missing `name` or `link`
- WHEN the content collection is parsed
- THEN schema validation rejects the entry with a Zod error

### Requirement: Folder-Per-Collection File Layout

The system MUST store content files under `src/content/<collection>/`, one subdirectory per collection, and this path convention MUST be treated as the fixed contract that issue #4's publishing pipeline writes into.

#### Scenario: Sample content resolves per collection

- GIVEN at least one sample file under `src/content/posts/` and one under `src/content/projects/`
- WHEN `getCollection("posts")` and `getCollection("projects")` are called
- THEN each returns the corresponding sample entry from its own subdirectory

### Requirement: Draft Field Is Schema-Only

Both schemas MUST expose `draft: boolean` defaulting to `false`, and no filtering, rendering, or publish/unpublish logic in this change MAY consume that field.

#### Scenario: Draft entries are not filtered

- GIVEN a `posts` or `projects` entry with `draft: true`
- WHEN `getCollection` is called without an explicit filter
- THEN the draft entry is returned unfiltered, since no consumer in this change reads `draft` to exclude it

### Requirement: Build-Time Schema Validation

`npm run build` MUST fail when any content file does not conform to its collection's Zod schema.

#### Scenario: Malformed content blocks the build

- GIVEN a content file under `src/content/posts/` or `src/content/projects/` missing a required field
- WHEN `npm run build` runs
- THEN the build fails with a content-collection schema validation error
