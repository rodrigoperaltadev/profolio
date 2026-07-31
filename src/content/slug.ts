// Derives a public URL slug from a CollectionEntry's id, which carries a
// ".md" suffix under legacy.collectionsBackwardsCompat (see profile.ts's and
// to-content-entry.ts's documented gotcha). Anchored regex — strips exactly
// one trailing ".md", never an interior occurrence.
export function toSlug(id: string): string {
  return id.replace(/\.md$/, "");
}
