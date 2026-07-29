import { afterEach, describe, expect, it, vi } from "vitest";
import { loadThemePreset } from "./theme-config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadThemePreset", () => {
  it("returns \"brutalist\" when THEME_PRESET is unset", () => {
    vi.stubEnv("THEME_PRESET", undefined);

    expect(loadThemePreset()).toBe("brutalist");
  });

  it("returns \"brutalist\" when THEME_PRESET is set to a known preset", () => {
    vi.stubEnv("THEME_PRESET", "brutalist");

    expect(loadThemePreset()).toBe("brutalist");
  });

  it("throws when THEME_PRESET is set to an unrecognized value", () => {
    vi.stubEnv("THEME_PRESET", "does-not-exist");

    expect(() => loadThemePreset()).toThrow(/Unknown THEME_PRESET/);
  });
});
