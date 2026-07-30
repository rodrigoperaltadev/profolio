# Tasks: Security Hardening (Session-Cookie Auth, Lockout, Secrets Policy)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750-850 (session module+tests, lockout module+tests, `admin-auth.ts` rewrite + rewritten test suite, `middleware.ts`, login page+endpoint, `verify-admin-server.mjs` update, `SECURITY.md`) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 → PR3 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

**Note on the estimate and phase-count decision:** the proposal's own pre-design estimate (~350-550 lines) undercounts once design's File Changes table is priced bottom-up: a full rewrite of `admin-auth.test.ts` for the new signature, two brand-new store modules each with their own dedicated test suite, an in-place rewrite of `verify-admin-server.mjs` (replacing every Basic-Auth request with a real login→cookie→protected-request flow plus a new lockout proof), and a new login page + POST endpoint together land closer to 750-850 lines — well over the 400-line budget. This repo's only access-control mechanism is being rewritten, so this plan follows the `admin-ui` precedent of isolating the highest-risk unit for focused review, going one step further than the proposal's suggested 2-way split: **pure session/lockout stores** (Unit 1, lowest risk, highest test density, zero wiring) are separated from **the actual gate rewrite** (Unit 2, `admin-auth.ts` + `middleware.ts` — the highest-risk unit, since it changes the live enforcement logic without yet exposing any UI), which is in turn separated from **the user-facing login route and breaking-change verification** (Unit 3 — new attack surface plus the empirical proof that the old Basic Auth mechanism is genuinely gone). Each unit lands under 400 lines on its own.

### Suggested Work Units

Tracker branch `feature/security-hardening` (draft, no-merge until all children land). Cascade: PR3 → PR2 branch → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | Session + lockout pure stores (TDD) | `feat/security-session-lockout` (base: tracker) | ~350-400 | Lowest risk, highest test density; injectable `Map`s + `now` params, no Astro runtime, no wiring yet |
| 2 | Auth gate evolution + middleware wiring (TDD) | `feat/security-auth-gate` (base: PR1) | ~200-250 | Highest-risk unit — rewrites the repo's only access-control mechanism's core logic; isolated from login UI so review focus stays on the enforcement change |
| 3 | Login route + old-mechanism removal proof + docs | `feat/security-login-route` (base: PR2) | ~250-300 | New user-facing surface, the breaking-change removal proof, and `SECURITY.md` |

## Phase 1: Session + Lockout Pure Stores (Unit 1 — satisfies Session Issuance and Cookie Attributes [store half], In-Memory Session Store Lifecycle, Failed-Attempt Lockout Per-Client [counter half])

- [x] 1.1 RED: `src/config/admin-session.test.ts` — `issueSession()` returns a 256-bit (64-char hex) token and stores an expiry of `now + SESSION_TTL_MS`; `validateSession()` returns `"valid"` for unexpired, `"expired"` at/after TTL boundary (inject `now`), `"not-found"` for unknown token — fails, module doesn't exist
- [x] 1.2 GREEN: create `src/config/admin-session.ts` per design's Interfaces/Contracts — `SessionStore`, `createSessionStore()`, `issueSession(store, now?)`, `validateSession(store, token, now?)`, `SESSION_COOKIE_NAME`, `SESSION_TTL_MS = 24h`, singleton `sessionStore`
- [x] 1.3 RED: `src/config/admin-lockout.test.ts` — `isLockedOut()` false below threshold, true after 5 failures within the 15-min window (inject `now`); `recordFailedAttempt()` increments count / sets `windowStart`; window-elapsed resets count; `clearLockout()` removes the key — fails, module doesn't exist
- [x] 1.4 GREEN: create `src/config/admin-lockout.ts` per design's Interfaces/Contracts — `LockoutStore`, `isLockedOut()`, `recordFailedAttempt()`, `clearLockout()`, singleton `lockoutStore`
- [x] 1.5 Verify: `npm run test` (coverage) exits 0 for both new suites, all metrics ≥80%; `npm run typecheck`, `npm run lint` exit 0
- [x] 1.6 Commit as one work unit; open PR1 → tracker branch `feature/security-hardening`

## Phase 2: Auth Gate Evolution + Middleware Wiring (Unit 2 — satisfies Admin Access Gate (Mode-Dependent) [MODIFIED])

