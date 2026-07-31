# Delta for Admin Authoring

## ADDED Requirements

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
