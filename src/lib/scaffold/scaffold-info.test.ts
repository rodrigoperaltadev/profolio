import { describe, expect, it } from "vitest";
import { getScaffoldInfo } from "./scaffold-info";

describe("getScaffoldInfo", () => {
  it("maps a package descriptor to ScaffoldInfo via pass-through", () => {
    const result = getScaffoldInfo({ name: "profolio", version: "0.1.0" });

    expect(result).toEqual({ name: "profolio", version: "0.1.0" });
  });

  it("falls back to 'unknown' when the name is blank", () => {
    const result = getScaffoldInfo({ name: "   ", version: "0.1.0" });

    expect(result).toEqual({ name: "unknown", version: "0.1.0" });
  });
});
