# Delta for Content Schema

## MODIFIED Requirements

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
