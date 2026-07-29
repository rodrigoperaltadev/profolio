# Proposal: Swappable Theme System

Cross-references: GitHub #6 (this change), #9 (UI-component reuse decision — `BrutalistButton`/`TerminalWindow` ported as native components, no React/JSX, not open for re-litigation), #5 (admin-ui, archived — plain unstyled forms, unaffected), #4 (publishing-layer, archived — unaffected).

## Intent

Profolio has no styling system and no public page at all today — `src/presentation/**` (the "view" boundary element) is empty, and `src/pages/**` only contains `/admin/**`. Issue #6 asks for a *swappable* theme system: profolio is meant to be reused across multiple sites, each with its own visual identity, not a single hardcoded palette. This change introduces that system by porting a REAL theme (my-resume's actual dark/light Brutalist-Terminal aesthetic, already decided for reuse in issue #9) as the first preset, rather than a synthetic placeholder — consistent with this project's "no vacuous proof" discipline seen in every prior change (placeholder module, `verify-*.mjs` scripts). It also ships the first public page (`src/pages/index.astro`) because no page exists yet to prove a theme actually renders.

This is the repo's first CSS-tooling change and introduces its first new runtime dependency category (Tailwind v4) — flagged explicitly in Risks since it must be verified empirically with this project's Astro version, not assumed to work from documentation.

## Scope

### In Scope

- Adopt Tailwind v4 (`tailwindcss` + `@tailwindcss/vite`) as the CSS toolchain, wired into `astro.config.mjs` via the Vite plugin (not PostCSS config) — **locked decision**, corrected mid-exploration after reading my-resume's actual component source and finding pervasive Tailwind utility-class authoring (responsive/state variants, arbitrary-value syntax, `dark:` variants) that would be costly and visually risky to hand-port to plain CSS
- New top-level `themes/` folder holding preset directories; `themes/brutalist/theme.css` ports my-resume's real `@theme { ... }` token block (dark values, the default) plus its `.light-theme`/`html.light-theme` override block verbatim from `/Volumes/DEV01/Dev/my-resume/src/app/globals.css` (lines 8–23 and 31–43) — same custom-property names, same light-mode override pattern
- `BrutalistButton` and `TerminalWindow` ported as native `.astro` components (no React, no JSX, per issue #9) into `src/presentation/brutalist/**` — the existing empty `view` boundary element — stripped of React-only plumbing (`cn()` utility, `"use client"`, JSX prop typing) in favor of native Astro `Astro.props` + template conditionals
- `src/presentation/Layout.astro`: single shared entry point that imports the active preset's CSS, sets the `data-theme` attribute, and inlines the light/dark runtime toggle script (vanilla JS, `localStorage`-backed, no client framework — consistent with admin-ui's precedent)
- `src/config/theme-config.ts`: `loadThemePreset()` reads `THEME_PRESET` env var (default `"brutalist"`), validated against a known-preset list, fails loudly (throws) on an unrecognized value — same fail-closed shape as `publishing-config.ts`; this is real, unit-testable logic that hits the 80% coverage gate
- `src/pages/index.astro` (`prerender = true`): one minimal public page rendering `Layout`, `TerminalWindow`, and a `BrutalistButton` (used as the light/dark toggle trigger) — proves the theme renders end-to-end, nothing more
- New build-time proof script `scripts/verify-theme-build.mjs` (pattern: `verify-content-collections.mjs`/`verify-frontmatter-round-trip.mjs`/`verify-admin-server.mjs`): runs a real `astro build`, then inspects the emitted CSS for both the dark `@theme` values and the light override values and asserts they differ for at least one token (e.g. `--color-background`), plus inspects the emitted HTML for the `data-theme` attribute and toggle script — a real, non-vacuous proof that light/dark actually differ post-build
- New `devDependencies`: `tailwindcss`, `@tailwindcss/vite`

### Out of Scope

