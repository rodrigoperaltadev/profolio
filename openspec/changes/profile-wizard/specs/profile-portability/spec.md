# Profile Portability Specification

## Purpose

Defines export and import for the singleton `profile` entry — the one carry-across-a-re-clone path this project supports, since there is no shared backend to migrate a profile through. Export and import reuse the existing frontmatter+Markdown build pipeline and the existing validation-before-write path; neither introduces a new file format or a new `ContentWriter` capability.

## Requirements

### Requirement: Export Reuses the Existing Build Pipeline

Exporting the profile MUST return the exact file body `buildMarkdownFile()` already produces for the current `profile` entry, as a downloadable file from an authenticated admin GET route. No new serialization format MUST be introduced.

#### Scenario: Exported file matches the write pipeline's output

- GIVEN a `profile` entry exists
- WHEN the export route is requested
- THEN the downloaded file's content is byte-identical to what `buildMarkdownFile()` produces for that same entry via a normal edit

#### Scenario: Export requires admin authentication

- GIVEN the export route is requested without a valid session (full mode) or outside an authenticated admin context
- WHEN the request is handled
- THEN it is denied under the same admin access gate that governs the rest of `/admin/**`

### Requirement: Import Runs Through the Same Validation-Before-Write Path as a Normal Edit

Importing a profile MUST accept an uploaded file via the admin UI and process it through `parseFrontmatter()` → `parseEntry()` → `ContentWriter.create`/`edit()`, identically to a normal profile edit whose frontmatter/body happen to originate from an uploaded file instead of a form. No import-specific validation bypass MUST exist.

#### Scenario: Valid uploaded file is written after validation

- GIVEN an uploaded file whose parsed frontmatter and body satisfy the `profile` schema
- WHEN the import route processes it
- THEN `parseEntry()` validates it before any write, and `ContentWriter.create` or `.edit` is invoked with the parsed content, targeting `collection: "profile", slug: "me"`

#### Scenario: Invalid uploaded file is rejected before any write

- GIVEN an uploaded file whose parsed frontmatter or body fails the `profile` schema
- WHEN the import route processes it
- THEN `parseEntry()` rejects it, no `ContentWriter` call occurs, and the page re-renders with a validation error

#### Scenario: Import overwrites the current profile atomically per the existing single-file-commit rule

- GIVEN a `profile` entry already exists and a valid file is imported
- WHEN the import completes
- THEN the existing entry is replaced via a single `edit()` call, consistent with `content-publishing`'s single-file-commit-only requirement, with no partial-write state possible

### Requirement: Import Inherits No New Port Capability

Import and export MUST NOT require any new `ContentWriter` port method; both operate entirely through the existing `create`/`edit` operations and the existing frontmatter/Markdown parsing and building functions.

#### Scenario: Import/export code paths call only existing port methods

- GIVEN the export and import route implementations
- WHEN inspected for `ContentWriter` usage
- THEN only `create` and `edit` are called; no new interface member is referenced or defined
