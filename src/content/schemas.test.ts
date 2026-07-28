import { describe, expect, it } from "vitest";
import { postsSchema, projectsSchema } from "./schemas";

const SAMPLE_DATE = "2026-07-27";
const SAMPLE_POST_TITLE = "Hello World";
const SAMPLE_PROJECT_LINK = "https://github.com/rodrigoperaltadev/profolio";

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
