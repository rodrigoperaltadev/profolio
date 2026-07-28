import { describe, expect, it } from "vitest";
import { writeErrorMessage } from "./write-error-message";

describe("writeErrorMessage", () => {
  it("maps a validation error to a plain message including the schema detail", () => {
    expect(
      writeErrorMessage({ kind: "validation", message: "title: Required" }),
    ).toContain("title: Required");
  });

  it("maps a conflict error to a plain reload-and-retry message", () => {
    expect(
      writeErrorMessage({ kind: "conflict", message: "sha conflict" }),
    ).toBe("This entry changed since you loaded it. Reload and try again.");
  });

  it("maps a not-found error to a plain message", () => {
    expect(
      writeErrorMessage({ kind: "not-found", message: "no file to edit" }),
    ).toBe("This entry no longer exists.");
  });

  it("maps an api-error to a generic plain message (no raw exception detail leaked)", () => {
    expect(
      writeErrorMessage({ kind: "api-error", status: 0, message: "ENOENT: ..." }),
    ).toBe("Something went wrong saving this entry. Please try again.");
  });
});
