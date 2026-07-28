# Content Publishing Specification

## Purpose

Defines the `ContentWriter` port and its two implementations — `GithubContentWriterAdapter` (real, `fetch`-based) and `FakeContentWriter` (in-memory test double) — that let callers create and edit content files under `src/content/**` programmatically, validated against the existing collection schemas before any commit is assembled, with a security posture (no ambient token access, sanitized errors) suitable for the first component in this repo to call an external API with real credentials.

## Requirements

### Requirement: ContentWriter Port Contract

The system MUST define a `ContentWriter` TypeScript interface with exactly two operations, `create` and `edit`, both taking explicit `collection`, `slug`, and content parameters. The port MUST NOT infer a slug or file path from title/content, and MUST NOT expose an HTTP route or a `delete` operation.

#### Scenario: Port shape has no inference

- GIVEN the `ContentWriter` interface
- WHEN a caller invokes `create` or `edit`
- THEN it must explicitly pass `collection`, `slug`, and the entry content — no method derives a slug or path from title or body

#### Scenario: No delete method exists

- GIVEN the `ContentWriter` interface
- WHEN inspecting its members
- THEN no `delete` operation is present

### Requirement: Validation Before Write

Every `create` and `edit` call path MUST invoke `parseEntry()` against the target collection's schema before assembling a commit payload, for both `GithubContentWriterAdapter` and `FakeContentWriter`.

#### Scenario: Valid entry proceeds to commit

- GIVEN a `create` or `edit` call with content that satisfies the collection's schema
- WHEN the write is invoked
- THEN `parseEntry()` returns an ok result and a commit payload is assembled

#### Scenario: Invalid entry is rejected before any commit

- GIVEN a `create` or `edit` call with content that fails the collection's schema
- WHEN the write is invoked
- THEN `parseEntry()` returns an error result, no commit payload is assembled, and no GitHub API request is made

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