- [ ] 2.1 RED: rewrite `src/config/admin-auth.test.ts` for the new `checkAdminAuth(sessionToken, config, store)` signature — local-fallback (unconfigured) → `allowed: true`; full mode + no `expectedToken` → `allowed: false` (fail-closed, regardless of any presented session); full mode + valid session → `allowed: true`; full mode + missing/expired/unknown session → `allowed: false` — fails against the old Basic-Auth signature
- [ ] 2.2 GREEN: modify `src/config/admin-auth.ts` — change `checkAdminAuth()` signature/behavior per design; remove `parseBasicAuthToken()` (dead code, no remaining caller); keep `timingSafeStringEqual()` unchanged; `AdminAuthResult` drops `status`/`wwwAuthenticate`
- [ ] 2.3 Modify `src/middleware.ts` — bypass `/admin/login` and `/admin/api/login` before the gate check; read the cookie via `context.cookies.get(SESSION_COOKIE_NAME)?.value`; call `checkAdminAuth()` with `sessionStore`; on denied GET, redirect (303) to `/admin/login` instead of returning 401
- [ ] 2.4 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint` all exit 0; `boundaries` element rules still hold for `config`/`middleware`
- [ ] 2.5 Commit as one work unit; open PR2 → PR1 branch

## Phase 3: Login Route, Old-Mechanism Removal Proof, Docs (Unit 3 — satisfies Admin Login Route, Session Issuance and Cookie Attributes [wiring half], Failed-Attempt Lockout Per-Client [wiring half], Documented Secret Rotation Procedure, Documented Revoked-Secret-vs-Active-Session Interaction, Vulnerability Reporting Instructions, No Over-Claiming of Enforcement)

- [ ] 3.1 Create `src/pages/admin/login.astro` — GET renders a plain HTML form, no client-side framework runtime; shows a `?error=` message when present
- [ ] 3.2 Create `src/pages/admin/api/login.ts` — POST: `isLockedOut()` check → `timingSafeStringEqual()` secret check → wrong: `recordFailedAttempt()` + 303 redirect with error → correct: `clearLockout()` + `issueSession()` + `cookies.set()` (`HttpOnly`, `Secure`, `SameSite=Strict`, `path: "/admin"`, `maxAge`) + 303 redirect to `/admin`
- [ ] 3.3 Modify `scripts/verify-admin-server.mjs` **in place** (no 6th script) — replace every Basic Auth request with: (a) POST correct secret → follow redirect → GET `/admin` with the cookie → allowed/non-401; (b) 5x POST wrong secret from the same simulated client → 6th attempt denied without evaluating the secret (lockout proof); (c) full mode, `ADMIN_ACCESS_TOKEN` unset → fail-closed; (d) local-fallback mode (no GitHub env vars) → no gate
- [ ] 3.4 Copy `SECURITY.md` content **verbatim** from design.md's "SECURITY.md (structure + real content)" section into repo-root `SECURITY.md` — do not re-author
- [ ] 3.5 Verify: **actually run** `npm run build` then `npm run verify:admin-server` against the real server (not author-and-assume) — must exit 0, proving the real login→cookie→protected-request flow AND the 5-attempts/15-min lockout, not just that a page loads
- [ ] 3.6 Verify the old Basic-Auth mechanism is genuinely removed, not left as an accidental fallback: run `curl -u admin:<ADMIN_ACCESS_TOKEN>` against a protected `/admin/**` route on the real running server — confirm it no longer authenticates via the `Authorization` header (fails/redirects instead)
- [ ] 3.7 Verify the cookie API empirically, not just via type-checking: inspect the real `Set-Cookie` response header from a successful login (`curl -i` or browser devtools) — confirm `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/admin` are actually present, and confirm the cookie is carried back by the client on the next request
- [ ] 3.8 Re-verify both mode-dependent behaviors on the real running server after the rewrite: full mode with `ADMIN_ACCESS_TOKEN` unset → denies all `/admin/**` (fail-closed); local-fallback mode (no GitHub env vars) → no gate at all, unchanged from before this change
- [ ] 3.9 Review `SECURITY.md` against the final implementation: confirm the "24 hours" session-TTL claim matches `SESSION_TTL_MS`'s actual value; update `SECURITY.md` if the constant changed during implementation
- [ ] 3.10 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint`, `npm run build` all exit 0
- [ ] 3.11 Commit as one work unit; open PR3 → PR2 branch (final child; cascades to tracker → main)

## Next Step

Ready for `sdd-apply`, starting with PR1 (Phase 1). Given `auto-chain`, proceed with Unit 1 without further confirmation; re-check the Review Workload Forecast per-unit estimate as each PR's real diff lands.
