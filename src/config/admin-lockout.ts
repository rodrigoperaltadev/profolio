// Pure, in-memory failed-attempt lockout, keyed per client address. See
// design.md's Interfaces/Contracts and the "Lockout threshold/window"
// architecture decision, and the spec's "Failed-Attempt Lockout
// (Per-Client)" requirement. `store` and `now` are injectable so this stays
// testable with plain values, matching `admin-session.ts`'s pattern.
export type LockoutStore = Map<string, { count: number; windowStart: number }>;

export function createLockoutStore(): LockoutStore {
  return new Map();
}

// See design.md's "Lockout threshold/window" decision: fixed window, hard
// reset on elapse — a two-field record (`count`/`windowStart`) instead of a
// sliding timestamp array, trading marginal precision for simplicity and
// testability, consistent with this repo's "state as a plain Map" convention.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function isLockedOut(store: LockoutStore, key: string, now: number = Date.now()): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  if (now - entry.windowStart >= LOCKOUT_WINDOW_MS) return false; // window elapsed
  return entry.count >= LOCKOUT_THRESHOLD;
}

export function recordFailedAttempt(store: LockoutStore, key: string, now: number = Date.now()): void {
  const entry = store.get(key);
  if (!entry || now - entry.windowStart >= LOCKOUT_WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now }); // first attempt, or window elapsed — hard reset
    return;
  }
  entry.count += 1;
}

export function clearLockout(store: LockoutStore, key: string): void {
  store.delete(key);
}

// Process-lifetime singleton — see admin-session.ts for the same rationale.
export const lockoutStore: LockoutStore = createLockoutStore();
