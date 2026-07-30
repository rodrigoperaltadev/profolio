// Pure, in-memory session store for the admin gate. See design.md's
// Interfaces/Contracts and the spec's "Session Issuance and Cookie
// Attributes" / "In-Memory Session Store Lifecycle" requirements.
// `store` is an injectable `Map` and `now` is an injectable timestamp so
// this stays testable with plain values — no Astro runtime, matching
// `admin-auth.ts`'s existing testability pattern.
import { randomBytes } from "node:crypto";

export type SessionStore = Map<string, { readonly expiresAt: number }>;

export function createSessionStore(): SessionStore {
  return new Map();
}

export const SESSION_COOKIE_NAME = "admin_session";
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — see design.md's "Session TTL" decision

// 32 random bytes = 256 bits of entropy, hex-encoded to a 64-char string —
// satisfies the spec's "at least 256 bits of entropy" requirement.
export function issueSession(store: SessionStore, now: number = Date.now()): string {
  const token = randomBytes(32).toString("hex");
  store.set(token, { expiresAt: now + SESSION_TTL_MS });
  return token;
}

export type SessionValidation = "valid" | "expired" | "not-found";

export function validateSession(
  store: SessionStore,
  token: string | undefined,
  now: number = Date.now(),
): SessionValidation {
  if (token === undefined) return "not-found";
  const session = store.get(token);
  if (!session) return "not-found";
  return now >= session.expiresAt ? "expired" : "valid";
}

// Process-lifetime singleton — the only place ambient state lives. Pure
// functions above never touch this directly; `middleware.ts`/`login.ts`
// import it at the composition boundary. See design.md's "Session/lockout
// store singletons" decision.
export const sessionStore: SessionStore = createSessionStore();
