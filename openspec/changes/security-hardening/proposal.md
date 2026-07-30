# Proposal: Security Hardening (Session-Cookie Auth, Lockout, Secrets Policy)

Cross-references: GitHub #8 (this change, scope narrowed to auth+admin-access+secrets-policy only after exploration's recommendation), #4 (publishing-layer, archived — `GithubContentWriterAdapter`/`sanitizeError`), #5 (admin-ui, archived — introduced the interim shared-secret gate this change upgrades), #7 (env-wizard, archived — generates/stores `ADMIN_ACCESS_TOKEN`, unaffected by this change). Explicitly OUT of #8 as of the scope-narrowing comment: Dependabot (#39, already implemented, closed), Stryker mutation testing (#40, separate issue, not started), Playwright E2E (#41, separate issue, not started) — none of the three are addressed here.

## Intent

Issue #5 shipped `/admin/**` gated by HTTP Basic Auth comparing a single shared secret (`ADMIN_ACCESS_TOKEN`) on every request, explicitly documented at the time as an interim stopgap superseded by #8. Two real gaps remain today: (1) the browser resends the raw secret on every single request rather than authenticating once, maximizing the secret's exposure surface across the session's lifetime; (2) there is no limit on repeated failed login attempts, so a wrong-guess script can hammer the gate indefinitely with no penalty. Neither gap is theoretical — this is the only access-control mechanism this repo has, protecting the only write path into the operator's content. This change upgrades the existing shared-secret model to session-cookie-based login plus failed-attempt lockout, and closes the one real documentation gap around secret rotation, without introducing GitHub OAuth or any new runtime dependency (per this project's consistent zero-new-dependency posture across every archived change).

## Scope

### In Scope

