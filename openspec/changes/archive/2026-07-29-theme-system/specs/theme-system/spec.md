# Theme System Specification

## Purpose

Defines the swappable theme system: a `themes/<preset>/` folder convention holding Tailwind v4 token CSS, a build-time preset-selection config, a shared `Layout.astro` wiring CSS and the runtime light/dark toggle, and theme-specific components ported natively into `src/presentation/brutalist/**`. Exactly one real preset (`brutalist`, ported verbatim from my-resume) exists today; the system establishes the convention a second preset would extend, without building speculative multi-preset machinery now.

## Requirements

### Requirement: Tailwind v4 Vite Wiring

The system MUST adopt Tailwind v4 (`tailwindcss` + `@tailwindcss/vite`) as its CSS toolchain, wired into `astro.config.mjs`'s `vite.plugins` array, and MUST NOT use a PostCSS config file for this purpose. Existing `output`/adapter/`legacy` Astro config MUST remain unchanged.

#### Scenario: Vite plugin is present and dev server works

- GIVEN `astro.config.mjs` includes `@tailwindcss/vite` in `vite.plugins`
- WHEN `astro dev` is started
- THEN the server starts successfully and Tailwind utility classes resolve in rendered output

#### Scenario: Build succeeds with the plugin

- GIVEN the Tailwind Vite plugin is wired in
- WHEN `astro build` runs
- THEN the build completes successfully and emits CSS containing Tailwind-generated rules

### Requirement: Brutalist Preset Token CSS

`themes/brutalist/theme.css` MUST contain the `@theme { ... }` token block (dark values as defaults) and the `.light-theme`/`html.light-theme` override block, ported verbatim from my-resume's `src/app/globals.css`, using the same custom-property names. The file MUST contain only these two blocks (no `@import` statements of its own).

#### Scenario: Dark defaults match the source token block

- GIVEN `themes/brutalist/theme.css`
- WHEN its `@theme` block is inspected
- THEN it defines the same custom-property names with the same dark-mode values as my-resume's source

#### Scenario: Light override block is present

- GIVEN `themes/brutalist/theme.css`
- WHEN its `.light-theme`/`html.light-theme` block is inspected
- THEN it overrides the same custom-property names for light mode, matching my-resume's source values

### Requirement: Natively Ported Components

`BrutalistButton` and `TerminalWindow` MUST exist as native `.astro` files under `src/presentation/brutalist/**`, using `Astro.props` and template conditionals in place of React/JSX. The system MUST NOT introduce React, JSX, or a `cn()` utility for these components; Tailwind utility class strings MUST be preserved verbatim from the originals.

#### Scenario: Components render without a client framework

- GIVEN the built output containing `BrutalistButton`/`TerminalWindow`
- WHEN client-side assets are inspected
- THEN no React/JSX runtime is present and both components render as plain HTML with the ported Tailwind classes

#### Scenario: Components are governed by the existing view boundary

- GIVEN `BrutalistButton.astro` and `TerminalWindow.astro` under `src/presentation/brutalist/**`
- WHEN `eslint .` runs with the existing `boundaries/element-types` rule
- THEN both files are classified under the `view` element and are restricted to `[lib, content]` dependencies with no new boundaries element added

### Requirement: Shared Layout Entry Point

