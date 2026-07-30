import { describe, expect, it, vi } from "vitest";
import { checkAdminAuth, timingSafeStringEqual } from "./admin-auth";
import { createSessionStore, issueSession, SESSION_TTL_MS } from "./admin-session";

// Partial mock: keep the real `timingSafeEqual` behavior (via `vi.fn(actual)`
// wrapping) so every test's actual comparison result is unaffected, but let
// `timingSafeStringEqual`'s length-mismatch test assert the dummy compare on
// the early-return path genuinely calls into `node:crypto`'s primitive
// rather than skipping it — the concrete proof the timing mitigation is real,
// not just present as a comment. See design.md's "Timing-safe comparison"
// decision.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return { ...actual, timingSafeEqual: vi.fn(actual.timingSafeEqual) };
});

const { timingSafeEqual } = await import("node:crypto");

describe("checkAdminAuth — local-fallback mode (not configured)", () => {
  it("allows the request regardless of any presented session token", () => {
    const store = createSessionStore();
    const result = checkAdminAuth(undefined, { isConfigured: false, expectedToken: undefined }, store);

    expect(result).toEqual({ allowed: true });
  });

  it("allows the request even if an unrelated session token is presented", () => {
    const store = createSessionStore();
    const token = issueSession(store);

    const result = checkAdminAuth(token, { isConfigured: false, expectedToken: undefined }, store);

    expect(result).toEqual({ allowed: true });
  });
});

describe("checkAdminAuth — configured, no expectedToken", () => {
  it("fails closed with no session token presented", () => {
    const store = createSessionStore();

    const result = checkAdminAuth(undefined, { isConfigured: true, expectedToken: undefined }, store);

    expect(result).toEqual({ allowed: false });
  });

  it("fails closed even when a valid session token is presented", () => {
    const store = createSessionStore();
    const token = issueSession(store);

    const result = checkAdminAuth(token, { isConfigured: true, expectedToken: undefined }, store);

    expect(result).toEqual({ allowed: false });
  });
});

describe("checkAdminAuth — configured, expectedToken set", () => {
  const expectedToken = "correct-admin-token";

  it("allows a request presenting a valid, unexpired session token", () => {
    const store = createSessionStore();
    const token = issueSession(store);

    const result = checkAdminAuth(token, { isConfigured: true, expectedToken }, store);

    expect(result).toEqual({ allowed: true });
  });

  it("denies a request with no session token", () => {
    const store = createSessionStore();

    const result = checkAdminAuth(undefined, { isConfigured: true, expectedToken }, store);

    expect(result).toEqual({ allowed: false });
  });

  it("denies a request with an unknown session token", () => {
    const store = createSessionStore();

    const result = checkAdminAuth("unknown-token", { isConfigured: true, expectedToken }, store);

    expect(result).toEqual({ allowed: false });
  });

  it("denies a request with an expired session token", () => {
    const store = createSessionStore();
    const token = issueSession(store, Date.now() - SESSION_TTL_MS - 1000);

    const result = checkAdminAuth(token, { isConfigured: true, expectedToken }, store);

    expect(result).toEqual({ allowed: false });
  });
});

describe("timingSafeStringEqual", () => {
  const sharedSecret = "shared-secret";

  it("returns true for an equal match", () => {
    expect(timingSafeStringEqual(sharedSecret, sharedSecret)).toBe(true);
  });

  it("returns false for an equal-length mismatch", () => {
    expect(timingSafeStringEqual(sharedSecret, "shared-decret")).toBe(false);
  });

  it("returns false for an unequal-length mismatch and still invokes timingSafeEqual on a dummy compare (not short-circuited)", () => {
    vi.mocked(timingSafeEqual).mockClear();

    const result = timingSafeStringEqual("short", "much-longer-value");

    expect(result).toBe(false);
    // The mitigation only holds if the length-mismatch branch still performs
    // a same-cost `timingSafeEqual` call — asserting the mock was invoked is
    // what proves this isn't a bare `if (length differs) return false;`
    // early exit with no compensating work.
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
  });
});
