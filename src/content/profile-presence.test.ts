// RED: profile-presence branch condition, extracted per design.md's Testing
// Strategy so the home page's hero-vs-placeholder branch is genuinely unit-
// tested rather than left as an untestable inline ternary.
import { describe, expect, it } from "vitest";
import type { Profile } from "./profile";
import { hasProfile } from "./profile-presence";

describe("hasProfile", () => {
  it("returns false when no profile was read", () => {
    expect(hasProfile(undefined)).toBe(false);
  });

  it("returns true when a profile was read", () => {
    const profile: Profile = {
      name: "Ada Lovelace",
      role: "Software Engineer",
      bio: "Building things with Astro.",
      email: "ada@example.com",
      links: [],
    };
    expect(hasProfile(profile)).toBe(true);
  });
});
