// The security-critical, pure, unit-tested surface for the admin access gate.
// See design.md's Interfaces/Contracts and the spec's "Admin Access Gate
// (Mode-Dependent)" requirement. `src/middleware.ts` is a thin Astro-glue
// wrapper around `checkAdminAuth()` — all branching logic lives here so it
// can be exercised with plain values, no Astro runtime.
import { timingSafeEqual } from "node:crypto";
import { validateSession, type SessionStore } from "./admin-session";

export interface AdminAuthConfig {
  readonly isConfigured: boolean;
  readonly expectedToken: string | undefined;
}

export type AdminAuthResult = { readonly allowed: true } | { readonly allowed: false };

// `===` short-circuits on the first differing byte — a measurable timing
// side channel for a shared secret. `timingSafeEqual` throws on mismatched
// buffer lengths, so length must be checked first; the length-mismatch
// branch still performs a dummy same-length compare so the length check
// itself doesn't become a (weaker) timing oracle. See design.md's
// "Timing-safe comparison" decision. Used at login time (`admin/api/login.ts`,
// Phase 3) to compare the submitted secret against `ADMIN_ACCESS_TOKEN`.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // dummy compare — avoid a length-based timing oracle
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Validates a session token issued by the login flow (see `admin-session.ts`)
// against the server-side store — no longer validates a Basic Auth header.
// `config.expectedToken`'s only role here is a misconfiguration check: its
// value is checked for login-time secret comparison in `admin/api/login.ts`
// (Phase 3), not on every request.
export function checkAdminAuth(
  sessionToken: string | undefined,
  config: AdminAuthConfig,
  store: SessionStore,
): AdminAuthResult {
  if (!config.isConfigured) return { allowed: true }; // local-fallback: no gate
  if (!config.expectedToken) return { allowed: false }; // fail closed, misconfigured
  return validateSession(store, sessionToken) === "valid" ? { allowed: true } : { allowed: false };
}
