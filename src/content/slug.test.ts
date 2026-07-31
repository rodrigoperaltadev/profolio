import { describe, expect, it } from "vitest";
import { toSlug } from "./slug";

const SLUG = "hello-world";

describe("toSlug", () => {
  it("strips exactly one trailing .md suffix", () => {
    expect(toSlug(`${SLUG}.md`)).toBe(SLUG);
  });

  it("returns an id with no .md suffix unchanged", () => {
    expect(toSlug(SLUG)).toBe(SLUG);
  });

  it("does not alter an id containing .md as an interior substring, not a trailing suffix", () => {
    expect(toSlug("my.md-post")).toBe("my.md-post");
  });
});
