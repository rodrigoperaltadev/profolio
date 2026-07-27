// Dispatch-table mapper — see design.md's Architecture Decisions: "Mapper
// shape". Adding a 3rd collection is one new `mappers` key; `toContentEntry()`
// itself never grows a new branch.
import type { CollectionEntry, CollectionKey } from "astro:content";
import type { ContentEntry } from "../entry";

type Mapper<C extends CollectionKey> = (entry: CollectionEntry<C>) => ContentEntry;

const mappers: { posts: Mapper<"posts">; projects: Mapper<"projects"> } = {
  posts: (entry) => ({
    id: entry.id,
    title: entry.data.title,
    date: entry.data.date,
    draft: entry.data.draft,
    tags: entry.data.tags,
    body: entry.body ?? "",
  }),
  projects: (entry) => ({
    id: entry.id,
    title: entry.data.name,
    date: entry.data.date,
    draft: entry.data.draft,
    tags: entry.data.stack,
    link: entry.data.link,
    body: entry.body ?? "",
  }),
};

export function toContentEntry<C extends CollectionKey>(
  entry: CollectionEntry<C>,
): ContentEntry {
  // `mappers[entry.collection]` narrows via a generic index (`C`), which TS
  // cannot statically unify back to `Mapper<C>` on its own — a known limit of
  // generic dispatch over object literals, not a real type-safety gap: each
  // `mappers` entry is still fully typed against its own collection above.
  const mapper = mappers[entry.collection] as Mapper<C>;
  return mapper(entry);
}
