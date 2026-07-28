import { describe, expect, it } from "vitest";
import { parseCollectionParam } from "./collection-param";

describe("parseCollectionParam", () => {
  it("accepts 'posts'", () => {
    expect(parseCollectionParam("posts")).toBe("posts");
  });

  it("accepts 'projects'", () => {
    expect(parseCollectionParam("projects")).toBe("projects");
  });

  it("rejects an unknown collection name", () => {
    expect(parseCollectionParam("comments")).toBeNull();
  });

  it("rejects undefined (missing route param)", () => {
    expect(parseCollectionParam(undefined)).toBeNull();
  });
});
