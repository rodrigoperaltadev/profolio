import { describe, expect, it, vi } from "vitest";
import { checkAdminAuth, timingSafeStringEqual } from "./admin-auth";

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

// Real `Request`/`Headers` objects — Node globals, no Astro runtime needed.
// See design.md's "Auth-gate testability" decision.
function requestWithAuthHeader(header?: string): Request {
  const headers = new Headers();
  if (header !== undefined) {
    headers.set("authorization", header);
  }
  return new Request("https://example.test/admin", { headers });
}

function basicAuthHeader(password: string): string {
  return `Basic ${Buffer.from(`admin:${password}`, "utf-8").toString("base64")}`;
}

describe("checkAdminAuth — local-fallback mode (not configured)", () => {
  it("allows the request regardless of any presented credentials", () => {
    const result = checkAdminAuth(requestWithAuthHeader(), {
      isConfigured: false,
      expectedToken: undefined,
    });

    expect(result).toEqual({ allowed: true });
  });
});

describe("checkAdminAuth — configured, no expectedToken", () => {
  it("fails closed with 401 even when no credentials are presented", () => {
    const result = checkAdminAuth(requestWithAuthHeader(), {
      isConfigured: true,
      expectedToken: undefined,
    });

    expect(result).toEqual({ allowed: false, status: 401 });
  });
});

describe("checkAdminAuth — configured, expectedToken set", () => {
  const expectedToken = "correct-admin-token";

  it("denies a request with no Authorization header", () => {
    const result = checkAdminAuth(requestWithAuthHeader(), {
      isConfigured: true,
      expectedToken,
    });

    expect(result.allowed).toBe(false);
  });

  it("denies a request with a non-Basic Authorization scheme", () => {
    const result = checkAdminAuth(requestWithAuthHeader("Bearer some-token"), {
      isConfigured: true,
      expectedToken,
    });

    expect(result.allowed).toBe(false);
  });

  it("denies a request with a Basic header whose decoded value has no colon", () => {
    const noColonHeader = `Basic ${Buffer.from("no-colon-here", "utf-8").toString("base64")}`;

    const result = checkAdminAuth(requestWithAuthHeader(noColonHeader), {
      isConfigured: true,
      expectedToken,
    });

    expect(result.allowed).toBe(false);
  });

  it("denies a request presenting the wrong token", () => {
    const result = checkAdminAuth(requestWithAuthHeader(basicAuthHeader("wrong-token")), {
      isConfigured: true,
      expectedToken,
    });

    expect(result).toEqual({
      allowed: false,
      status: 401,
      wwwAuthenticate: 'Basic realm="admin"',
    });
  });

  it("allows a request presenting the correct token", () => {
    const result = checkAdminAuth(requestWithAuthHeader(basicAuthHeader(expectedToken)), {
      isConfigured: true,
      expectedToken,
    });

    expect(result).toEqual({ allowed: true });
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
