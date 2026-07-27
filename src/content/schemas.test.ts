import { describe, expect, it } from "vitest";
import { postsSchema, projectsSchema } from "./schemas";

const SAMPLE_DATE = "2026-07-27";

describe("postsSchema", () => {
  it("validates a well-formed post and defaults draft to false", () => {
    const result = postsSchema.safeParse({
      title: "Hello World",
      date: SAMPLE_DATE,
      tags: ["meta"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.draft).toBe(false);
      expect(result.data.title).toBe("Hello World");
    }
  });

  it("rejects a post missing the required title field", () => {
    const result = postsSchema.safeParse({
      date: SAMPLE_DATE,
      tags: ["meta"],
    });

    expect(result.success).toBe(false);
  });
});

describe("projectsSchema", () => {
  it("validates a well-formed project and defaults draft to false", () => {
    const result = projectsSchema.safeParse({
      name: "Profolio",
      stack: ["Astro", "TypeScript"],
      link: "https://github.com/rodrigoperaltadev/profolio",
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
});
