// Minimal hand-rolled YAML serializer scoped to the four primitive shapes
// `postsSchema`/`projectsSchema` actually use (string, boolean, Date,
// string[]) — see design.md's Architecture Decisions: "Frontmatter
// serialization". No npm YAML dependency; the surface is small, fixed,
// and fully covered by unit tests.
const FRONTMATTER_DELIMITER = "---";

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function quoteYamlString(value: string): string {
  return `"${escapeYamlString(value)}"`;
}

function serializeScalar(value: string | boolean | Date): string {
  if (typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return quoteYamlString(value.toISOString());
  }
  return quoteYamlString(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

interface LinkEntry {
  readonly label: string;
  readonly url: string;
}

function isLinkEntry(value: unknown): value is LinkEntry {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).label === "string" &&
    typeof (value as Record<string, unknown>).url === "string"
  );
}

// Deliberately distinct from `isStringArray()`: an empty array satisfies
// both (vacuous `.every()`), so `serializeEntry()` checks this first only
// when non-empty, falling back to the shared empty-array inline form
// either way — see design.md's "Frontmatter serializer widening" decision
// for why this stays a nested block sequence, not parallel string arrays.
function isLinkArray(value: unknown): value is readonly LinkEntry[] {
  return Array.isArray(value) && value.length > 0 && value.every(isLinkEntry);
}

function serializeArray(key: string, values: readonly string[]): string {
  if (values.length === 0) {
    return `${key}: []`;
  }
  const items = values.map((item) => `  - ${quoteYamlString(item)}`).join("\n");
  return `${key}:\n${items}`;
}

function serializeLinkArray(key: string, values: readonly LinkEntry[]): string {
  const items = values
    .map(
      (link) =>
        `  - label: ${quoteYamlString(link.label)}\n    url: ${quoteYamlString(link.url)}`,
    )
    .join("\n");
  return `${key}:\n${items}`;
}

function serializeEntry(key: string, value: unknown): string {
  // Checked before `isStringArray()`: an empty array vacuously satisfies
  // both predicates, but `isLinkArray()` requires non-empty, so ordering
  // this first only matters for non-empty link arrays — empty arrays fall
  // through to `isStringArray()`'s existing inline-`[]` handling either way.
  if (isLinkArray(value)) {
    return serializeLinkArray(key, value);
  }
  if (isStringArray(value)) {
    return serializeArray(key, value);
  }
  if (typeof value === "string" || typeof value === "boolean" || value instanceof Date) {
    return `${key}: ${serializeScalar(value)}`;
  }
  throw new Error(`Unsupported frontmatter value for key "${key}"`);
}

export function buildMarkdownFile(
  frontmatter: Record<string, unknown>,
  body: string,
): string {
  const lines = Object.entries(frontmatter).map(([key, value]) =>
    serializeEntry(key, value),
  );
  return [FRONTMATTER_DELIMITER, ...lines, FRONTMATTER_DELIMITER, "", body].join("\n");
}
