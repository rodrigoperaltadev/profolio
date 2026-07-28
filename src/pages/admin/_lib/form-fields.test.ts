import { describe, expect, it } from "vitest";
import {
  bodyFromFormData,
  frontmatterFromFormData,
  slugFromFormData,
} from "./form-fields";

const SAMPLE_DATE = "2026-01-01";

function buildFormData(fields: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

describe("frontmatterFromFormData", () => {
  it("builds posts frontmatter from submitted fields", () => {
    const formData = buildFormData({
      title: "Hello",
      date: SAMPLE_DATE,
      tags: "meta, profolio",
    });
    expect(frontmatterFromFormData("posts", formData)).toEqual({
      title: "Hello",
      date: SAMPLE_DATE,
      tags: ["meta", "profolio"],
      draft: false,
      deleted: false,
    });
  });

  it("treats an absent checkbox field as false and a present one as true", () => {
    const formData = buildFormData({ title: "Hello", date: SAMPLE_DATE });
    formData.set("draft", "on");
    expect(frontmatterFromFormData("posts", formData).draft).toBe(true);
  });

  it("defaults tags to an empty array when the field is blank", () => {
    const formData = buildFormData({ title: "Hello", date: SAMPLE_DATE, tags: "  " });
    expect(frontmatterFromFormData("posts", formData).tags).toEqual([]);
  });

  it("builds projects frontmatter from submitted fields", () => {
    const formData = buildFormData({
      name: "Profolio",
      date: SAMPLE_DATE,
      stack: "astro, typescript",
      link: "https://example.com",
    });
    expect(frontmatterFromFormData("projects", formData)).toEqual({
      name: "Profolio",
      date: SAMPLE_DATE,
      stack: ["astro", "typescript"],
      link: "https://example.com",
      draft: false,
      deleted: false,
    });
  });

  it("carries forward an explicit deleted flag instead of always defaulting to false", () => {
    const formData = buildFormData({ title: "Hello", date: SAMPLE_DATE });
    expect(
      frontmatterFromFormData("posts", formData, { deleted: true }).deleted,
    ).toBe(true);
  });
});

describe("bodyFromFormData", () => {
  it("reads the body field", () => {
    const formData = buildFormData({ body: "Some markdown body" });
    expect(bodyFromFormData(formData)).toBe("Some markdown body");
  });

  it("defaults to an empty string when the body field is absent", () => {
    expect(bodyFromFormData(new FormData())).toBe("");
  });
});

describe("slugFromFormData", () => {
  it("reads the slug field", () => {
    const formData = buildFormData({ slug: "hello-world" });
    expect(slugFromFormData(formData)).toBe("hello-world");
  });

  it("defaults to an empty string when the slug field is absent", () => {
    expect(slugFromFormData(new FormData())).toBe("");
  });
});
