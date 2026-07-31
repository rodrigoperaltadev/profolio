import { describe, expect, it } from "vitest";
import { isFirstRunExemptPath, shouldRedirectToProfileSetup } from "./admin-first-run";

describe("isFirstRunExemptPath", () => {
  it("is exempt for the profile setup page", () => {
    expect(isFirstRunExemptPath("/admin/profile/setup")).toBe(true);
  });

  it("is exempt for the login page", () => {
    expect(isFirstRunExemptPath("/admin/login")).toBe(true);
  });

  it("is exempt for the login API endpoint", () => {
    expect(isFirstRunExemptPath("/admin/api/login")).toBe(true);
  });

  it("is not exempt for the admin index", () => {
    expect(isFirstRunExemptPath("/admin")).toBe(false);
  });

  it("is not exempt for an unrelated admin path", () => {
    expect(isFirstRunExemptPath("/admin/posts/my-post/edit")).toBe(false);
  });
});

describe("shouldRedirectToProfileSetup", () => {
  it("redirects when no profile exists", () => {
    expect(shouldRedirectToProfileSetup(false)).toBe(true);
  });

  it("does not redirect when a profile already exists", () => {
    expect(shouldRedirectToProfileSetup(true)).toBe(false);
  });
});
