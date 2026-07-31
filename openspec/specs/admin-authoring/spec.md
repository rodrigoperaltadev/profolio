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

### Requirement: Profile Setup and Edit Routes

The system MUST provide admin routes for creating (`setup`) and editing (`edit`) the singleton `profile` entry, reusing the existing session gate, native `<form method="POST">` pattern, and typed-conflict-error surfacing already established for `posts`/`projects`. Both routes MUST always target `collection: "profile", slug: "me"` and MUST NOT accept a slug from the request.

#### Scenario: Setup form creates the profile

- GIVEN no `profile` entry exists yet and the operator submits the setup form with valid data
- WHEN the server endpoint handles the POST
- THEN `ContentWriter.create` is invoked with `collection: "profile", slug: "me"` and the entry is persisted via the active adapter

#### Scenario: Edit form updates the profile

- GIVEN a `profile` entry already exists and the operator submits the edit form with valid data
- WHEN the server endpoint handles the POST
- THEN `ContentWriter.edit` is invoked with `collection: "profile", slug: "me"` and the entry is updated via the active adapter

#### Scenario: Invalid submission is rejected before write

- GIVEN a setup or edit form submitted with content failing the `profile` schema
- WHEN the server endpoint handles the POST
- THEN no write occurs and the page re-renders with a validation error

### Requirement: First-Run Profile Redirect (Both Publishing Modes)

On any GET request to `/admin/**` (excluding the profile setup page and login-related paths), if no `profile` entry exists, the system MUST redirect the operator to the profile setup flow with a plain "no profile exists yet" message. This check MUST fire in full/GitHub mode after the existing session gate passes, and MUST also fire in local-fallback mode even though no session gate exists there. Once a `profile` entry exists, no further first-run redirect MUST fire and admin behaves normally with an edit-profile entry point exposed.

#### Scenario: Full mode redirects an authenticated operator with no profile

- GIVEN GitHub publishing env vars are set, the client holds a valid session cookie, and no `profile` entry exists
- WHEN a GET request to `/admin/**` (excluding the setup page) is made
- THEN the request passes the session gate and is then redirected to the profile setup flow with a "no profile exists yet" message

#### Scenario: Local-fallback mode redirects with no session gate involved

- GIVEN no GitHub publishing env vars are set and no `profile` entry exists
- WHEN a GET request to `/admin/**` (excluding the setup page) is made
- THEN the request is redirected to the profile setup flow with a "no profile exists yet" message, independent of any login event

#### Scenario: Existing profile disables the redirect in both modes

- GIVEN a `profile` entry exists (either publishing mode)
- WHEN a GET request to `/admin/**` is made
- THEN no first-run redirect fires, the request proceeds normally, and an edit-profile entry point is exposed

### Requirement: Build/Deploy Detection Lag Disclosure

In full/GitHub mode, the profile setup, edit, and import success responses MUST explicitly state, in plain UI copy, that `getCollection()` reflects the last build/deploy rather than live git state, so a just-saved or just-imported profile will not clear the first-run redirect until the next deploy.

#### Scenario: GitHub-mode save discloses the deploy lag

- GIVEN the active adapter is `GithubContentWriterAdapter` and a profile setup, edit, or import write completes successfully
- WHEN the success response is rendered
- THEN it states plainly that the change is saved but will not be reflected by the running app's first-run check until the next build/deploy

#### Scenario: Local-fallback mode uses the existing commit reminder instead

- GIVEN the active adapter is `LocalFsContentWriterAdapter` and a profile setup, edit, or import write completes successfully
- WHEN the success response is rendered
- THEN it displays the existing "saved to disk, remember to commit" reminder already used for `posts`/`projects`, and no deploy-lag disclosure is shown since local-fallback reads reflect the write immediately

### Requirement: Profile Export and Import Routes

The system MUST provide an export route that lets an authenticated operator download the current `profile` entry's file body as produced by the existing `buildMarkdownFile()` pipeline, and an import route that accepts an uploaded file and runs it through the same `parseFrontmatter()` → `parseEntry()` → `ContentWriter.create`/`edit()` validation-before-write path as a normal profile edit.

#### Scenario: Export downloads the current profile file

- GIVEN a `profile` entry exists
- WHEN the operator requests the export route
- THEN the response is a downloadable file whose content is byte-identical to what `buildMarkdownFile()` produces for that entry

#### Scenario: Import writes a valid uploaded file

- GIVEN the operator uploads a file whose frontmatter and body satisfy the `profile` schema
- WHEN the import route handles the upload
- THEN the content is parsed via `parseFrontmatter()`/`parseEntry()` and written via `ContentWriter.create` or `.edit` targeting `collection: "profile", slug: "me"`

#### Scenario: Import rejects an invalid uploaded file before writing

- GIVEN the operator uploads a file whose frontmatter or body fails the `profile` schema
- WHEN the import route handles the upload
- THEN `parseEntry()` rejects it, no write occurs, and the page re-renders with a validation error

### Requirement: Profile Reset Uses Existing Edit, No New Port Method

"Wipe and start over" for the profile MUST be implemented as a call to `ContentWriter.edit` with all profile fields reset to empty/default values; the system MUST NOT add a new `ContentWriter` port method (no delete, no exists) to support this or any profile-related existence check.

#### Scenario: Reset resets fields via edit

- GIVEN an existing `profile` entry and the operator submits the reset action
- WHEN the server endpoint handles the request
- THEN `ContentWriter.edit` is called with `collection: "profile", slug: "me"` and all fields set to empty/default values, and no port method beyond `create`/`edit` is invoked

#### Scenario: Existence checks use direct collection reads, not a new port method

- GIVEN the first-run redirect or any other profile-existence check
- WHEN it determines whether a `profile` entry exists
- THEN it does so via `getCollection("profile")` or the dedicated read accessor, never via a new `ContentWriter` method
