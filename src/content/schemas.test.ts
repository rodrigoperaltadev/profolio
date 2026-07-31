import { describe, expect, it } from "vitest";
import { postsSchema, profileSchema, projectsSchema } from "./schemas";

const SAMPLE_DATE = "2026-07-27";
const SAMPLE_POST_TITLE = "Hello World";
const SAMPLE_PROJECT_LINK = "https://github.com/rodrigoperaltadev/profolio";
const SAMPLE_PROFILE_NAME = "Ada Lovelace";
const SAMPLE_PROFILE_ROLE = "Software Engineer";
const SAMPLE_PROFILE_BIO = "Building things with Astro.";
const SAMPLE_PROFILE_EMAIL = "ada@example.com";
const SAMPLE_PROFILE_LINK = { label: "GitHub", url: "https://github.com/ada" };

type ProfileOverrides = Partial<
  Record<"name" | "role" | "bio" | "email" | "links", unknown>
>;

function buildProfileInput(overrides: ProfileOverrides = {}): Record<string, unknown> {
  return {
    name: SAMPLE_PROFILE_NAME,
    role: SAMPLE_PROFILE_ROLE,
    bio: SAMPLE_PROFILE_BIO,
    email: SAMPLE_PROFILE_EMAIL,
    links: [SAMPLE_PROFILE_LINK],
    ...overrides,
  };
}

describe("postsSchema", () => {
  it("validates a well-formed post and defaults draft to false", () => {
    const result = postsSchema.safeParse({
      title: SAMPLE_POST_TITLE,
      date: SAMPLE_DATE,
      tags: ["meta"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.draft).toBe(false);
      expect(result.data.title).toBe(SAMPLE_POST_TITLE);
    }
  });

  it("rejects a post missing the required title field", () => {
    const result = postsSchema.safeParse({
      date: SAMPLE_DATE,
      tags: ["meta"],
    });

    expect(result.success).toBe(false);
  });

  it("defaults deleted to false when omitted", () => {
    const result = postsSchema.safeParse({
      title: SAMPLE_POST_TITLE,
      date: SAMPLE_DATE,
      tags: ["meta"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deleted).toBe(false);
    }
  });

  it("accepts an explicit deleted: true", () => {
    const result = postsSchema.safeParse({
      title: SAMPLE_POST_TITLE,
      date: SAMPLE_DATE,
      tags: ["meta"],
      deleted: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deleted).toBe(true);
    }
  });
});

describe("projectsSchema", () => {
  it("validates a well-formed project and defaults draft to false", () => {
    const result = projectsSchema.safeParse({
      name: "Profolio",
      stack: ["Astro", "TypeScript"],
      link: SAMPLE_PROJECT_LINK,
      date: SAMPLE_DATE,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.draft).toBe(false);
      expect(result.data.name).toBe("Profolio");
    }
  });

  it("rejects a project missing the required link field", () => {
    const result = projectsSchema.safeParse({
      name: "Profolio",
      stack: ["Astro"],
      date: SAMPLE_DATE,
    });

    expect(result.success).toBe(false);
  });

  it("defaults deleted to false when omitted", () => {
    const result = projectsSchema.safeParse({
      name: "Profolio",
      stack: ["Astro", "TypeScript"],
      link: SAMPLE_PROJECT_LINK,
      date: SAMPLE_DATE,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deleted).toBe(false);
    }
  });

  it("accepts an explicit deleted: true", () => {
    const result = projectsSchema.safeParse({
      name: "Profolio",
      stack: ["Astro", "TypeScript"],
      link: SAMPLE_PROJECT_LINK,
      date: SAMPLE_DATE,
      deleted: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.deleted).toBe(true);
    }
  });
});

describe("profileSchema", () => {
  it("validates a well-formed profile entry", () => {
    const result = profileSchema.safeParse(buildProfileInput());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe(SAMPLE_PROFILE_NAME);
      expect(result.data.links).toEqual([SAMPLE_PROFILE_LINK]);
    }
  });

  it("defaults links to an empty array when omitted", () => {
    const result = profileSchema.safeParse(buildProfileInput({ links: undefined }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.links).toEqual([]);
    }
  });

  it("rejects a links array made of bare strings instead of {label, url} objects", () => {
    const result = profileSchema.safeParse(
      buildProfileInput({ links: [SAMPLE_PROFILE_LINK.url] }),
    );

    expect(result.success).toBe(false);
  });

  it("rejects a profile entry missing the required name field", () => {
    const result = profileSchema.safeParse(buildProfileInput({ name: undefined }));

    expect(result.success).toBe(false);
  });

  it("rejects a profile entry missing the required email field", () => {
    const result = profileSchema.safeParse(buildProfileInput({ email: undefined }));

    expect(result.success).toBe(false);
  });
});
