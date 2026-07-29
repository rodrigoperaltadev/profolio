// The only `process.env` read for the theme system — see design.md's
// Interfaces/Contracts and AGENTS.md's DI convention (process.env access
// restricted to src/config/**). Preset selection is build-time only.
export type ThemePreset = "brutalist";

const KNOWN_PRESETS: readonly ThemePreset[] = ["brutalist"];

export function loadThemePreset(): ThemePreset {
  const raw = process.env.THEME_PRESET ?? "brutalist";
  if (!KNOWN_PRESETS.includes(raw as ThemePreset)) {
    throw new Error(`Unknown THEME_PRESET "${raw}". Known presets: ${KNOWN_PRESETS.join(", ")}`);
  }
  return raw as ThemePreset;
}
