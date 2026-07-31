# Delta for Public Pages

## MODIFIED Requirements

### Requirement: First Public Route Consumes the Theme System

`src/pages/index.astro` MUST declare `export const prerender = true`, and MUST render `Layout.astro`. When a `profile` entry exists, it MUST render a profile hero (via `getProfile()`, reusing `TerminalWindow`) followed by a recent-entries teaser; when no `profile` entry exists, it MUST render the "no profile yet" placeholder defined below instead. In both states, the page MUST continue to expose the existing `data-theme-toggle` trigger wired to `Layout.astro`'s toggle mechanism.
(Previously: rendered a single bare `TerminalWindow` proof containing only a static message and the `BrutalistButton` toggle trigger, with no profile or content-collection rendering of any kind.)

#### Scenario: Page is statically prerendered

- GIVEN `src/pages/index.astro` with `export const prerender = true`
- WHEN the site is built
- THEN the page is emitted as static HTML

#### Scenario: Page renders the profile hero and teaser when a profile exists

- GIVEN a `profile` entry exists
- WHEN a request to `/` renders
- THEN the page includes `Layout`, a profile hero built from `getProfile()` reusing `TerminalWindow`, and a date-descending, filtered recent-entries teaser linking to `/posts` and `/projects`

#### Scenario: Page renders the no-profile placeholder when no profile exists

- GIVEN `getProfile()` returns no profile
- WHEN a request to `/` renders
- THEN the page renders the "No-Profile Public Placeholder" requirement's behavior instead of the hero/teaser

#### Scenario: Toggle mechanism continues to work in both states

- GIVEN the built `/` page loaded in a browser, in either the hero or placeholder state
- WHEN a user clicks the `data-theme-toggle` trigger
- THEN the active theme switches without a page reload, via `Layout.astro`'s existing delegated toggle handler

### Requirement: Minimal Scope Boundary

This requirement is explicitly **superseded**, not silently contradicted: `src/pages/index.astro` MAY now import from `src/content/**` (via `getProfile()` and `getCollection()`) and render real profile and content-collection data. The prior prohibition on any content-collection dependency no longer applies to this route.
(Previously: `index.astro` MUST NOT implement a full home page, blog layout, or any content-collection rendering, and MUST NOT import from `src/content/**`; it existed solely to prove the theme system rendered correctly.)

#### Scenario: Page now depends on content collections and profile data

- GIVEN `src/pages/index.astro`
- WHEN its imports are inspected
- THEN it imports `getProfile()` and `getCollection()` from `src/content/**` and renders real profile and/or entry data, replacing the old no-content-dependency restriction

## ADDED Requirements

### Requirement: No-Profile Public Placeholder

When `getProfile()` returns no profile, `src/pages/index.astro` MUST render a placeholder — reusing `TerminalWindow`/`BrutalistButton` for visual consistency — that plainly invites the visitor to visit `/admin` to complete setup, instead of an empty or broken-looking hero. This placeholder is distinct from and does not replace the `/admin/**`-only first-run redirect defined by `admin-authoring`; it serves the public visitor, not the admin operator, and is not a redirect.

#### Scenario: Placeholder renders instead of an empty hero

- GIVEN no `profile` entry exists
- WHEN `/` renders
- THEN it shows a friendly message inviting the visitor to `/admin`, styled via `TerminalWindow`/`BrutalistButton`, rather than an empty or broken-looking page

#### Scenario: Placeholder does not affect or duplicate the admin first-run redirect

- GIVEN no `profile` entry exists
- WHEN a public visitor loads `/` and, separately, an admin operator requests `/admin/**`
- THEN the visitor sees this public placeholder while the operator is redirected by `admin-authoring`'s existing first-run redirect — two distinct behaviors for two distinct audiences, neither superseding the other

### Requirement: Minimal Public Navigation

`src/presentation/Layout.astro` MUST include exactly three static navigation links — `Home` (`/`), `Posts` (`/posts`), `Projects` (`/projects`) — placed in its `<body>` above `<slot />`. The system MUST NOT add active-route highlighting, a mobile/responsive menu, or any other navigation behavior beyond these three static links.

#### Scenario: Every public page exposes the three nav links

- GIVEN any public page that renders through `Layout.astro`
- WHEN the page loads
- THEN it exposes exactly three navigation links, to `/`, `/posts`, and `/projects`

#### Scenario: No active-state or mobile-menu behavior exists

- GIVEN `Layout.astro`'s navigation markup
- WHEN inspected
- THEN it contains no active-route-highlighting logic and no mobile/responsive menu toggle; any such behavior is out of this requirement's scope and would need its own future spec change
