import { describe, expect, it } from "vitest";
import {
  clearLockout,
  createLockoutStore,
  isLockedOut,
  recordFailedAttempt,
} from "./admin-lockout";

// Fixed reference instant — see admin-session.test.ts for the same rationale.
const NOW = 1_700_000_000_000;
const CLIENT = "203.0.113.7";

describe("isLockedOut", () => {
  it("returns false for a client with no recorded attempts", () => {
    const store = createLockoutStore();

    expect(isLockedOut(store, CLIENT, NOW)).toBe(false);
  });

  it("returns false below the failure threshold", () => {
    const store = createLockoutStore();
    for (let i = 0; i < 4; i++) recordFailedAttempt(store, CLIENT, NOW);

    expect(isLockedOut(store, CLIENT, NOW)).toBe(false);
  });

  it("returns true once failures exceed the threshold within the window", () => {
    const store = createLockoutStore();
    for (let i = 0; i < 5; i++) recordFailedAttempt(store, CLIENT, NOW);

    expect(isLockedOut(store, CLIENT, NOW)).toBe(true);
  });

  it("does not affect a different client address", () => {
    const store = createLockoutStore();
    for (let i = 0; i < 5; i++) recordFailedAttempt(store, CLIENT, NOW);

    expect(isLockedOut(store, "198.51.100.20", NOW)).toBe(false);
  });

  it("returns false once the window has elapsed, even for a still-locked-out client", () => {
    const store = createLockoutStore();
    const fifteenMinutesMs = 15 * 60 * 1000;
    for (let i = 0; i < 5; i++) recordFailedAttempt(store, CLIENT, NOW);
    expect(isLockedOut(store, CLIENT, NOW)).toBe(true);

    // No recordFailedAttempt call here — proves isLockedOut itself treats a
    // stale entry as expired, not just recordFailedAttempt's reset path.
    expect(isLockedOut(store, CLIENT, NOW + fifteenMinutesMs + 1)).toBe(false);
  });
});

describe("recordFailedAttempt", () => {
  it("sets count to 1 and windowStart to now on the first attempt", () => {
    const store = createLockoutStore();

    recordFailedAttempt(store, CLIENT, NOW);

    expect(store.get(CLIENT)).toEqual({ count: 1, windowStart: NOW });
  });

  it("increments count on subsequent attempts within the same window", () => {
    const store = createLockoutStore();

    recordFailedAttempt(store, CLIENT, NOW);
    recordFailedAttempt(store, CLIENT, NOW + 1_000);

    expect(store.get(CLIENT)).toEqual({ count: 2, windowStart: NOW });
  });

  it("resets count to 1 and windowStart once the 15-minute window has elapsed", () => {
    const store = createLockoutStore();
    const fifteenMinutesMs = 15 * 60 * 1000;

    for (let i = 0; i < 5; i++) recordFailedAttempt(store, CLIENT, NOW);
    expect(isLockedOut(store, CLIENT, NOW)).toBe(true);

    const afterWindow = NOW + fifteenMinutesMs + 1;
    recordFailedAttempt(store, CLIENT, afterWindow);

    expect(store.get(CLIENT)).toEqual({ count: 1, windowStart: afterWindow });
    expect(isLockedOut(store, CLIENT, afterWindow)).toBe(false);
  });
});

describe("clearLockout", () => {
  it("removes the client's key entirely so isLockedOut returns false", () => {
    const store = createLockoutStore();
    for (let i = 0; i < 5; i++) recordFailedAttempt(store, CLIENT, NOW);
    expect(isLockedOut(store, CLIENT, NOW)).toBe(true);

    clearLockout(store, CLIENT);

    expect(store.has(CLIENT)).toBe(false);
    expect(isLockedOut(store, CLIENT, NOW)).toBe(false);
  });
});
