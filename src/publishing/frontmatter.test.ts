import { describe, expect, it } from "vitest";
import { postsSchema, profileSchema, projectsSchema } from "../content/schemas";
import { buildMarkdownFile } from "./frontmatter";
import { parseFrontmatterBlock } from "./parse-frontmatter-block";

// Reverse-parsing here now dogfoods the shipped `parseFrontmatterBlock()`
// (see ./parse-frontmatter-block.ts and its dedicated test suite) instead
// of maintaining a private test-only duplicate — that duplicate has been
// promoted into a real `src/publishing/**` module per design.md's Import
// parsing decision, so this suite proves the serializer's output against
// the actual production reverse parser, not a stand-in for it.
function mustParseFrontmatterBlock(markdown: string): Record<string, unknown> {
  const result = parseFrontmatterBlock(markdown);
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data.frontmatter;
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
    const parsed = mustParseFrontmatterBlock(file);
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
    const parsed = mustParseFrontmatterBlock(file);
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

const SAMPLE_PROFILE_NAME = 'Ada "Countess" Lovelace';
const SAMPLE_PROFILE_LINKS = [
  { label: "GitHub", url: "https://github.com/ada" },
  { label: "Site: Portfolio", url: "https://ada.example.com" },
];

function buildProfileFixture(
  links: { label: string; url: string }[] = SAMPLE_PROFILE_LINKS,
): Record<string, unknown> {
  return {
    name: SAMPLE_PROFILE_NAME,
    role: "Software Engineer",
    bio: "Building things with Astro.",
    email: "ada@example.com",
    links,
  };
}

describe("buildMarkdownFile — profile links array", () => {
  it("serializes a links array as a nested block sequence, not parallel string arrays", () => {
    const file = buildMarkdownFile(buildProfileFixture(), SAMPLE_BODY);

    expect(file).toContain("links:\n");
    expect(file).toContain('  - label: "GitHub"\n    url: "https://github.com/ada"');
    expect(file).not.toContain("labels:");
    expect(file).not.toContain("urls:");
  });

  it("round-trips a profile fixture's links array self-consistently through profileSchema", () => {
    const original = buildProfileFixture();

    const file = buildMarkdownFile(original, SAMPLE_BODY);
    const parsed = mustParseFrontmatterBlock(file);
    const result = profileSchema.safeParse(parsed);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe(original.name);
      expect(result.data.links).toEqual(original.links);
    }
  });

  it("serializes an empty links array as an inline empty sequence", () => {
    const original = buildProfileFixture([]);

    const file = buildMarkdownFile(original, SAMPLE_BODY);
    const parsed = mustParseFrontmatterBlock(file);
    const result = profileSchema.safeParse(parsed);

    expect(file).toContain("links: []");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.links).toEqual([]);
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
    const parsed = mustParseFrontmatterBlock(file);
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
