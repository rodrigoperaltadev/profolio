// Local class-join helper for the ported Brutalist components — filters
// falsy entries and joins the rest with a space. No conflict resolution
// (no `clsx`/`tailwind-merge`): the two ported components have no
// conflicting utility pairs, so a plain join is sufficient — see
// design.md's Architecture Decisions.
export function cn(...parts: Array<string | false | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(" ");
}
