import { describe, expect, it } from "vitest";
import type { CollectionEntry } from "astro:content";
import { isPubliclyVisible } from "./visibility";

// Fixture builder keeps each case's intent (which flags are set) visible at
// the call site while still satisfying CollectionEntry<"posts">'s full shape.
function postFixture(
  data: Partial<CollectionEntry<"posts">["data"]>,
): CollectionEntry<"posts"> {
  return {
    id: "hello-world",
    collection: "posts",
    body: "Body text is irrelevant to visibility filtering.",
    data: {
      title: "Hello World",
      date: new Date("2026-07-27"),
      tags: [],
      draft: false,
      deleted: false,
      ...data,
    },
  };
}

describe("isPubliclyVisible — symmetric deleted/draft filter predicate", () => {
  it.each([
    ["deleted:true excludes the entry", { deleted: true }, false],
    [
      "draft:true (deleted unset/false) excludes the entry",
      { draft: true },
      false,
    ],
    [
      "both deleted:true and draft:true exclude the entry",
      { deleted: true, draft: true },
      false,
    ],
    [
      "both unset/false include the entry",
      { deleted: false, draft: false },
      true,
    ],
  ] as const)("%s", (description, overrides, expected) => {
    const entry = postFixture(overrides);

    expect(isPubliclyVisible(entry)).toBe(expected);
  });
});
