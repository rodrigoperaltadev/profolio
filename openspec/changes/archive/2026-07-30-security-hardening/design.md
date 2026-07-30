# Design: Security Hardening (Session-Cookie Auth, Lockout, Secrets Policy)

**Inputs read**: `proposal.md` (required, read in full). No delta specs exist yet under
`openspec/changes/security-hardening/specs/` — `sdd-spec` has not run. This design proceeds
from the proposal alone; `sdd-tasks` should re-check spec deltas once written.

## Technical Approach

Evolve, not replace, the existing pure-function discipline in `src/config/admin-auth.ts`.
`timingSafeStringEqual()` is reused unchanged for the login-time secret check.
`checkAdminAuth()`'s role changes from "validate a Basic Auth header on every request" to
"validate a session token on every request"; two new sibling modules
(`src/config/admin-session.ts`, `src/config/admin-lockout.ts`) hold session and lockout
state as injectable `Map`s, so all logic stays testable with plain values — no Astro
runtime, matching `checkAdminAuth()`'s existing testability pattern. `src/middleware.ts`
stays thin glue: it reads the cookie via `context.cookies.get()` (Astro's real parsing,
not hand-rolled) and passes the raw token string into the pure function.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Session TTL | **24 hours**, constant `SESSION_TTL_MS` in `admin-session.ts` | 7 days; env-configurable | Proposal said "days not weeks" because a revoked `ADMIN_ACCESS_TOKEN` doesn't retroactively kill live sessions — 24h bounds that exposure window tightly while still surviving a normal single-sitting editing session. No new env var/config surface needed (matches zero-new-dependency posture); hardcoded constant, same pattern as `DEFAULT_BRANCH` in `publishing-config.ts`. |
| Lockout threshold/window | **5 failed attempts / 15-minute fixed window**, keyed by `context.clientAddress` | Sliding window (timestamp array); 3/10min (too tight for a real typo) | 5 tolerates a legitimate operator's 2-3 mistypes; 15 min make brute-forcing impractical. Fixed window (single `count` + `windowStart`) is a two-field record, pure and testable exactly like `checkAdminAuth()` — a sliding window needs a timestamp array per key, more state for a single-operator tool's realistic threat model. |
| Lockout reset semantics | **Fixed window, hard reset** on elapse | Sliding window | Accepted tradeoff: a burst can land ~10 attempts across a window boundary (5 at t=14:59, window resets, 5 more at t=15:00). Explicitly accepted — simplicity/testability over marginal precision, consistent with the project's existing "state as a plain Map" convention (`SessionStore`/`LockoutStore` below). |
| Redirect vs. 401 | GET `/admin/**` (unauth'd) → `303` redirect to `/admin/login`. POST `/admin/api/login` (wrong secret/locked out) → `303` redirect back to `/admin/login?error=...`, matching the existing `create.ts` error-redirect pattern, not a raw 401 body | Raw 401 for all cases (kept from Basic Auth) | A login-page-backed model has no `WWW-Authenticate` browser prompt to trigger; a redirect to a real form is the correct UX. The POST endpoint still "fails closed" — it just expresses that as a redirect with an error message instead of a 401 status, since there's now an actual page to redirect to. |
| Cookie read location | Astro's `context.cookies.get(NAME)?.value` read in `middleware.ts` (glue), plain string passed into `checkAdminAuth()` | Hand-parse the raw `Cookie` header inside the pure function (mirroring old `parseBasicAuthToken`) | Reuses Astro's own cookie parsing (already correct: escaping, multiple cookies) instead of duplicating it; the pure function's testable surface shrinks to "given a token string, is it valid" — simpler than "given a Request, extract and validate." |
| `parseBasicAuthToken()` | **Removed** | Keep unused, dead | It was never exported and has no remaining caller once `checkAdminAuth()` stops reading `Authorization`. Dead code removed, not left "just in case." |
| Session/lockout store singletons | Module-level `export const sessionStore = createSessionStore()` in each new module; pure functions take the store as an explicit param | A DI container / class | Matches this repo's only precedent for cross-request state — none exists yet, but `publishing-config.ts`'s "read ambient env only at the composition boundary" idiom generalizes: the *pure* functions never touch ambient state (tests pass their own `Map`), only the one process-lifetime singleton import in `middleware.ts`/`login.ts` does. |
| `clientAddress` trust (verified) | Use `context.clientAddress` as-is; document the proxy caveat, do not add proxy-trust config now | Pre-emptively add `allowedDomains`/proxy-trust config to `@astrojs/node` | Verified in `astro/dist/core/app/node.js`: `clientAddress` = `X-Forwarded-For` **only if** the request's `Host` validates against the adapter's `allowedDomains` (unconfigured here) — otherwise it falls back to `req.socket.remoteAddress`. For this repo's actual deployment (direct `@astrojs/node` standalone, no reverse proxy), that's the real client IP — correct today. **Real gotcha for future deployers**: putting this behind a reverse proxy without configuring `allowedDomains` collapses every client to the proxy's own IP, turning per-IP lockout into a de facto global lockout — the exact self-inflicted-DoS risk the proposal already flags for IP-rotation, just via a different mechanism. Documented in `SECURITY.md`, not solved in code (out of scope; no proxy exists in this repo's design). |

