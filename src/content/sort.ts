// Generic comparator + slice helpers for the home teaser and listing routes.
// `byDateDesc` works on any `{date}`-shaped object (including the home
// teaser's local `TeaserItem` type) without touching the shared
// `ContentEntry` contract — see design.md's "Sort/slice shape" decision.
export function byDateDesc(a: { date: Date }, b: { date: Date }): number {
  return b.date.getTime() - a.date.getTime();
}

export function takeRecent<T>(items: readonly T[], count: number): T[] {
  return items.slice(0, count);
}
