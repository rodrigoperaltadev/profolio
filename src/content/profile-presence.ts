// Extracted branch condition for the home page's hero-vs-placeholder
// decision — see design.md's Testing Strategy ("profile-presence branch...
// extracted as a pure hasProfile(profile): boolean-style condition"). A type
// predicate is used (still a boolean at runtime) so index.astro's ternary
// gets real TS narrowing instead of needing non-null assertions.
import type { Profile } from "./profile";

export function hasProfile(profile: Profile | undefined): profile is Profile {
  return profile !== undefined;
}
