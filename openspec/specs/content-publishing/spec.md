# Content Publishing Specification

## Purpose

Defines the `ContentWriter` port and its two implementations — `GithubContentWriterAdapter` (real, `fetch`-based) and `FakeContentWriter` (in-memory test double) — that let callers create and edit content files under `src/content/**` programmatically, validated against the existing collection schemas before any commit is assembled, with a security posture (no ambient token access, sanitized errors) suitable for the first component in this repo to call an external API with real credentials.

## Requirements

### Requirement: ContentWriter Port Contract

The system MUST define a `ContentWriter` TypeScript interface with exactly two operations, `create` and `edit`, both taking explicit `collection`, `slug`, and content parameters, where `collection` is typed as `"posts" | "projects" | "profile"`. The port MUST NOT infer a slug or file path from title/content, and MUST NOT expose an HTTP route or a `delete` operation.

(Previously: `collection` was typed as `"posts" | "projects"`; this change widens the union to include `"profile"`. No change to the two-operation shape.)

#### Scenario: Port shape has no inference

- GIVEN the `ContentWriter` interface
- WHEN a caller invokes `create` or `edit`
- THEN it must explicitly pass `collection`, `slug`, and the entry content — no method derives a slug or path from title or body

#### Scenario: No delete method exists

- GIVEN the `ContentWriter` interface
- WHEN inspecting its members
- THEN no `delete` operation is present

#### Scenario: Profile is a valid collection value

- GIVEN a `create` or `edit` call with `collection: "profile"`
- WHEN the call is type-checked and executed against any `ContentWriter` implementation
- THEN it is accepted as a valid `Collection` value, exactly as `"posts"` and `"projects"` already are, and no port method is added or removed to accommodate it

### Requirement: Validation Before Write

Every `create` and `edit` call path MUST invoke `parseEntry()` against the target collection's schema before assembling a write payload, for `GithubContentWriterAdapter`, `LocalFsContentWriterAdapter`, and `FakeContentWriter`.

#### Scenario: Valid entry proceeds to write

- GIVEN a `create` or `edit` call with content that satisfies the collection's schema
- WHEN the write is invoked on any `ContentWriter` implementation
- THEN `parseEntry()` returns an ok result and a write payload is assembled

#### Scenario: Invalid entry is rejected before any write

- GIVEN a `create` or `edit` call with content that fails the collection's schema
- WHEN the write is invoked on any `ContentWriter` implementation
- THEN `parseEntry()` returns an error result, no payload is assembled, and no disk write or GitHub API request is made

### Requirement: GithubContentWriterAdapter Request Shape

`GithubContentWriterAdapter` MUST implement `ContentWriter` using native `fetch` against the GitHub Contents API, sending base64-encoded file content and an `Authorization` header built from a token supplied only via constructor injection.

#### Scenario: Create sends a PUT with base64 content

- GIVEN a valid `create` call for a new slug in a collection
- WHEN the adapter executes the write
- THEN it sends a `PUT` request to the Contents API URL for that collection/slug, with the file content base64-encoded in the request body and an `Authorization` header present

#### Scenario: Edit reads current SHA before writing

- GIVEN a valid `edit` call for an existing slug
- WHEN the adapter executes the write
- THEN it first retrieves the file's current SHA from the Contents API, then includes that SHA in the `PUT` request body

### Requirement: SHA-Conflict Handling

The adapter MUST surface a typed conflict error when the GitHub API rejects a write due to a stale SHA, and MUST NOT silently overwrite or retry on the caller's behalf.

#### Scenario: Stale SHA yields a typed conflict error

- GIVEN an `edit` call whose SHA no longer matches the file's current state on GitHub
- WHEN the adapter submits the `PUT` request
- THEN the GitHub API's conflict response is surfaced to the caller as a typed conflict error, and no further write is attempted automatically

### Requirement: Sanitized Error Handling

The adapter MUST NOT allow a token, `Authorization` header value, or any other credential to appear in a thrown error message or log line, even when relaying a GitHub API error body.

#### Scenario: API error is relayed without leaking the token

- GIVEN a GitHub API request fails with an error response body
- WHEN the adapter throws or logs the resulting error
- THEN the error message may include non-credential details (e.g. status code, path) but never the token or `Authorization` header value

### Requirement: No Ambient Token Access in the Adapter

`GithubContentWriterAdapter` MUST receive its GitHub token via constructor injection and MUST NOT read `process.env` itself.

#### Scenario: Adapter has no process.env reference

- GIVEN the `GithubContentWriterAdapter` source
- WHEN it is linted
- THEN no ambient `process.env` access exists anywhere in `src/publishing/**`, and the token is only reachable via the constructor parameter

### Requirement: FakeContentWriter Test Double

The system MUST provide a `FakeContentWriter` implementing `ContentWriter` entirely in memory, without invoking `fetch`, for use by automated tests and future callers.

#### Scenario: Fake writer records writes without network access

- GIVEN a `create` or `edit` call against `FakeContentWriter`
- WHEN the call completes
- THEN the write is recorded in memory, `parseEntry()` was still invoked, and no `fetch` call occurred

### Requirement: Logical Delete Semantics

"Deleting" content MUST be expressed as an `edit` call with `deleted: true` on the entry; the port MUST NOT provide a method that removes a file from the repository or calls the GitHub Contents API's `DELETE` operation.

#### Scenario: Logical delete keeps the file in history

- GIVEN an existing content entry
- WHEN a caller invokes `edit` with `deleted: true`
- THEN the file remains present in the repository and git history, with `deleted` set to `true` in its frontmatter, and no `DELETE` request is made to the GitHub Contents API

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

### Requirement: Single-File Commits Only

Each `create` or `edit` call MUST result in at most one file being written in a single commit; the system MUST NOT provide atomic multi-file commit support.

#### Scenario: One call writes one file

- GIVEN any `create` or `edit` call
- WHEN the adapter executes it
- THEN exactly one file is created or updated in exactly one commit, and no mechanism exists to group multiple file writes into one atomic commit

### Requirement: No Real Network Calls in Automated Tests

Automated tests for `GithubContentWriterAdapter` and any consumer of `ContentWriter` MUST use only `FakeContentWriter` or a mocked `fetch`, and MUST NOT make a real network call to the GitHub API.

#### Scenario: Adapter tests run without network access

- GIVEN the automated test suite for `GithubContentWriterAdapter`
- WHEN the suite runs (locally or in CI, including fork-triggered PR runs)
- THEN all GitHub API interactions are satisfied by a mocked `fetch`, and the suite passes or fails independently of network availability or repo secrets
