# Admin Authoring Specification

## Purpose

Defines the server-rendered admin UI (`src/pages/admin/**`) that lists, creates, edits, and logically deletes content entries through the existing `ContentWriter` port and `content-view-contract` mapper, gated by session-cookie-based login (established via a shared secret) only when a real publishing backend (GitHub) is configured.

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

When GitHub publishing env vars are present (full/server mode), every request to `/admin/**` (excluding `/admin/login`) MUST be denied unless it presents a valid, unexpired session cookie issued by the login flow. If GitHub env vars are present but `ADMIN_ACCESS_TOKEN` is unset, the system MUST fail closed regardless of any session state. When GitHub publishing env vars are absent (local-fallback mode), no such gate is required.

#### Scenario: Valid session grants access in full mode

- GIVEN GitHub publishing env vars are set and the client holds a valid, unexpired session cookie
- WHEN a request to `/admin/**` is made
- THEN the request is allowed to proceed

#### Scenario: Missing or invalid session is denied and redirected in full mode

- GIVEN GitHub publishing env vars are set
- WHEN a GET request to `/admin/**` (excluding `/admin/login`) presents no session cookie, an expired one, or one unknown to the server-side store
- THEN the request is denied and the client is redirected to `/admin/login`

#### Scenario: Misconfiguration fails closed

- GIVEN GitHub publishing env vars are set but `ADMIN_ACCESS_TOKEN` is unset
- WHEN any request to `/admin/**` arrives
- THEN the system denies access (or refuses to start) rather than allowing unauthenticated access, regardless of any presented session cookie

#### Scenario: Local-fallback mode requires no gate

- GIVEN no GitHub publishing env vars are set
- WHEN a request to `/admin/**` arrives with no session cookie
- THEN the request is allowed to proceed

### Requirement: Admin Login Route

`/admin/login` MUST be implemented as a plain server-rendered page: a GET request MUST render a native HTML login form with no client-side JavaScript framework; a POST request MUST validate the submitted secret against `ADMIN_ACCESS_TOKEN` using a timing-safe comparison.

#### Scenario: Login form is rendered

- GIVEN a GET request to `/admin/login`
- WHEN the server handles it
- THEN a plain HTML form is rendered with no framework runtime shipped

#### Scenario: Correct secret is accepted

- GIVEN a POST to `/admin/login` with the correct secret and the client is not currently locked out
- WHEN the server validates it via the timing-safe comparison
- THEN the login succeeds and session issuance occurs

#### Scenario: Incorrect secret is rejected without a session

- GIVEN a POST to `/admin/login` with an incorrect secret
- WHEN the server validates it
- THEN the login fails, no session is issued, and the attempt counts toward lockout

### Requirement: Session Issuance and Cookie Attributes

On successful login, the system MUST issue a random session token generated with at least 256 bits of entropy, store it server-side (in-memory) with an expiry, and set it on the client via `HttpOnly`, `Secure`, `SameSite=Strict` cookie attributes scoped to the `/admin` path.

#### Scenario: Session cookie carries required attributes

- GIVEN a successful login
- WHEN the response is inspected
- THEN the session cookie is present with `HttpOnly`, `Secure`, and `SameSite=Strict` set, and is scoped to `/admin`

#### Scenario: Expired session is treated as invalid

- GIVEN a session token whose stored expiry has elapsed
- WHEN it is presented on a subsequent request
- THEN the request is treated as unauthenticated

### Requirement: In-Memory Session Store Lifecycle

The server-side session store MUST be in-memory only and MUST NOT be required to survive a process restart; a restart invalidating all active sessions is an accepted behavior, not a defect.

#### Scenario: Restart invalidates all sessions

- GIVEN one or more active sessions exist
- WHEN the server process restarts
- THEN all previously issued session tokens are no longer recognized as valid

### Requirement: Failed-Attempt Lockout (Per-Client)

`/admin/login` MUST track failed login attempts keyed by `context.clientAddress`, not by a single global counter. Once a client's failed attempts exceed a configured threshold within a configured window, further login attempts from that client MUST be denied (fail-closed) until the window elapses.

#### Scenario: Client is locked out after exceeding the threshold

- GIVEN a client has failed login from the same address more times than the configured threshold within the configured window
- WHEN that client submits another login attempt
- THEN the attempt is denied without evaluating the submitted secret

#### Scenario: Lockout is scoped per client address

- GIVEN one client address is locked out
- WHEN a different client address submits a correct-secret login attempt
- THEN that different client's login is evaluated normally and is not affected by the other client's lockout

### Requirement: No Client-Side UI Framework

Admin pages MUST be implemented as plain server-rendered Astro pages using native HTML forms; the system MUST NOT introduce a client-side JavaScript UI framework or runtime for `/admin/**`.

#### Scenario: Admin pages ship no framework runtime

- GIVEN the built output for `/admin/**`
- WHEN its client-side assets are inspected
- THEN no UI framework runtime (e.g. React, Vue) is present, and forms function via native browser submission