## Data Flow

    GET /admin/login          ──→ renders form (bypasses gate entirely)
    POST /admin/api/login     ──→ isLockedOut(lockoutStore, clientAddress)?
                                     ├─ yes → redirect /admin/login?error=... (303)
                                     └─ no  → timingSafeStringEqual(secret, expectedToken)?
                                                ├─ wrong → recordFailedAttempt(); redirect w/ error
                                                └─ right → clearLockout(); issueSession(sessionStore)
                                                           → cookies.set(HttpOnly/Secure/SameSite=Strict)
                                                           → redirect /admin (303)
    GET /admin/**  (other)    ──→ middleware reads cookies.get(SESSION_COOKIE)?.value
                                  ──→ checkAdminAuth(token, config, sessionStore)
                                        ├─ local-fallback (unconfigured) → allowed: true
                                        ├─ full mode, no expectedToken   → allowed: false (fail-closed)
                                        ├─ full mode, valid session      → allowed: true
                                        └─ full mode, missing/expired    → allowed: false → redirect /admin/login

## File Changes

| File | Action | Description |
|---|---|---|
| `src/config/admin-session.ts` | Create | `SessionStore` type, `createSessionStore()`, `issueSession()`, `validateSession()`, `SESSION_COOKIE_NAME`, `SESSION_TTL_MS`, singleton `sessionStore` |
| `src/config/admin-lockout.ts` | Create | `LockoutStore` type, `createLockoutStore()`, `isLockedOut()`, `recordFailedAttempt()`, `clearLockout()`, singleton `lockoutStore` |
| `src/config/admin-auth.ts` | Modify | `checkAdminAuth()` signature changes to `(sessionToken, config, store)`, validates session not Basic Auth; `parseBasicAuthToken()` removed; `timingSafeStringEqual()` unchanged; `AdminAuthResult` drops `status`/`wwwAuthenticate` |
| `src/config/admin-auth.test.ts` | Modify | Rewritten for new signature/behavior; `timingSafeStringEqual` tests unchanged |
| `src/config/admin-session.test.ts` | Create | Issuance, valid/expired/not-found validation, TTL boundary |
| `src/config/admin-lockout.test.ts` | Create | Threshold, window reset, clear-on-success |
| `src/middleware.ts` | Modify | Bypasses `/admin/login` and `/admin/api/login`; reads cookie via `context.cookies.get()`; redirects (303) instead of 401 |
| `src/pages/admin/login.astro` | Create | GET form (secret field), shows `?error=` message |
| `src/pages/admin/api/login.ts` | Create | POST: lockout check → secret check → issue session → set cookie → redirect |
| `scripts/verify-admin-server.mjs` | Modify | Replace Basic-Auth requests with real login→cookie→protected-request flow; add lockout proof. **Update in place — no 6th script**; this script already exists for exactly this proof |
| `SECURITY.md` | Create | Rotation cadence/procedure, revoked-token-vs-session interaction, vulnerability reporting |
| `openspec/specs/admin-authoring/spec.md` (via delta) | Modify | Gate requirement updated; login/session/lockout requirements added (sdd-spec's job) |
| `openspec/specs/security-policy/spec.md` (via delta) | Create | Documentation-requirement capability (sdd-spec's job) |

## Interfaces / Contracts

```ts
// src/config/admin-session.ts
export type SessionStore = Map<string, { readonly expiresAt: number }>;
export function createSessionStore(): SessionStore;
export function issueSession(store: SessionStore, now?: number): string; // randomBytes(32).toString("hex")
export type SessionValidation = "valid" | "expired" | "not-found";
export function validateSession(store: SessionStore, token: string | undefined, now?: number): SessionValidation;
export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const sessionStore: SessionStore = createSessionStore();

// src/config/admin-lockout.ts
export type LockoutStore = Map<string, { count: number; windowStart: number }>;
export function isLockedOut(store: LockoutStore, key: string, now?: number): boolean;
export function recordFailedAttempt(store: LockoutStore, key: string, now?: number): void;
export function clearLockout(store: LockoutStore, key: string): void;
export const lockoutStore: LockoutStore = createLockoutStore();

// src/config/admin-auth.ts (evolved)
export type AdminAuthResult = { readonly allowed: true } | { readonly allowed: false };
export function checkAdminAuth(
  sessionToken: string | undefined,
  config: AdminAuthConfig,        // unchanged shape
  store: SessionStore,
): AdminAuthResult;
```

Cookie set/read (verified against `astro/dist/core/cookies/cookies.d.ts`, `AstroCookieSetOptions`):

```ts
context.cookies.set(SESSION_COOKIE_NAME, token, {
  httpOnly: true, secure: true, sameSite: "strict",
  path: "/admin", maxAge: SESSION_TTL_MS / 1000,
});
context.cookies.get(SESSION_COOKIE_NAME)?.value // string | undefined
```

`middleware.ts` bypasses both login paths before calling `checkAdminAuth()`:
`if (["/admin/login", "/admin/api/login"].includes(context.url.pathname)) return next();`

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Session issuance/validation/TTL, lockout counter/window/reset, `checkAdminAuth()`'s 4 branches | Vitest, plain `Map`s and injected `now`, no Astro runtime — same pattern as `admin-auth.test.ts` today |
| Build-time proof | Real login → `Set-Cookie` → protected request → real 303/allow; lockout after 5 failures; both modes unchanged | **Update `verify-admin-server.mjs` in place** (real build, real server, real HTTP) — it already exists for this exact class of proof; do not add a 6th script |

## Migration / Rollout

**Breaking change.** Anyone with a bookmarked `curl -u admin:<secret>` script or a saved
Basic Auth credential in their browser loses access immediately on deploy — Basic Auth is
removed entirely, not kept as a fallback. There is no deprecation window: this is a
single-operator/internal tool with no external API consumers in scope. Operators must
switch to visiting `/admin/login` and authenticating once per session. State this plainly
in the PR description and in `SECURITY.md`. No data migration: session/lockout state is
in-memory only; `ADMIN_ACCESS_TOKEN` itself is unchanged.

## SECURITY.md (structure + real content)

```markdown
# Security Policy

## Reporting a Vulnerability
Report privately via GitHub Security Advisories (Security tab → "Report a vulnerability").
Do not open a public issue for undisclosed vulnerabilities.

## Secret Rotation

### GITHUB_TOKEN (fine-grained PAT)
Rotate every 90 days, or immediately on suspected compromise. Regenerate in GitHub
Settings → Developer settings → Fine-grained tokens, update the `GITHUB_TOKEN` value in
your deployment's env/secret store. No code change required — read only via
`loadPublishingConfig()` at the composition root.

### ADMIN_ACCESS_TOKEN
Rotate every 90 days, or immediately on suspected compromise. Regenerate via
`npm run setup`, or set a new value manually and update your deployment's env/secret store.

**Revocation vs. active sessions**: rotating `ADMIN_ACCESS_TOKEN` prevents new logins
immediately but does NOT invalidate session cookies already issued before rotation — those
remain valid until their own expiry (24 hours from issuance). If you suspect a session is
compromised, restarting the server process clears all in-memory sessions immediately
(deploy access is a higher trust boundary than the admin gate itself).
```

## Open Questions

- [ ] `sdd-spec` has not run yet for this change — this design assumes the proposal's
      capability list; re-verify delta specs match once written.
- [ ] Local-fallback mode + `/admin/login` visited directly: form renders but POST will
      fail-closed if `ADMIN_ACCESS_TOKEN` happens to be unset (the common case). Minor edge
      case, not designed further — flag for `sdd-tasks`/review if it matters.
