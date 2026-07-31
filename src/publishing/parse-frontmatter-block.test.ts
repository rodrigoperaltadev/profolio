import { describe, expect, it } from "vitest";
import { profileSchema } from "../content/schemas";
import { buildMarkdownFile } from "./frontmatter";
import { parseFrontmatter } from "./parse-frontmatter";
import { parseFrontmatterBlock } from "./parse-frontmatter-block";

// Promotes and extends `frontmatter.test.ts`'s former test-only reverse
// parsers into the shipped `parseFrontmatterBlock()` this module tests —
// see design.md's "Import parsing" Architecture Decision. Scoped strictly
// to the grammar `buildMarkdownFile()` emits: quoted scalars, bare
// booleans, empty/non-empty string-array blocks, and the nested
// `- label: "..."\n  url: "..."` link-array block. Not a general YAML
// parser — malformed input must return a clean error result, never throw.

const SAMPLE_BODY = "Body content goes here.\n\nSecond paragraph.";

function buildProfileFixture(
  links: { label: string; url: string }[] = [
    { label: "GitHub", url: "https://github.com/ada" },
    { label: "Site: Portfolio", url: "https://ada.example.com" },
  ],
): Record<string, unknown> {
  return {
    name: 'Ada "Countess" Lovelace',
    role: "Software Engineer",
    bio: "Building things with Astro.",
    email: "ada@example.com",
    links,
  };
}

describe("parseFrontmatterBlock — profile fixtures (nested links block)", () => {
  it("parses a profile file's frontmatter and body back out, including the nested links block", () => {
    const original = buildProfileFixture();
    const file = buildMarkdownFile(original, SAMPLE_BODY);

    const result = parseFrontmatterBlock(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.frontmatter.name).toBe(original.name);
      expect(result.data.frontmatter.role).toBe(original.role);
      expect(result.data.frontmatter.links).toEqual(original.links);
      expect(result.data.body).toBe(SAMPLE_BODY);
    }
  });

  it("parses an empty links array back as an inline empty sequence", () => {
    const original = buildProfileFixture([]);
    const file = buildMarkdownFile(original, SAMPLE_BODY);

    const result = parseFrontmatterBlock(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.frontmatter.links).toEqual([]);
    }
  });
});

describe("parseFrontmatterBlock — posts-shaped fixtures (plain arrays)", () => {
  it("parses a posts-shaped file with string arrays, booleans, and a date scalar", () => {
    const original = {
      title: 'Release Notes: v2.0 "Beta"',
      date: new Date("2026-07-27T00:00:00.000Z").toISOString(),
      tags: ["how-to", "release: notes"],
      draft: true,
      deleted: false,
    };
    const file = buildMarkdownFile(
      { ...original, date: new Date(original.date) },
      SAMPLE_BODY,
    );

    const result = parseFrontmatterBlock(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.frontmatter.title).toBe(original.title);
      expect(result.data.frontmatter.tags).toEqual(original.tags);
      expect(result.data.frontmatter.date).toBe(original.date);
      expect(result.data.frontmatter.draft).toBe(original.draft);
      expect(result.data.frontmatter.deleted).toBe(original.deleted);
    }
  });

  it("parses an empty string array back as an inline empty sequence", () => {
    const file = buildMarkdownFile(
      { title: "No Tags Yet", tags: [] as string[], draft: false },
      SAMPLE_BODY,
    );

    const result = parseFrontmatterBlock(file);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.frontmatter.tags).toEqual([]);
    }
  });
});

describe("parseFrontmatterBlock — real round trip through parseFrontmatter", () => {
  it("reverses buildMarkdownFile() and re-validates through parseFrontmatter('profile', ...) with matching data, including links", () => {
    const originalProfile = buildProfileFixture();
    const file = buildMarkdownFile(originalProfile, SAMPLE_BODY);

    const blockResult = parseFrontmatterBlock(file);
    expect(blockResult.ok).toBe(true);
    if (!blockResult.ok) return;

    const validated = parseFrontmatter("profile", blockResult.data.frontmatter);

    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.data.name).toBe(originalProfile.name);
      expect(validated.data.email).toBe(originalProfile.email);
      expect(validated.data.links).toEqual(originalProfile.links);
      const schemaCheck = profileSchema.safeParse(blockResult.data.frontmatter);
      expect(schemaCheck.success).toBe(true);
    }
  });

  it("rejects a hand-edited malformed file without throwing and without corrupting a subsequent valid parse", () => {
    const malformed = ["---", "name: Ada", 'role: "Engineer"', "---", "", "Body."].join(
      "\n",
    );

    expect(() => parseFrontmatterBlock(malformed)).not.toThrow();
    const malformedResult = parseFrontmatterBlock(malformed);
    expect(malformedResult.ok).toBe(false);

    // A parser instance is created fresh per call — confirm the previous
    // failed parse left no shared state that could corrupt a later,
    // legitimately-serialized profile parse.
    const validFile = buildMarkdownFile(buildProfileFixture(), SAMPLE_BODY);
    const validResult = parseFrontmatterBlock(validFile);
    expect(validResult.ok).toBe(true);
  });
});

const MALFORMED_FIXTURES: readonly (readonly [string, string])[] = [
  ["missing opening delimiter", 'name: "Ada"\n---\n\nBody.'],
  ["missing closing delimiter", '---\nname: "Ada"\n\nBody.'],
  [
    "garbage line with no colon and no array marker",
    '---\nname: "Ada"\njust some text\n---\n\nBody.',
  ],
  ["unquoted scalar value", "---\nname: Ada\n---\n\nBody."],
  [
    "link label without a matching url",
    '---\nlinks:\n  - label: "GitHub"\nrole: "Engineer"\n---\n\nBody.',
  ],
  [
    "link url without a preceding label",
    '---\nlinks:\n    url: "https://example.com"\n---\n\nBody.',
  ],
  [
    "array item mixed with a link entry under the same key",
    '---\nlinks:\n  - "GitHub"\n  - label: "Site"\n    url: "https://example.com"\n---\n\nBody.',
  ],
  [
    "array item found without a preceding array key",
    '---\n  - "GitHub"\nname: "Ada"\n---\n\nBody.',
  ],
  [
    "array item found after a link entry under the same key",
    '---\nlinks:\n  - label: "Site"\n    url: "https://example.com"\n  - "GitHub"\n---\n\nBody.',
  ],
  ["unquoted array item value", "---\ntags:\n  - how-to\n---\n\nBody."],
  [
    "unquoted link label value",
    '---\nlinks:\n  - label: GitHub\n    url: "https://example.com"\n---\n\nBody.',
  ],
  [
    "unquoted link url value",
    '---\nlinks:\n  - label: "GitHub"\n    url: https://example.com\n---\n\nBody.',
  ],
  [
    "two consecutive link labels with no url between them",
    '---\nlinks:\n  - label: "GitHub"\n  - label: "Site"\n    url: "https://example.com"\n---\n\nBody.',
  ],
];

describe("parseFrontmatterBlock — malformed input never throws", () => {
  it.each(MALFORMED_FIXTURES)("returns a clean error result for: %s", (label, markdown) => {
    expect(() => parseFrontmatterBlock(markdown)).not.toThrow();
    const result = parseFrontmatterBlock(markdown);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.length).toBeGreaterThan(0);
    }
    expect(typeof label).toBe("string");
  });
});
