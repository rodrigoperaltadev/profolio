import { describe, expect, it } from "vitest";
import {
  linksToTextarea,
  parseLinksTextarea,
  profileFrontmatterFromFormData,
} from "./profile-form-fields";

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

const GITHUB_LINK = { label: "GitHub", url: "https://github.com/x" };
const LINKEDIN_LINK = { label: "LinkedIn", url: "https://linkedin.com/in/x" };
const GITHUB_LINE = `${GITHUB_LINK.label} | ${GITHUB_LINK.url}`;
const LINKEDIN_LINE = `${LINKEDIN_LINK.label} | ${LINKEDIN_LINK.url}`;

describe("parseLinksTextarea", () => {
  it("parses one 'label | url' pair per line", () => {
    const value = `${GITHUB_LINE}\n${LINKEDIN_LINE}`;
    expect(parseLinksTextarea(value)).toEqual([GITHUB_LINK, LINKEDIN_LINK]);
  });

  it("trims whitespace around the label and url", () => {
    expect(parseLinksTextarea(`  ${GITHUB_LINK.label}   |   ${GITHUB_LINK.url}  `)).toEqual([
      GITHUB_LINK,
    ]);
  });

  it("ignores blank and whitespace-only lines", () => {
    const value = `${GITHUB_LINE}\n\n   \n${LINKEDIN_LINE}`;
    expect(parseLinksTextarea(value)).toEqual([GITHUB_LINK, LINKEDIN_LINK]);
  });

  it("drops a malformed line missing the '|' delimiter without crashing", () => {
    const value = `${GITHUB_LINE}\nnot-a-valid-line\n${LINKEDIN_LINE}`;
    expect(parseLinksTextarea(value)).toEqual([GITHUB_LINK, LINKEDIN_LINK]);
  });

  it("drops a line with an empty label or empty url", () => {
    const value = ` | ${GITHUB_LINK.url}\n${GITHUB_LINK.label} | \n${LINKEDIN_LINE}`;
    expect(parseLinksTextarea(value)).toEqual([LINKEDIN_LINK]);
  });

  it("returns an empty array for an absent field", () => {
    expect(parseLinksTextarea(null)).toEqual([]);
  });

  it("returns an empty array for a blank textarea", () => {
    expect(parseLinksTextarea("   \n  ")).toEqual([]);
  });
});

describe("linksToTextarea", () => {
  it("serializes links back into one 'label | url' line each", () => {
    expect(linksToTextarea([GITHUB_LINK, LINKEDIN_LINK])).toBe(
      `${GITHUB_LINE}\n${LINKEDIN_LINE}`,
    );
  });

  it("returns an empty string for an empty array", () => {
    expect(linksToTextarea([])).toBe("");
  });

  it("round-trips through parseLinksTextarea", () => {
    expect(parseLinksTextarea(linksToTextarea([GITHUB_LINK]))).toEqual([GITHUB_LINK]);
  });
});

describe("profileFrontmatterFromFormData", () => {
  it("builds profile frontmatter from submitted fields", () => {
    const formData = buildFormData({
      name: "Ada Lovelace",
      role: "Engineer",
      bio: "Builds things.",
      email: "ada@example.com",
      links: "GitHub | https://github.com/ada",
    });
    expect(profileFrontmatterFromFormData(formData)).toEqual({
      name: "Ada Lovelace",
      role: "Engineer",
      bio: "Builds things.",
      email: "ada@example.com",
      links: [{ label: "GitHub", url: "https://github.com/ada" }],
    });
  });

  it("defaults every field to an empty value when the form is empty", () => {
    expect(profileFrontmatterFromFormData(new FormData())).toEqual({
      name: "",
      role: "",
      bio: "",
      email: "",
      links: [],
    });
  });
});
