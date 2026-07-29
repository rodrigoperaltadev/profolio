import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins truthy string parts with a space", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("filters out false and undefined entries", () => {
    expect(cn("foo", false, undefined, "bar")).toBe("foo bar");
  });
});
