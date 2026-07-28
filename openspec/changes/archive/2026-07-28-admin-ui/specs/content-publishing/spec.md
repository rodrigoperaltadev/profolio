# Delta for Content Publishing

## ADDED Requirements

### Requirement: LocalFsContentWriterAdapter Implements ContentWriter

The system MUST provide `LocalFsContentWriterAdapter implements ContentWriter` that writes validated entries directly to disk via `fs/promises`, targeting `src/content/<collection>/<slug>.md`, reusing the existing `parseFrontmatter()`/`buildMarkdownFile()` pipeline so both this adapter and `GithubContentWriterAdapter` produce byte-identical file bodies for the same input. This adapter MUST NOT perform any git operation (no `add`, `commit`, or API call).

#### Scenario: Create writes a markdown file to disk

- GIVEN a valid `create` call for a new slug in a collection
- WHEN `LocalFsContentWriterAdapter` executes the write
- THEN a markdown file is written at `src/content/<collection>/<slug>.md` with frontmatter built via `buildMarkdownFile()`, and no git command or API call is made

#### Scenario: Edit overwrites the existing file in place

- GIVEN a valid `edit` call for an existing slug
- WHEN `LocalFsContentWriterAdapter` executes the write
- THEN the existing file at `src/content/<collection>/<slug>.md` is overwritten with the updated frontmatter and body, with no git operation performed

### Requirement: Non-Throwing Publishing Configuration Check

`src/config/**` MUST provide a non-throwing function that reports whether GitHub publishing env vars are present, distinct from the existing throwing `loadPublishingConfig()`, so callers can branch on configuration state without a try/catch.

#### Scenario: Configured environment reports true

- GIVEN all required GitHub publishing env vars are set
- WHEN the non-throwing check is called
- THEN it returns a truthy/ok result without throwing

#### Scenario: Unconfigured environment reports false

- GIVEN one or more required GitHub publishing env vars are absent
- WHEN the non-throwing check is called
- THEN it returns a falsy/not-configured result without throwing

### Requirement: Composition-Root Adapter Selection Factory

`src/config/**` MUST expose a factory function that uses the non-throwing publishing configuration check to construct `GithubContentWriterAdapter` when GitHub env vars are present, or `LocalFsContentWriterAdapter` when they are absent, so no other module decides which `ContentWriter` implementation to use.

#### Scenario: Factory selects the GitHub adapter when configured

- GIVEN GitHub publishing env vars are present
- WHEN the factory is invoked
- THEN it returns a `GithubContentWriterAdapter` instance constructed with the token from `src/config/**`

#### Scenario: Factory selects the local adapter when unconfigured

- GIVEN GitHub publishing env vars are absent
- WHEN the factory is invoked
- THEN it returns a `LocalFsContentWriterAdapter` instance, and no GitHub token is read or required

## MODIFIED Requirements

### Requirement: Validation Before Write

Every `create` and `edit` call path MUST invoke `parseEntry()` against the target collection's schema before assembling a write payload, for `GithubContentWriterAdapter`, `LocalFsContentWriterAdapter`, and `FakeContentWriter`.

(Previously: this requirement covered only `GithubContentWriterAdapter` and `FakeContentWriter`; it now also covers `LocalFsContentWriterAdapter`.)

#### Scenario: Valid entry proceeds to write

- GIVEN a `create` or `edit` call with content that satisfies the collection's schema
- WHEN the write is invoked on any `ContentWriter` implementation
- THEN `parseEntry()` returns an ok result and a write payload is assembled

#### Scenario: Invalid entry is rejected before any write

- GIVEN a `create` or `edit` call with content that fails the collection's schema
- WHEN the write is invoked on any `ContentWriter` implementation
- THEN `parseEntry()` returns an error result, no payload is assembled, and no disk write or GitHub API request is made
