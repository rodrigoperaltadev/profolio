# Tasks: Swappable Theme System

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~380-450 (Tailwind/Astro wiring, ported theme CSS, `theme-config.ts`+test, two ported `.astro` components + `cn.ts`+test, `Layout.astro`, `index.astro`, `verify-theme-build.mjs`) |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | Tracker → PR1 → PR2 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium

**Note on the estimate and phase-count decision:** file-by-file from design's File Changes table, the infra/config half (`astro.config.mjs`, `package.json`, `theme.css`, `theme-config.ts`+test) is only ~110-150 lines — well under budget on its own. The UI half (`cn.ts`+test, both ported components, `Layout.astro`, `index.astro`, `verify-theme-build.mjs`) runs ~280-330 lines, mostly the build-verification script and the two ported components. Combined, the total sits close to or slightly over 400, and this change is meaningfully smaller than admin-ui (900-1060, 4 units) or publishing-layer (560-650, 4 units) — a single extra split, not four, is proportionate. This plan uses the proposal's own suggested 2-slice boundary (infra/config vs. UI) rather than defaulting to more slices: it isolates the highest-empirical-risk item (Tailwind/Vite integration) in Unit 1 before any UI is built on top of it, and keeps the visual-fidelity-risk work (ported components + Layout) together in Unit 2 where it can be reviewed as one cohesive surface.

### Suggested Work Units

Tracker branch `feature/theme-system` (draft, no-merge until both children land). Cascade: PR2 → PR1 branch → tracker → main.

| Unit | Goal | Branch (base) | Est. lines | Notes |
|------|------|----------------|-----------|-------|
| 1 | Tailwind v4 wiring + ported theme CSS + `theme-config.ts` (TDD) | `feat/theme-tailwind-infra` (base: tracker) | ~110-150 | No UI; isolates the empirical Tailwind/Astro integration check before anything is built on top of it |
| 2 | Ported components + `Layout.astro` + `index.astro` + `verify-theme-build.mjs` (TDD for `cn()`) | `feat/theme-ui-components` (base: PR1) | ~280-330 | The visible UI surface; includes the mandatory manual visual-fidelity check and the post-minification CSS assertion |

## Phase 1: Tailwind Infra + Theme Config (Unit 1 — satisfies Tailwind v4 Vite Wiring, Brutalist Preset Token CSS, Build-Time Preset Selection (Fail-Closed), Single-Preset Static CSS Import, No New Boundaries Element for Themes)

- [x] 1.1 Add `tailwindcss` and `@tailwindcss/vite` as devDependencies in `package.json`; `npm install`
- [x] 1.2 Modify `astro.config.mjs`: import `tailwindcss` from `@tailwindcss/vite`; add `vite: { plugins: [tailwindcss()] }`; leave `output`/adapter/`legacy` unchanged
- [x] 1.3 **Empirical verification (mandatory, do first — before any component/page is built on this):** run `astro dev`, confirm the server starts and a scratch Tailwind utility class resolves in rendered output; run `astro build`, confirm it completes and the emitted CSS contains Tailwind-generated rules — this repo has hit three real Astro-integration surprises across four prior changes, do not assume correctness from Tailwind's docs
- [x] 1.4 Create `themes/brutalist/theme.css` — port the `@theme {...}` block (10 color + 3 font tokens) verbatim from my-resume's `globals.css` lines 8-23, plus the `.light-theme`/`html.light-theme` override block from lines 31-43; same custom-property names; no `@import` statements in this file
- [x] 1.5 Create `src/presentation/global.css` — `@import "tailwindcss";` + `@import "../../themes/brutalist/theme.css";`
- [x] 1.6 RED: `src/config/theme-config.test.ts` — unset `THEME_PRESET` returns `"brutalist"`; `THEME_PRESET="brutalist"` returns `"brutalist"`; unrecognized value throws — fails, module doesn't exist
- [x] 1.7 GREEN: create `src/config/theme-config.ts` — `loadThemePreset()`, `ThemePreset` type, `KNOWN_PRESETS`, fail-closed throw, per design's Interfaces/Contracts
- [x] 1.8 Verify: `npm run lint` — confirm `themes/brutalist/theme.css` is not linted (no matching file pattern) and no new `boundaries/elements` entry was added for `themes/`
- [x] 1.9 Verify: `npm run test` (coverage) exits 0 for `theme-config.test.ts`, all four metrics non-vacuous; `npm run typecheck` exits 0
- [x] 1.10 Commit as one work unit; open PR1 → tracker branch `feature/theme-system`

