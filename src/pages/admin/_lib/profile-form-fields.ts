// Write-side field parser for the profile setup/edit forms — mirrors
// `form-fields.ts`'s `splitCommaList` precedent (task 3.3), with one extra
// delimiter: `links` is a textarea of `label | url` pairs, one per line (see
// design.md's "`links` form input" decision and task 3.1 — the delimiter is
// `|`, e.g. "GitHub | https://github.com/x"; no dynamic add-row JS, no
// client framework allowed).
export interface ProfileLink {
  readonly label: string;
  readonly url: string;
}

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

// Malformed lines (missing the "|" delimiter, or an empty label/url either
// side of it) are dropped rather than reported — the resulting frontmatter
// still goes through `profileSchema`'s Zod validation-before-write, so a
// genuinely broken submission never silently corrupts the stored profile.
export function parseLinksTextarea(value: FormDataEntryValue | null): ProfileLink[] {
  if (typeof value !== "string") return [];
  const links: ProfileLink[] = [];
  for (const rawLine of value.split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    const separatorIndex = line.indexOf("|");
    if (separatorIndex === -1) continue;
    const label = line.slice(0, separatorIndex).trim();
    const url = line.slice(separatorIndex + 1).trim();
    if (label === "" || url === "") continue;
    links.push({ label, url });
  }
  return links;
}

// Inverse of `parseLinksTextarea` — used to prefill the edit form's textarea
// from the current profile's `links` array.
export function linksToTextarea(links: readonly ProfileLink[]): string {
  return links.map((link) => `${link.label} | ${link.url}`).join("\n");
}

export function profileFrontmatterFromFormData(formData: FormData): Record<string, unknown> {
  return {
    name: stringField(formData, "name"),
    role: stringField(formData, "role"),
    bio: stringField(formData, "bio"),
    email: stringField(formData, "email"),
    links: parseLinksTextarea(formData.get("links")),
  };
}
