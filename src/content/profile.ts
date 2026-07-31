// Dedicated read accessor for the `profile` singleton — deliberately NOT
// routed through `to-content-entry.ts`'s mapper table; the content-view-
// contract spec's "Profile Is Exempt from the Shared Entry Contract"
// requirement is satisfied by omission (no `profile` key ever added there).
import { getEntry } from "astro:content";
import type { CollectionEntry } from "astro:content";

export const PROFILE_SLUG = "me";

export type Profile = CollectionEntry<"profile">["data"];

// Mirrors astro:content's own getEntry() contract: returns `undefined` when
// absent, never throws (see the profile-identity spec's "Dedicated Profile
// Read Accessor" requirement).
export async function getProfile(): Promise<Profile | undefined> {
  // getEntry() id shape gotcha (same as edit.ts): the real id carries ".md"
  // under legacy.collectionsBackwardsCompat.
  const entry = await getEntry("profile", `${PROFILE_SLUG}.md`);
  return entry?.data;
}
