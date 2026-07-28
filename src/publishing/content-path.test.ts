import { describe, expect, it } from "vitest";
import { buildContentPath } from "./content-path";

describe("buildContentPath", () => {
  it("builds the repo-relative path for a posts slug", () => {
    expect(buildContentPath("posts", "hello-world")).toBe(
      "src/content/posts/hello-world.md",
    );
  });

  it("builds the repo-relative path for a projects slug", () => {
    expect(buildContentPath("projects", "profolio")).toBe(
      "src/content/projects/profolio.md",
    );
  });
});
