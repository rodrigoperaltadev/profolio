# Delta for Content View Contract

## ADDED Requirements

### Requirement: Profile Is Exempt from the Shared Entry Contract

The `profile` collection MUST NOT be mapped through `toContentEntry()` and MUST NOT be exposed via the shared `ContentEntry` type; `profile`'s dedicated read accessor is a permitted, first-class alternative to the shared contract, not a gap in it.

#### Scenario: Profile has no mapper entry

- GIVEN `src/content/_mappers/to-content-entry.ts`'s mapper dispatch table
- WHEN it is inspected for a `profile` entry
- THEN no mapping function for `profile` exists in the table

#### Scenario: Dedicated accessor returns a distinct type

- GIVEN a valid `profile` entry
- WHEN it is read via its dedicated accessor (e.g. `getProfile()`)
- THEN the returned value's type is `Profile` (or equivalent), not `ContentEntry`, and is directly importable by `src/presentation/**` code without depending on the shared mapper

#### Scenario: Presentation code may import the dedicated type alongside ContentEntry

- GIVEN `src/presentation/**` code that already imports `ContentEntry` for `posts`/`projects`
- WHEN it also needs profile data
- THEN it imports the dedicated `Profile` type/accessor directly, and this dual import does not violate the existing rule restricting `src/presentation/**` to the shared contract for `posts`/`projects`-shaped data
