# Design: Swappable Theme System

## Technical Approach

Port my-resume's real Brutalist/Terminal theme as the first `themes/<preset>/` preset, wired through Tailwind v4's `@tailwindcss/vite` plugin (not PostCSS), with a single CSS entry point owned by `Layout.astro`. Two `.astro` components replace their React/JSX originals via `Astro.props` + a tiny local class-join helper (no `clsx`/`tailwind-merge`). Preset selection is build-time only (`loadThemePreset()`, same fail-closed idiom as `publishing-config.ts`). Verification is a real `astro build` inspection, matching `verify-admin-server.mjs`'s pattern.

## Architecture Decisions

| Decision | Choice | Alternatives rejected | Rationale |
|---|---|---|---|
| CSS entry point ownership | New `src/presentation/global.css` (`@import "tailwindcss"; @import "../../themes/brutalist/theme.css";`), imported once from `Layout.astro` | Import `theme.css` directly in `Layout.astro`'s frontmatter | Keeps `themes/**` pure CSS with zero imports (per proposal), single owner of the Tailwind entry point |
| `class` merging in ported components | Local `cn(...parts: Array<string \| false \| undefined>): string` in `src/presentation/brutalist/cn.ts` — filter + join, no conflict resolution | `clsx`/`tailwind-merge` deps | No conflicting utility pairs exist in the two ported components; a join is sufficient — avoids a new dependency |
| Toggle wiring across Layout/page boundary | Event delegation: `document.addEventListener("click", …)` in `Layout.astro`, matching `[data-theme-toggle]` | Layout renders the button itself | `BrutalistButton` lives in `index.astro`, not `Layout.astro`; delegation decouples the toggle mechanism from where the trigger is placed |
| FOUC prevention | Synchronous `<script is:inline>` as the first child of `<head>`, no `defer`/`type="module"` | Toggle logic at end of `<body>` | Inline non-deferred scripts block parsing before paint; a deferred/end-of-body script would flash default (dark) before applying `light-theme` |

## File Changes

| File | Action | Description |
|---|---|---|
| `astro.config.mjs` | Modify | Add `import tailwindcss from "@tailwindcss/vite"` and `vite: { plugins: [tailwindcss()] }`; `output`/adapter/`legacy` unchanged |
| `package.json` | Modify | devDependencies: `tailwindcss`, `@tailwindcss/vite` |
| `themes/brutalist/theme.css` | New | Verbatim `@theme {…}` (10 color tokens + 3 font tokens) and `.light-theme, html.light-theme {…}` override, ported from my-resume's `globals.css` lines 8–23/31–43 |
| `src/presentation/global.css` | New | `@import "tailwindcss";` + `@import "../../themes/brutalist/theme.css";` |
| `src/presentation/brutalist/cn.ts` | New | Local class-join helper |
| `src/presentation/brutalist/BrutalistButton.astro` | New | Native port, `variant` prop, rest-attribute spread |
| `src/presentation/brutalist/TerminalWindow.astro` | New | Native port, `<slot />` for children |
| `src/presentation/Layout.astro` | New | CSS import, `data-theme` attribute, FOUC-prevention script, toggle-delegation script |
| `src/config/theme-config.ts` (+ test) | New | `loadThemePreset()` |
| `src/pages/index.astro` | New | `prerender = true`; renders `Layout` + both components |
| `scripts/verify-theme-build.mjs` | New | Real `astro build` + emitted-CSS/HTML inspection |

## Interfaces / Contracts

```ts
// src/config/theme-config.ts
export type ThemePreset = "brutalist";
const KNOWN_PRESETS: readonly ThemePreset[] = ["brutalist"];
export function loadThemePreset(): ThemePreset {
  const raw = process.env.THEME_PRESET ?? "brutalist";
  if (!KNOWN_PRESETS.includes(raw as ThemePreset)) {
    throw new Error(`Unknown THEME_PRESET "${raw}". Known presets: ${KNOWN_PRESETS.join(", ")}`);
  }
  return raw as ThemePreset;
}
```

```astro
---
// BrutalistButton.astro
interface Props { variant?: "primary" | "secondary"; class?: string }
const { variant = "primary", class: className, ...rest } = Astro.props;
---
<button class={cn(baseClasses, variantClasses(variant), className)} {...rest}>
  <slot />
</button>
```

**Toggle script** (`Layout.astro`, `<head>`, first child, `is:inline`): reads `localStorage.getItem("theme")`, falls back to `matchMedia("(prefers-color-scheme: light)")`, adds `light-theme` to `document.documentElement` if light — runs before paint. A second `is:inline` script (delegation click handler) toggles the class and writes `localStorage.setItem("theme", …)`.

**Known limitation** (flag, don't silently fix): `TerminalWindow`'s `dark:` Tailwind variants default to `prefers-color-scheme` media strategy (no `@custom-variant dark` override found in my-resume's source), so they track OS preference independently of the manual `.light-theme` toggle — kept verbatim per the "no visual drift" mandate; a future pass could unify them under one variant strategy.

## Testing Strategy

| Layer | What | Approach |
|---|---|---|
| Unit | `loadThemePreset()`: default, valid override, invalid-value throw | Vitest, counts toward 80% gate |
| Unit | `cn()` helper: filters falsy, joins truthy | Vitest |
| Build-time proof | `.astro` templates, ported CSS values, toggle wiring | `scripts/verify-theme-build.mjs` — not unit-testable |
| Not tested | Visual fidelity vs. my-resume | Manual side-by-side during apply (per proposal's Risks) |

## Migration / Rollout

No migration. Compatibility check: installed `vite@8.1.5` and `astro@7.1.4` (peer-depends on `vite@^8.0.13`) both exceed Tailwind v4's Vite-plugin floor — no version conflict found. Two genuine risks, not asserted as solved:
1. **CSS minification may rewrite token values.** Vite 8 ships `lightningcss` for CSS transforms; hex colors in `@theme`/`.light-theme` may be normalized (e.g., `#111111` → `#111` or an `oklch()` form) during a production build. `verify-theme-build.mjs` MUST assert with a minification-tolerant regex/parsed-value comparison, not exact hex string match — confirm empirically during apply.
2. No `engines`/`.nvmrc` pin exists in this repo; Vite 8 requires Node `^20.19.0 || >=22.12.0`. Pre-existing gap, not introduced by this change, but now load-bearing for a build-tool dependency — worth a follow-up, not blocking.

## Open Questions

- [ ] Exact emitted-CSS value format post-minification (confirm during apply before finalizing `verify-theme-build.mjs`'s assertion)
- [ ] Whether `dark:` variant/OS-preference vs. manual toggle divergence needs a follow-up issue
