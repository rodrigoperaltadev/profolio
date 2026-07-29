# Public Pages Specification

## Purpose

Defines the repo's first real public route, proving the `theme-system` capability renders end-to-end. This is a minimal proof page, not a finished home page or blog layout.

## Requirements

### Requirement: First Public Route Consumes the Theme System

`src/pages/index.astro` MUST declare `export const prerender = true`, and MUST render `Layout.astro` together with the `TerminalWindow` and `BrutalistButton` ported components, with the button acting as the light/dark toggle trigger.

#### Scenario: Page is statically prerendered

- GIVEN `src/pages/index.astro` with `export const prerender = true`
- WHEN the site is built
- THEN the page is emitted as static HTML

#### Scenario: Page renders the theme components

- GIVEN a request to `/`
- WHEN the page renders
- THEN it includes `Layout`, a `TerminalWindow` instance, and a `BrutalistButton` instance in the output

#### Scenario: Toggle button works at runtime

- GIVEN the built `/` page loaded in a browser
- WHEN a user clicks the `BrutalistButton` acting as the toggle
- THEN the active theme (`data-theme`/light-dark class) switches without a page reload

### Requirement: Minimal Scope Boundary

`index.astro` MUST NOT implement a full home page, blog layout, or any content-collection rendering; it exists solely to prove the theme system renders correctly.

#### Scenario: Page has no content-collection dependency

- GIVEN `src/pages/index.astro`
- WHEN its imports are inspected
- THEN it does not import from `src/content/**` or render any collection entries