- Admin UI theming (#5, done, stays plain unstyled forms) and the publishing layer (#4, done) — unaffected
- A second theme preset — this change proves the mechanism with exactly one real preset; a second preset is future work and may surface requirements (e.g. how CSS-file selection generalizes beyond a static import) not fully solved here
- A runtime preset-picker UI — preset selection is build-time only (env var read once in `src/config/**`); only light/dark WITHIN the active preset toggles at runtime
- A full home page or blog layout — `index.astro` is a minimal proof page, not a finished site
- Any generic/preset-agnostic shared component layer — `BrutalistButton`/`TerminalWindow` are treated as theme-specific to the Brutalist/Terminal aesthetic they were designed for (see Approach), not generic UI

## Capabilities

### New Capabilities

- `theme-system`: a `themes/<preset>/` folder convention (currently one real preset, `brutalist`) holding Tailwind v4 `@theme` token CSS with a light-mode override block; a build-time preset-selection config (`loadThemePreset()`); a shared `Layout.astro` wiring CSS + the runtime light/dark toggle; and theme-specific components (`BrutalistButton`, `TerminalWindow`) under `src/presentation/brutalist/**`
- `public-pages`: the repo's first real public route (`src/pages/index.astro`), prerendered, consuming `theme-system`

### Modified Capabilities

- None — this is additive; no existing capability's contract changes. (`astro.config.mjs`'s Vite config gains a plugin entry; no existing `output`/adapter behavior changes.)

## Approach

**Tailwind v4 wiring.** `@tailwindcss/vite` is added to `astro.config.mjs`'s `vite.plugins`, per Tailwind v4's official Astro integration path (Vite plugin, not the old PostCSS-config route). This is genuinely new ground for this repo — the first CSS/build-tool dependency — and per this project's track record (three real Astro-version/integration surprises across four prior changes), it is verified empirically early during apply (a working `astro dev` render and a working `astro build` output), not assumed correct from documentation. See Risks.

