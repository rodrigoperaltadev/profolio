// The security-critical, pure, unit-tested surface for the admin access gate.
// See design.md's Interfaces/Contracts and the spec's "Admin Access Gate
// (Mode-Dependent)" requirement. `src/middleware.ts` is a thin Astro-glue
// wrapper around `checkAdminAuth()` — all branching logic lives here so it
// can be exercised with real `Request`/`Headers` objects, no Astro runtime.
import { timingSafeEqual } from "node:crypto";

export interface AdminAuthConfig {
  readonly isConfigured: boolean;
  readonly expectedToken: string | undefined;
}

export type AdminAuthResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly status: 401; readonly wwwAuthenticate?: string };

// `===` short-circuits on the first differing byte — a measurable timing
// side channel for a shared secret. `timingSafeEqual` throws on mismatched
// buffer lengths, so length must be checked first; the length-mismatch
// branch still performs a dummy same-length compare so the length check
// itself doesn't become a (weaker) timing oracle. See design.md's
// "Timing-safe comparison" decision.
export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) {
    timingSafeEqual(bufA, bufA); // dummy compare — avoid a length-based timing oracle
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// HTTP Basic Auth carries the shared secret in the password field; the
// username is unused/ignored. Returns `null` for any missing or malformed
// header rather than throwing, so callers can treat "no token" and "wrong
// token" uniformly.
function parseBasicAuthToken(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  const sep = decoded.indexOf(":");
  return sep === -1 ? null : decoded.slice(sep + 1); // password field carries the token
}

export function checkAdminAuth(request: Request, config: AdminAuthConfig): AdminAuthResult {
  if (!config.isConfigured) return { allowed: true }; // local-fallback: no gate
  if (!config.expectedToken) return { allowed: false, status: 401 }; // fail closed
  const supplied = parseBasicAuthToken(request.headers.get("authorization"));
  if (!supplied || !timingSafeStringEqual(supplied, config.expectedToken)) {
    return { allowed: false, status: 401, wwwAuthenticate: 'Basic realm="admin"' };
  }
  return { allowed: true };
}