## Phase 2: Ported Components, Layout, Page, Build Verification (Unit 2 — satisfies Natively Ported Components, Shared Layout Entry Point, First Public Route Consumes the Theme System, Minimal Scope Boundary, Build-Time Verification of Theme Output)

- [ ] 2.1 RED: `src/presentation/brutalist/cn.test.ts` — filters out `false`/`undefined` entries, joins remaining truthy string parts with a space — fails, module doesn't exist
- [ ] 2.2 GREEN: create `src/presentation/brutalist/cn.ts` — local `cn(...parts)` join helper, per design's Architecture Decisions
- [ ] 2.3 Create `src/presentation/brutalist/BrutalistButton.astro` — native port of my-resume's component; `variant` prop (`primary`/`secondary`), rest-attribute spread, `cn()` for class merging; no React/JSX/`"use client"`; Tailwind utility classes preserved verbatim from the original
- [ ] 2.4 Create `src/presentation/brutalist/TerminalWindow.astro` — native port; `<slot />` for children; Tailwind utility classes preserved verbatim
- [ ] 2.5 **Manual visual-fidelity check (mandatory — flagged as untested by design's Testing Strategy):** side-by-side comparison of both rendered components against my-resume's actual rendered originals; confirm no visual drift introduced by the JSX-to-Astro port
- [ ] 2.6 Create `src/presentation/Layout.astro` — imports `global.css`, sets `data-theme` on `<html>`; first-child `<script is:inline>` (no `defer`/`type="module"`) for FOUC-prevention reading `localStorage` then `prefers-color-scheme`; second `is:inline` script delegating clicks on `[data-theme-toggle]` to toggle `.light-theme`/`html.light-theme` and persist to `localStorage`
- [ ] 2.7 Create `src/pages/index.astro` — `export const prerender = true`; renders `Layout` + `TerminalWindow` + `BrutalistButton` (secondary variant, `data-theme-toggle`) as the toggle trigger; no `src/content/**` imports
- [ ] 2.8 Manual smoke test via `astro dev`: load `/`, click the toggle, confirm the theme switches without reload; reload the page and confirm the choice persisted from `localStorage`; clear `localStorage` and confirm fallback to `prefers-color-scheme`
- [ ] 2.9 Create `scripts/verify-theme-build.mjs` — run a real `astro build`; **first inspect the actual emitted CSS file** to determine the real post-minification format of the sampled token (design flags `lightningcss` may rewrite `#111111` to `#111` or an `oklch(...)` form — do not guess the format) and write the dark-vs-light inequality assertion against that observed format; inspect emitted `index.html` for the `data-theme` attribute and toggle script
- [ ] 2.10 Add `verify:theme` npm script to `package.json`; add a corresponding step after Build in `.github/workflows/ci.yml`
- [ ] 2.11 Verify: **actually run** `npm run verify:theme` against the real build (not author-and-assume) — must exit 0
- [ ] 2.12 Verify: `npm run test` (coverage), `npm run typecheck`, `npm run lint`, `npm run build` all exit 0
- [ ] 2.13 Commit as one work unit; open PR2 → PR1 branch (final child; cascades to tracker → main)

## Next Step

Ready for `sdd-apply`, starting with PR1 (Phase 1). Given `auto-chain`, proceed with Unit 1 without further confirmation; re-check the Review Workload Forecast per-unit estimate as each PR's real diff lands.
