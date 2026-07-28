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

function serializeArray(key: string, values: readonly string[]): string {
  if (values.length === 0) {
    return `${key}: []`;
  }
  const items = values.map((item) => `  - ${quoteYamlString(item)}`).join("\n");
  return `${key}:\n${items}`;
}

function serializeEntry(key: string, value: unknown): string {
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