- A new `/admin/login` route (GET renders a plain HTML form, POST validates the shared secret against `ADMIN_ACCESS_TOKEN` using the existing `timingSafeStringEqual()`) — no client-side JS framework, matching every other admin page
- On successful login: issue a random session token (`crypto.randomBytes(32)`, matching the entropy precedent already set for `ADMIN_ACCESS_TOKEN` generation in #7), store it server-side with an expiry, and set it via `context.cookies.set()` (native Astro API, no new dependency) as `HttpOnly`, `Secure`, `SameSite=Strict`, scoped to `/admin`
- Session store: in-memory (e.g. `Map<token, expiry>`) inside the running Node process — justified against this project's actual deployment model (single `@astrojs/node` standalone process, no horizontal scaling anywhere in this repo's design); sessions do not need to survive a process restart, and the tradeoff (a restart forces every logged-in operator to re-authenticate) is acceptable and will be stated explicitly, not hidden
- `src/middleware.ts`/`checkAdminAuth()` upgraded to validate the session cookie instead of a per-request Basic Auth header; unauthenticated requests to `/admin/**` (excluding `/admin/login` itself) are denied and redirected to the login page instead of returning a raw 401
- Failed-attempt lockout on `/admin/login`: in-memory counter keyed by client IP (`context.clientAddress`, native Astro/Node API — no new dependency), not a single global counter, so one attacker cannot lock out the legitimate operator from a different address; exceeding a configurable threshold within a window temporarily denies further attempts from that key, fail-closed by design
- Both mode-dependent behaviors from the current spec are PRESERVED: full/server mode (GitHub env vars set) still fail-closes on missing/unset `ADMIN_ACCESS_TOKEN`; local-fallback mode (no GitHub env vars) still requires no gate at all — only the mechanism *within* full mode changes
- `SECURITY.md` at repo root, documenting: (1) rotation cadence/procedure for `GITHUB_TOKEN` (fine-grained PAT, regenerate via GitHub settings, update `.env`/deployment secret, no code change needed — confirmed via `publishing-config.ts`'s constructor-injection-only contract); (2) rotation/revocation procedure for `ADMIN_ACCESS_TOKEN` (regenerate via `npm run setup`, or manually; revoking it invalidates future logins but does NOT retroactively invalidate already-issued session cookies until they expire — this interaction must be stated plainly); (3) how to report a vulnerability (contact channel/GitHub Security Advisory)
- Unit tests (Vitest) for session issuance/validation/expiry and lockout counter logic, isolated from Astro's runtime the same way `checkAdminAuth()` already is

### Out of Scope

- GitHub OAuth or retiring `ADMIN_ACCESS_TOKEN` as the root of trust — explicitly rejected per the locked decision; the shared secret remains, only its exchange mechanism changes
- Audit logging (who created/edited/deleted, when) — no user-identity system exists; a shared secret has no identity to attribute actions to, and adding one would be a much larger, separately-scoped change
- Persistent (cross-restart) session storage, e.g. a database or file-backed store — explicitly rejected given the single-process deployment model; revisit only if horizontal scaling is ever introduced
- Password hashing/salting for `ADMIN_ACCESS_TOKEN` itself — unchanged from #5/#7, still a plain timing-safe compare, since it is a single operator-provisioned secret, not a per-user password
- Dependabot (#39, done separately), Stryker mutation testing (#40), Playwright E2E (#41) — all confirmed to have zero technical coupling to this change during exploration and are tracked as independent issues
- New "token age" reminder/expiry-nudge tooling for `GITHUB_TOKEN`/`ADMIN_ACCESS_TOKEN` — mentioned as a possible future addition during exploration but not requested; `SECURITY.md` documents cadence, it does not enforce or remind

## Capabilities

### New Capabilities

- `security-policy`: `SECURITY.md` — documentation-only capability, mirroring the existing `code-conventions` capability's "Documented Conventions" pattern (a spec requirement that a documentation file exists and covers specific, enumerable content), covering rotation cadence and revocation procedure for both secrets plus vulnerability-reporting instructions

### Modified Capabilities

- `admin-authoring`: the "Admin Access Gate (Mode-Dependent)" requirement changes from stateless per-request Basic Auth to session-cookie-based login with server-side session state and failed-attempt lockout; both existing mode-dependent behaviors (full-mode fail-closed, local-fallback no-gate) are preserved as-is — only the in-full-mode mechanism changes. New requirements are added for the login route, session issuance/validation, and lockout behavior.

## Approach

**Session issuance and validation** live alongside `checkAdminAuth()` in `src/config/**` (or a sibling module within the same boundaries element — exact file split is a design decision), keeping the existing discipline of pure, unit-testable functions taking explicit inputs (a token/store, not ambient state) so they can be exercised with real `Request`/cookie values, no Astro runtime, exactly as `checkAdminAuth()` is proven today.

**Redirect vs. 401 semantics** change deliberately: today's Basic Auth gate returns a raw 401 with a `WWW-Authenticate` header (correct for an HTTP-native credential prompt). A session-cookie model backed by an actual login page makes a redirect to `/admin/login` the correct UX for an unauthenticated GET; the login POST endpoint itself still fails closed with a 401-equivalent response on wrong credentials or when locked out. Design finalizes the exact status codes and redirect targets.

**Lockout key = client IP, not a global counter** (unilateral call): a single global failed-attempt counter would let a remote attacker's guessing script lock out the legitimate operator too — a self-inflicted denial-of-service. Keying by `context.clientAddress` avoids that at negligible cost for a single-operator tool; IP-spoofing behind a reverse proxy is a known limitation but is disproportionate to defend against pre-emptively here and is called out under Risks below rather than silently assumed away.

**In-memory session/lockout state, no persistence layer** (unilateral call): matches this repo's actual deployment shape — one `@astrojs/node` standalone process, no load balancer, no horizontal scaling anywhere in its design so far. A restart clearing sessions/lockout counters is an accepted, explicitly-documented tradeoff, not an oversight.

**No code gap in secrets handling** (confirmed, not assumed): re-read `src/publishing/github-content-writer-adapter.ts` and `src/publishing/sanitize-error.ts` directly during this proposal — the token is injected via constructor only, never read from `process.env` inside the adapter, and every error path (both the catch-all in `write()` and the non-2xx branch in `writeValidated()`) is routed through `sanitizeError(err, [this.config.token])` before reaching a caller. `SECURITY.md` is therefore a documentation deliverable layered on top of already-correct code, not a fix for a code-level leak.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `src/config/admin-auth.ts` (or sibling module) | Modified | Session issuance/validation and lockout-counter logic added alongside/replacing per-request Basic Auth check |
| `src/middleware.ts` | Modified | Validates session cookie instead of Basic Auth header; redirects unauthenticated `/admin/**` GETs to `/admin/login` |
| `src/pages/admin/login.astro` | New | Login form (GET) |
| `src/pages/admin/api/login.ts` (name indicative) | New | Login POST endpoint: validates secret, issues session cookie, enforces lockout |
| `SECURITY.md` | New | Rotation cadence/procedure for `GITHUB_TOKEN`/`ADMIN_ACCESS_TOKEN`, vulnerability-reporting instructions |
| `openspec/specs/admin-authoring/spec.md` | Modified | Delta: gate mechanism requirement updated; new login/session/lockout requirements added |
| `openspec/specs/security-policy/spec.md` | New | Documentation-requirement capability for `SECURITY.md` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A bug in session validation locks the legitimate operator out entirely (availability risk — this is the only access-control mechanism and the only write path) | Medium | Full-mode fail-closed behavior is preserved unchanged as the outer contract; session logic is unit-tested in isolation before wiring into middleware; manual verification script (matching this repo's `scripts/verify-*.mjs` precedent) exercises a real login → session → protected-request flow end-to-end |
| A bug or oversight weakens the gate (security regression — e.g. cookie missing `HttpOnly`/`Secure`/`SameSite`, or session tokens with insufficient entropy) | Medium | Cookie flags and 256-bit token entropy are explicit, tested requirements, not implementation details left to chance; timing-safe compare is reused unchanged for the login-time secret check |
| Lockout keyed by IP is bypassed by an attacker rotating IPs (e.g. via proxies), or a shared corporate/NAT IP causes one bad actor to lock out unrelated legitimate users behind the same address | Medium | Explicitly accepted limitation for a single-operator tool; documented in `SECURITY.md`/design rather than silently assumed away; revisit only if a real multi-tenant or public-facing threat model emerges |
| In-memory session/lockout state is lost on every deploy/restart, forcing re-login and resetting lockout counters (could be seen as either a minor UX regression or, worse, a way to "reset" a lockout by restarting) | Low-Medium | Explicitly documented tradeoff tied to the single-process deployment model; restarting the process requires deploy access, which is already a higher trust boundary than the admin gate itself |
| `SECURITY.md`'s rotation guidance is read as a stronger guarantee than it is (e.g. implying automatic enforcement) | Low | Content states plainly it is manual/documentation-only, consistent with the "no over-claiming" precedent already set by `AGENTS.md`'s mechanical-vs-guidance split |
| Revoking `ADMIN_ACCESS_TOKEN` does not retroactively invalidate already-issued session cookies until their expiry, creating a window where a "revoked" secret's prior session is still valid | Medium | Session expiry kept short (exact TTL is a design decision, days not weeks); this interaction is stated explicitly in `SECURITY.md` and design, not left implicit |

## Rollback Plan

Revert `src/middleware.ts` and `src/config/admin-auth.ts` (or sibling module) to the prior Basic-Auth-only `checkAdminAuth()`; remove `src/pages/admin/login.astro` and the login POST endpoint; remove `SECURITY.md` and its spec capability. No data migration — session/lockout state is in-memory only and disappears on process restart regardless; `ADMIN_ACCESS_TOKEN` itself is untouched by this change (same secret, same env var, same generation path from #7).

## Dependencies

- Depends on `admin-auth.ts`/`checkAdminAuth()` (#5, archived) for the existing timing-safe compare and mode-dependent gate contract this change upgrades, not replaces.
- Depends on `ADMIN_ACCESS_TOKEN` generation/rotation via `scripts/setup-wizard.mjs` (#7, archived) — unaffected by this change; the wizard still generates the same secret, only how it's exchanged at login changes.
- Depends on `sanitizeError()`/constructor-injection discipline (#4, archived) as the confirmed baseline that secrets handling in the publishing layer needs no code change, only documentation.
- No dependency on #39 (Dependabot, done), #40 (Stryker), or #41 (Playwright) — confirmed zero technical coupling during exploration.

## Success Criteria

- [ ] `/admin/login` renders a form; correct-secret POST issues an `HttpOnly`/`Secure`/`SameSite=Strict` session cookie and redirects into `/admin`
- [ ] Subsequent `/admin/**` requests are authenticated via the session cookie, not a re-sent Basic Auth header
- [ ] Repeated failed logins from the same client IP are locked out after a defined threshold within a defined window; a different IP is unaffected
- [ ] Full-mode fail-closed behavior is unchanged: missing/unset `ADMIN_ACCESS_TOKEN` still denies all `/admin/**` access
- [ ] Local-fallback mode is unchanged: no GitHub env vars means no gate, exactly as today
- [ ] `SECURITY.md` exists at repo root with rotation cadence/procedure for both `GITHUB_TOKEN` and `ADMIN_ACCESS_TOKEN`, the revoked-secret-vs-active-session interaction, and vulnerability-reporting instructions
- [ ] Session issuance/validation and lockout-counter logic are unit-tested in isolation from the Astro runtime, matching `checkAdminAuth()`'s existing testability pattern
- [ ] Coverage gate holds at 80% under strict TDD for all new/modified code

## Review Workload Forecast

- Estimated changed lines: ~350-550 (session issuance/validation module + tests, lockout-counter module + tests, `middleware.ts` changes, new login page + POST endpoint, `admin-authoring` spec delta, new `security-policy` spec + `SECURITY.md`). Likely near, possibly under, the 400-line budget — smaller than #5 (admin-ui) or #7 (env-wizard) since no new adapter or CLI tooling is involved, but the security-criticality of this surface argues for careful review regardless of line count.
- Chained PRs: Possibly, if line count runs high. Natural two-slice split if needed: (1) session/lockout core logic + unit tests (pure, testable in isolation, no runtime wiring yet); (2) middleware wiring + login page/endpoint + spec delta + `SECURITY.md` (the actual behavior-change slice, highest-risk review target since it touches the live gate).
- Decision needed before apply: Possibly — recommend the orchestrator re-check against the cached `delivery_strategy` once `sdd-tasks` produces exact line counts; given this change modifies the repo's only access-control mechanism, err toward chaining even near the budget line rather than a single large PR.

## Proposal question round

All product-level decisions were already resolved by the user before this proposal was written (see the locked decisions in the task): session-cookie login + lockout over GitHub OAuth, audit logging explicitly out of scope, secrets policy as documentation only. The additional calls this proposal makes unilaterally — lockout keyed by IP rather than a global counter, in-memory session/lockout state tied to the single-process deployment model, redirect-vs-401 semantics, and the revoked-token-vs-active-session interaction — are flagged explicitly throughout Approach/Risks for review rather than presented as pre-approved. No further question round is proposed; if the user wants to revisit the IP-keying or session-TTL calls before spec/design, flag it now rather than during those phases.
