# Admin Authoring Specification

## Purpose

Defines the server-rendered admin UI (`src/pages/admin/**`) that lists, creates, edits, and logically deletes content entries through the existing `ContentWriter` port and `content-view-contract` mapper, gated by an interim shared-secret check only when a real publishing backend (GitHub) is configured.

## Requirements

### Requirement: Server Output Mode for Admin Routes

The system MUST set `output: "server"` in `astro.config.mjs` with `@astrojs/node` in standalone mode. Every existing public content page MUST declare `export const prerender = true` so that only `/admin/**` routes render dynamically per request.

#### Scenario: Public page remains statically prerendered

- GIVEN an existing public content page with `export const prerender = true`
- WHEN the site is built
- THEN the page is emitted as static HTML, unchanged from prior static-output behavior

#### Scenario: Admin route renders per request

- GIVEN a request to any route under `/admin/**`
- WHEN the server handles the request
- THEN the response is generated dynamically per request, not served from a prebuilt static file

### Requirement: Admin Entry Listing

`/admin` MUST list existing entries across registered collections using `getCollection()` and the shared mapper/`ContentEntry` contract, without introducing any collection-specific branching in the page itself.

#### Scenario: Entries are listed

- GIVEN one or more valid entries exist in a collection
- WHEN `/admin` is requested
- THEN the page renders each entry via the shared `ContentEntry` shape, including entries with `deleted: true`

#### Scenario: Empty collection renders without error

- GIVEN a collection with zero entries
- WHEN `/admin` is requested
- THEN the page renders successfully with no entries listed and no error thrown

### Requirement: Admin Entry Creation and Editing

`/admin` MUST provide create and edit forms that submit via native `<form method="POST">` to colocated server endpoints, which MUST invoke `ContentWriter.create`/`edit` after schema validation, and MUST surface the port's existing typed conflict error as a plain user-facing message rather than an unhandled exception.

#### Scenario: Valid creation writes a new entry

- GIVEN a create form submitted with content satisfying the collection's schema
- WHEN the server endpoint handles the POST
- THEN `ContentWriter.create` is invoked and the new entry is persisted via the active adapter

#### Scenario: Invalid submission is rejected before write

- GIVEN a create or edit form submitted with content failing the collection's schema
- WHEN the server endpoint handles the POST
- THEN no write occurs and the page re-renders with a validation error

#### Scenario: Stale-SHA conflict is shown as a plain message

- GIVEN an edit submission whose underlying SHA is stale (GithubContentWriterAdapter mode)
- WHEN the typed conflict error is thrown by the adapter
- THEN the admin page displays a plain message asking the user to reload and retry, not a raw exception

#### Scenario: Local-fallback write shows a commit reminder

- GIVEN the active adapter is `LocalFsContentWriterAdapter`
- WHEN a create or edit write completes successfully
- THEN the page displays a visible reminder that the change was saved to disk only and must be committed manually

### Requirement: Admin Logical Delete

The admin UI MUST implement "delete" as a call to `ContentWriter.edit` with `deleted: true` on the entry's full existing frontmatter; it MUST NOT add a new port method or perform a hard delete.

#### Scenario: Delete marks the entry without removing it

- GIVEN an existing entry selected for deletion in the admin UI
- WHEN the delete action is submitted
- THEN `edit()` is called with `deleted: true` and the underlying file is neither removed from disk/repo nor purged from history

### Requirement: Logical-Delete Visibility Disclosure

The admin UI MUST explicitly state, at the point of delete, that a "deleted" entry is only hidden from admin conveniences it controls and remains publicly visible on the live site, since no read-side filtering exists anywhere in the codebase.

#### Scenario: Delete confirmation discloses continued visibility

- GIVEN a user initiates delete on an entry
- WHEN the confirmation UI is shown
- THEN it states the entry will remain live/publicly visible until a future change adds read-side filtering

### Requirement: Admin Access Gate (Mode-Dependent)

When GitHub publishing env vars are present (full/server mode), every request to `/admin/**` MUST be denied unless it presents a valid shared secret (`ADMIN_ACCESS_TOKEN` or equivalent), compared using a timing-safe check, with the secret read only in `src/config/**`. If GitHub env vars are present but the secret is unset, the system MUST fail closed. When GitHub publishing env vars are absent (local-fallback mode), no such gate is required.

#### Scenario: Valid secret grants access in full mode

- GIVEN GitHub publishing env vars and `ADMIN_ACCESS_TOKEN` are both set
- WHEN a request to `/admin/**` presents the correct secret
- THEN the request is allowed to proceed

#### Scenario: Missing or wrong secret is denied in full mode

- GIVEN GitHub publishing env vars are set
- WHEN a request to `/admin/**` presents no secret or an incorrect one
- THEN the request is denied

#### Scenario: Misconfiguration fails closed

- GIVEN GitHub publishing env vars are set but `ADMIN_ACCESS_TOKEN` is unset
- WHEN any request to `/admin/**` arrives
- THEN the system denies access (or refuses to start) rather than allowing unauthenticated access

#### Scenario: Local-fallback mode requires no secret

- GIVEN no GitHub publishing env vars are set
- WHEN a request to `/admin/**` arrives with no secret presented
- THEN the request is allowed to proceed

### Requirement: No Client-Side UI Framework

Admin pages MUST be implemented as plain server-rendered Astro pages using native HTML forms; the system MUST NOT introduce a client-side JavaScript UI framework or runtime for `/admin/**`.

#### Scenario: Admin pages ship no framework runtime

- GIVEN the built output for `/admin/**`
- WHEN its client-side assets are inspected
- THEN no UI framework runtime (e.g. React, Vue) is present, and forms function via native browser submission
