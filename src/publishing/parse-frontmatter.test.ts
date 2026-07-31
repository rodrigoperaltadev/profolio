import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./parse-frontmatter";

const SAMPLE_PROFILE_NAME = "Ada Lovelace";
const SAMPLE_PROFILE_LINK = { label: "GitHub", url: "https://github.com/ada" };

function buildProfileFrontmatter(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    name: SAMPLE_PROFILE_NAME,
    role: "Software Engineer",
    bio: "Building things with Astro.",
    email: "ada@example.com",
    links: [SAMPLE_PROFILE_LINK],
    ...overrides,
  };
}

describe("parseFrontmatter — profile branch", () => {
  it("parses a valid profile frontmatter payload, links array included", () => {
    const result = parseFrontmatter("profile", buildProfileFrontmatter());

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe(SAMPLE_PROFILE_NAME);
      expect(result.data.links).toEqual([SAMPLE_PROFILE_LINK]);
    }
  });

  it("rejects a profile frontmatter payload missing the required email field", () => {
    const result = parseFrontmatter(
      "profile",
      buildProfileFrontmatter({ email: undefined }),
    );

    expect(result.ok).toBe(false);
  });
});
