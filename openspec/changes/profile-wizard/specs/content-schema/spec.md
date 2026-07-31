# Delta for Content Schema

## ADDED Requirements

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
