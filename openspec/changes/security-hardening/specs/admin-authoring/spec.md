# Delta for Admin Authoring

## MODIFIED Requirements

### Requirement: Admin Access Gate (Mode-Dependent)

When GitHub publishing env vars are present (full/server mode), every request to `/admin/**` (excluding `/admin/login`) MUST be denied unless it presents a valid, unexpired session cookie issued by the login flow. If GitHub env vars are present but `ADMIN_ACCESS_TOKEN` is unset, the system MUST fail closed regardless of any session state. When GitHub publishing env vars are absent (local-fallback mode), no such gate is required.
(Previously: gate validated a shared secret sent as a Basic Auth header on every request; now validates a server-side session established once at login.)

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

## ADDED Requirements

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