**Preset folder shape.** `themes/<preset>/theme.css` holds ONLY Tailwind's `@theme { ... }` token block plus the `.light-theme`/`html.light-theme` override block — copied from my-resume's actual pattern, not reinvented. This is deliberately kept as **pure CSS with no imports of its own** (the `@import "tailwindcss";` entry point lives once, in `src/presentation/Layout.astro`'s stylesheet, not duplicated per-preset). `themes/` sits outside `src/`, is not `.ts`/`.astro`, and is therefore outside ESLint's type-checked project and `eslint-plugin-boundaries`' file-matching entirely — **no new boundaries element is needed for it**, confirmed by inspection of `eslint.config.js` (boundaries only classifies files it lints; CSS files are never linted).

**Theme-specific components stay under `src/presentation/**`, not under `themes/`.** This is a deliberate scope-boundary call: `BrutalistButton`/`TerminalWindow` are `.astro` files with real imports, and only files matched by a `boundaries/elements` pattern are subject to the `view -> [lib, content]` restriction — per this repo's own documented precedent (the `middleware.ts` "unmatched files aren't restricted" finding in `eslint.config.js`), a component living inside the unmatched top-level `themes/` folder would silently fall outside the credential-free `view` guarantee entirely. Placing them at `src/presentation/brutalist/**` keeps them governed by the existing (currently empty) `view` boundary element with zero config changes. **These two components are treated as theme-specific, not generic UI** — their Tailwind classes and copy (`SECURE_NODE_V1.2 // SESSION_ENCRYPTED`, brutalist shadow/border treatment) are baked around this one aesthetic. A future second preset would need its own components under its own `src/presentation/<preset>/**`, or a generic shared layer would need to emerge later as an explicit, separate refactor — not assumed or pre-built now.

**Preset selection is build-time only.** `src/config/theme-config.ts` follows the exact shape of `publishing-config.ts`: `loadThemePreset()` reads `process.env.THEME_PRESET` (the only permitted `process.env` read site per AGENTS.md's DI convention), defaults to `"brutalist"`, and throws on an unrecognized value (fail-closed, same posture as the admin-ui's `ADMIN_ACCESS_TOKEN` handling). **Honest limitation, stated explicitly rather than glossed over**: because Tailwind/Vite CSS imports must be statically analyzable, `Layout.astro` imports `themes/brutalist/theme.css` via a static import today — with exactly one preset, there is nothing to dynamically select between yet. `loadThemePreset()` establishes the read/validate contract (and drives the `data-theme` attribute) that a second preset would plug into; generalizing the CSS-file wiring itself (e.g. a lookup keyed by preset name) is deferred until a second preset actually exists, to avoid building speculative machinery for one data point.

**Light/dark toggle.** A tiny inline `<script>` in `Layout.astro` (no framework) reads `localStorage`, falls back to `prefers-color-scheme`, and toggles the `.light-theme`/`html.light-theme` class — matching my-resume's exact selector pattern so the ported CSS works unmodified. `index.astro`'s `BrutalistButton` (secondary variant) acts as the toggle trigger, proving both the ported component and the light/dark mechanism in one minimal page.

**Verification.** `scripts/verify-theme-build.mjs` follows this repo's established build-time-proof pattern: run a real `astro build`, then assert the emitted CSS contains both the dark and light values for a sampled token and that they differ, and that the emitted `index.html` carries the `data-theme` attribute and toggle script. This avoids the "vacuous unit test on non-testable `.astro`/CSS content" trap already documented in admin-ui's Testing Strategy — `.astro` markup and CSS aren't meaningfully unit-testable, so the proof is a real build artifact inspection instead. `loadThemePreset()` itself (real branching/validation logic) is unit-tested normally and counts toward the 80% Vitest coverage gate.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `package.json` | Modified | New devDependencies: `tailwindcss`, `@tailwindcss/vite` |
| `astro.config.mjs` | Modified | Adds `@tailwindcss/vite` to `vite.plugins`; no change to existing `output`/adapter/`legacy` settings |
| `themes/brutalist/theme.css` | New | Ported `@theme` token block + `.light-theme`/`html.light-theme` override, verbatim from my-resume's `globals.css` |
| `src/presentation/brutalist/BrutalistButton.astro`, `TerminalWindow.astro` | New | Native Astro ports of the React/JSX originals, no `cn()`/React plumbing |
| `src/presentation/Layout.astro` | New | Shared layout: CSS entry point (`@import "tailwindcss"` + preset CSS), `data-theme` attribute, inline light/dark toggle script |
| `src/config/theme-config.ts` (+ test) | New | `loadThemePreset()` — build-time preset read/validate, fail-closed |
| `src/pages/index.astro` | New | First public page, `prerender = true`, consumes `Layout` + both components |
| `scripts/verify-theme-build.mjs` | New | Build-time proof: real build, asserts dark/light CSS values differ and expected markup is present |
| `eslint.config.js` | Unchanged | No new boundaries element required — confirmed `themes/` is outside ESLint's file-matching; `src/presentation/**` already exists as the `view` element |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Tailwind v4's Vite plugin does not integrate cleanly with this repo's Astro version/`output: "server"` setup (this project has hit three real Astro-integration surprises across four prior changes) | Medium-High | Verify empirically and early during apply — a working `astro dev` render and a working `astro build` output — before building components/pages on top of it; do not assume correctness from Tailwind's docs |
| Porting JSX-authored components (`cn()`, `"use client"`, React prop typing) to native `.astro` introduces subtle visual drift despite reusing the same Tailwind classes | Medium | Side-by-side visual comparison against my-resume's rendered originals during apply; keep the Tailwind utility strings verbatim, only the templating layer changes |
| The build-time-only CSS wiring (static import of one preset) does not generalize automatically when a second preset is added later — someone may assume `THEME_PRESET` alone controls which CSS loads | Medium | Stated explicitly in this proposal and design.md as a known, deliberate limitation; `loadThemePreset()`'s contract is real today, but the CSS-file lookup itself is intentionally deferred, not silently missing |
| `verify-theme-build.mjs` becomes a vacuous check (e.g. asserting CSS text exists without asserting dark/light values actually differ) | Low-Medium | Script explicitly asserts inequality between the dark and light value of at least one sampled custom property, not mere presence |
| New Tailwind devDependencies drift out of sync with a future Astro/Vite major bump, given this repo's history of version-surprise findings | Low | Out of scope for this change; flagged for future dependency-bump changes to re-verify |

## Rollback Plan

Remove `tailwindcss`/`@tailwindcss/vite` from `package.json` and the Vite plugin entry from `astro.config.mjs`; delete `themes/brutalist/**`, `src/presentation/**` (currently only this change's content), `src/config/theme-config.ts` (+ test), `src/pages/index.astro`, and `scripts/verify-theme-build.mjs` via git. No existing capability's contract is modified, so no other code depends on any of this — a clean revert with no data migration.

## Dependencies

- Depends on issue #9's decision (native `.astro` port, no React/JSX) for `BrutalistButton`/`TerminalWindow` — not re-litigated here.
- Depends on my-resume's `src/app/globals.css` and `src/components/ui/{BrutalistButton,TerminalWindow}.tsx` as the verbatim source of tokens/markup/classes being ported.
- Unaffected by and does not depend on admin-ui (#5) or publishing-layer (#4); both remain untouched.
- Sets up (but does not build) the folder convention a future second preset would extend.

## Success Criteria

- [ ] `tailwindcss` + `@tailwindcss/vite` installed; `astro.config.mjs`'s Vite config includes the plugin; `astro dev` and `astro build` both work with it
- [ ] `themes/brutalist/theme.css` contains the ported `@theme` block (dark defaults) and the `.light-theme`/`html.light-theme` override block with the same custom-property names as my-resume's source
- [ ] `BrutalistButton.astro` and `TerminalWindow.astro` exist under `src/presentation/brutalist/**`, render equivalent markup/classes to the React originals, with no React/JSX/`cn()` dependency
- [ ] `src/config/theme-config.ts`'s `loadThemePreset()` defaults to `"brutalist"`, reads `THEME_PRESET`, and throws on an unrecognized value; unit-tested, counts toward the 80% coverage gate
- [ ] `src/pages/index.astro` exists with `export const prerender = true`, renders `Layout` + both ported components, and the light/dark toggle button works via a runtime click (localStorage-backed, no framework)
- [ ] `scripts/verify-theme-build.mjs` runs a real build and asserts the dark/light CSS values differ for at least one token and expected markup (`data-theme`, toggle script) is present in the built output
- [ ] No new `eslint-plugin-boundaries` element added for `themes/`; `src/presentation/**`'s existing `view -> [lib, content]` rule is unchanged and governs the new components
- [ ] Coverage gate holds at 80% under strict TDD for all new testable logic (`theme-config.ts`)

## Review Workload Forecast

- Estimated changed lines: ~350-500 (Tailwind/Astro config wiring, ported theme CSS, two ported `.astro` components, `Layout.astro`, `theme-config.ts` + tests, `index.astro`, `verify-theme-build.mjs`). Likely under or close to the 400-line budget — smaller than admin-ui, larger than a pure-config change.
- Chained PRs: Not clearly required by size alone, but a natural two-slice split exists if the budget is exceeded once `sdd-tasks` produces exact estimates: (1) Tailwind/Astro wiring + ported theme CSS + `theme-config.ts` (infra/config, no UI) as one PR; (2) ported components + `Layout.astro` + `index.astro` + `verify-theme-build.mjs` (the actual visible UI surface) as a second PR.
- Decision needed before apply: Possibly — recommend the orchestrator re-check against the cached `delivery_strategy` once `sdd-tasks` produces exact line counts, since this estimate sits near the 400-line threshold.

## Proposal question round

No open product questions remain — all decision points raised during exploration were answered by the user and are recorded as locked decisions above (Tailwind v4 adoption, porting the real my-resume theme now, shipping one minimal public page, build-time-only preset selection). The scope-boundary calls this proposal made unilaterally (`themes/` folder shape, component placement under `src/presentation/**`, build-time-selection mechanism, and the build-time verification approach) are flagged explicitly throughout Approach/Risks for the user's review rather than presented as pre-approved.
