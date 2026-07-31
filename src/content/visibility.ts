// Shared, single-source predicate for every public read site — see the
// public-content-visibility spec's "Symmetric Deleted/Draft Filter
// Predicate" requirement. Must not be duplicated inline at call sites.
import type { CollectionEntry } from "astro:content";

export function isPubliclyVisible(
  entry: CollectionEntry<"posts" | "projects">,
): boolean {
  return !entry.data.deleted && !entry.data.draft;
}
