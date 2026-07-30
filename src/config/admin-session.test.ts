import { describe, expect, it } from "vitest";
import {
  createSessionStore,
  issueSession,
  SESSION_TTL_MS,
  validateSession,
} from "./admin-session";

// Fixed reference instant so every test computes expected expiry deterministically
// instead of racing `Date.now()`. See design.md's Interfaces/Contracts —
// `issueSession`/`validateSession` accept an injectable `now` for exactly this reason.
const NOW = 1_700_000_000_000;

describe("issueSession", () => {
  it("returns a 256-bit token encoded as 64 hex characters", () => {
    const store = createSessionStore();

    const token = issueSession(store, NOW);

    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a different token on each call (not a constant)", () => {
    const store = createSessionStore();

    const first = issueSession(store, NOW);
    const second = issueSession(store, NOW);

    expect(first).not.toBe(second);
  });

  it("stores the issued token with an expiry of now + SESSION_TTL_MS", () => {
    const store = createSessionStore();

    const token = issueSession(store, NOW);

    expect(store.get(token)).toEqual({ expiresAt: NOW + SESSION_TTL_MS });
  });
});

describe("validateSession", () => {
  it("returns 'not-found' for a token the store has never seen", () => {
    const store = createSessionStore();

    expect(validateSession(store, "unknown-token", NOW)).toBe("not-found");
  });

  it("returns 'not-found' when the token is undefined (no cookie presented)", () => {
    const store = createSessionStore();

    expect(validateSession(store, undefined, NOW)).toBe("not-found");
  });

  it("returns 'valid' for a token before its expiry", () => {
    const store = createSessionStore();
    const token = issueSession(store, NOW);

    const result = validateSession(store, token, NOW + SESSION_TTL_MS - 1);

    expect(result).toBe("valid");
  });

  it("returns 'expired' exactly at the TTL boundary", () => {
    const store = createSessionStore();
    const token = issueSession(store, NOW);

    const result = validateSession(store, token, NOW + SESSION_TTL_MS);

    expect(result).toBe("expired");
  });

  it("returns 'expired' after the TTL boundary", () => {
    const store = createSessionStore();
    const token = issueSession(store, NOW);

    const result = validateSession(store, token, NOW + SESSION_TTL_MS + 1);

    expect(result).toBe("expired");
  });
});
