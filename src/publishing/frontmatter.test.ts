import { describe, expect, it } from "vitest";
import { postsSchema, projectsSchema } from "../content/schemas";
import { buildMarkdownFile } from "./frontmatter";

// Test-only reverse parser for the exact minimal-YAML grammar produced by
// `buildMarkdownFile()` (quoted strings, bare booleans, empty/non-empty
// block sequences). Not shipped in `src/publishing/**` — its only purpose
// is proving the serializer's output is valid, schema-parseable YAML
// without pulling in a real YAML dependency. See design.md's Architecture
// Decisions: "Frontmatter serialization".
function unquoteYamlString(raw: string): string {
  const trimmed = raw.trim();
  const inner = trimmed.slice(1, -1);
  return inner.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

function parseScalarToken(raw: string): unknown {
  const trimmed = raw.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "[]") return [];
  return unquoteYamlString(trimmed);
}

function extractFrontmatterLines(markdown: string): string[] {
  const lines = markdown.split("\n");
  const start = lines.indexOf("---");
  const end = lines.indexOf("---", start + 1);
  return lines.slice(start + 1, end);
}

function parseFrontmatterBlock(markdown: string): Record<string, unknown> {
  const lines = extractFrontmatterLines(markdown);
  const result: Record<string, unknown> = {};
  let currentArrayKey: string | null = null;
  let currentArray: string[] = [];

  const flushArray = (): void => {
    if (currentArrayKey !== null) {
      result[currentArrayKey] = currentArray;
      currentArrayKey = null;
      currentArray = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("  - ")) {
      currentArray.push(unquoteYamlString(line.slice(4)));
      continue;
    }
    flushArray();
    const separatorIndex = line.indexOf(": ");
    if (separatorIndex === -1) {
      currentArrayKey = line.slice(0, -1);
      continue;
    }
    const key = line.slice(0, separatorIndex);
    result[key] = parseScalarToken(line.slice(separatorIndex + 2));
  }
  flushArray();

  return result;
}

const SAMPLE_BODY = "Body content goes here.";

describe("buildMarkdownFile — schema round trips", () => {
  it("round-trips a posts fixture with colon and quote characters through postsSchema", () => {
    const original = {
      title: 'Release Notes: v2.0 "Beta"',
      date: new Date("2026-07-27T00:00:00.000Z"),
      tags: ["how-to", "release: notes"],
      draft: true,
      deleted: false,
    };

    const file = buildMarkdownFile(original, SAMPLE_BODY);
    const parsed = parseFrontmatterBlock(file);
    const result = postsSchema.safeParse(parsed);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.title).toBe(original.title);
      expect(result.data.tags).toEqual(original.tags);
      expect(result.data.date.getTime()).toBe(original.date.getTime());
      expect(result.data.draft).toBe(original.draft);
      expect(result.data.deleted).toBe(original.deleted);
    }
    expect(file).toContain(SAMPLE_BODY);
  });

  it("round-trips a projects fixture with colon and quote characters through projectsSchema", () => {
    const original = {
      name: 'Profolio: A "Git-as-CMS" Engine',
      stack: ["Astro", "TypeScript: 5.9"],
      link: "https://example.com/profolio",
      date: new Date("2026-01-15T00:00:00.000Z"),
      draft: false,
      deleted: true,
    };

    const file = buildMarkdownFile(original, SAMPLE_BODY);
    const parsed = parseFrontmatterBlock(file);
    const result = projectsSchema.safeParse(parsed);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe(original.name);
      expect(result.data.stack).toEqual(original.stack);
      expect(result.data.link).toBe(original.link);
      expect(result.data.date.getTime()).toBe(original.date.getTime());
      expect(result.data.draft).toBe(original.draft);
      expect(result.data.deleted).toBe(original.deleted);
    }
  });
});

describe("buildMarkdownFile — edge cases", () => {
  it("serializes an empty string array as an inline empty sequence", () => {
    const original = {
      title: "No Tags Yet",
      date: new Date("2026-07-27T00:00:00.000Z"),
      tags: [] as string[],
      draft: false,
      deleted: false,
    };

    const file = buildMarkdownFile(original, SAMPLE_BODY);
    const parsed = parseFrontmatterBlock(file);
    const result = postsSchema.safeParse(parsed);

    expect(file).toContain("tags: []");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
    }
  });

  it("throws for a frontmatter value outside the four supported shapes", () => {
    expect(() => buildMarkdownFile({ count: 42 }, SAMPLE_BODY)).toThrow(
      'Unsupported frontmatter value for key "count"',
    );
  });
});