`src/presentation/Layout.astro` MUST be the single CSS entry point (importing `@tailwindcss` plus the active preset's `theme.css`), MUST set a `data-theme` attribute on the root element, and MUST inline a vanilla-JS light/dark toggle script with no client-side UI framework.

#### Scenario: Layout sets data-theme

- GIVEN a page rendered through `Layout.astro`
- WHEN the built HTML is inspected
- THEN the root element carries a `data-theme` attribute

#### Scenario: Toggle persists via localStorage

- GIVEN a page using the inline toggle script
- WHEN a user clicks the toggle and reloads the page
- THEN the previously selected theme is restored from `localStorage`

#### Scenario: Toggle falls back to system preference

- GIVEN no prior `localStorage` theme value exists
- WHEN the page loads
- THEN the toggle script falls back to `prefers-color-scheme` to determine the initial theme

### Requirement: Build-Time Preset Selection (Fail-Closed)

`src/config/theme-config.ts` MUST export `loadThemePreset()`, which reads `THEME_PRESET` from the environment (the only permitted `process.env` read site per AGENTS.md's DI convention), defaults to `"brutalist"` when unset, and throws when the value does not match a known preset. This logic MUST be unit-tested and count toward the 80% Vitest coverage gate.

#### Scenario: Default preset is used when unset

- GIVEN `THEME_PRESET` is not set
- WHEN `loadThemePreset()` is called
- THEN it returns `"brutalist"`

#### Scenario: Known preset value is accepted

- GIVEN `THEME_PRESET` is set to `"brutalist"`
- WHEN `loadThemePreset()` is called
- THEN it returns `"brutalist"` without throwing

#### Scenario: Unrecognized preset fails closed

- GIVEN `THEME_PRESET` is set to an unrecognized value
- WHEN `loadThemePreset()` is called
- THEN it throws rather than silently falling back to a default

### Requirement: Single-Preset Static CSS Import (Known Limitation)

Because Tailwind/Vite CSS imports must be statically analyzable, `Layout.astro` MUST import `themes/brutalist/theme.css` via a static import; the system is NOT required to generalize CSS-file selection by preset name in this change. `loadThemePreset()`'s read/validate contract MUST exist independently of this limitation so a future second preset has a defined value to plug into, but the CSS-file lookup itself MAY remain a single static import until a second preset is added.

#### Scenario: Static import is the only CSS selection mechanism

- GIVEN the current codebase with one preset (`brutalist`)
- WHEN `Layout.astro`'s CSS imports are inspected
- THEN exactly one static import of `themes/brutalist/theme.css` is present, with no dynamic preset-keyed CSS lookup implemented

#### Scenario: loadThemePreset() contract is independent of CSS wiring

- GIVEN `loadThemePreset()` returns a validated preset name
- WHEN a hypothetical second preset is added later
- THEN `loadThemePreset()` requires no code change to recognize it as a candidate value, even though the CSS import wiring itself would still need to be generalized separately

### Requirement: Build-Time Verification of Theme Output

`scripts/verify-theme-build.mjs` MUST run a real `astro build`, then assert that the emitted CSS contains genuinely different dark and light values for at least one sampled custom property (e.g. `--color-background`), and that the emitted HTML contains the `data-theme` attribute and the toggle script. The script MUST fail if the sampled values are identical or if the expected markup is absent.

#### Scenario: Verification passes on a correct build

- GIVEN a successful `astro build` with the ported theme CSS and Layout wiring in place
- WHEN `scripts/verify-theme-build.mjs` runs
- THEN it exits successfully after asserting the sampled token's dark and light values differ and the expected markup is present

#### Scenario: Verification fails if dark/light values are identical

- GIVEN a build where the sampled token's dark and light values are accidentally identical
- WHEN `scripts/verify-theme-build.mjs` runs
- THEN it fails with a non-zero exit code rather than passing vacuously

#### Scenario: Verification fails if expected markup is missing

- GIVEN a build where the emitted HTML lacks the `data-theme` attribute or toggle script
- WHEN `scripts/verify-theme-build.mjs` runs
- THEN it fails with a non-zero exit code

### Requirement: No New Boundaries Element for Themes

The system MUST NOT add a new `eslint-plugin-boundaries` element for the top-level `themes/` folder. CSS files under `themes/` MUST remain outside ESLint's file-matching and type-checked project entirely.

#### Scenario: eslint config is unchanged for themes

- GIVEN `eslint.config.js` before and after this change
- WHEN diffed
- THEN no new `boundaries/elements` entry references `themes/`

#### Scenario: Linting themes/ files is a no-op

- GIVEN `themes/brutalist/theme.css`
- WHEN `eslint .` runs
- THEN the file is not linted (no matching file pattern), consistent with CSS files never being linted in this repo
