# profolio

A reusable, themeable content/blog engine. Content is authored and published via git commits (git-as-CMS) — clone it, configure it, and deploy it for your own site.

## Vision

Clone this repo, run the setup wizard, fill in your own profile, pick a theme, and deploy — end up with a personal site/blog like [rodrigoperalta.ar](https://rodrigoperalta.ar). profolio is not a hosting platform or a SaaS: there is no shared backend and no cross-site accounts. You own your clone, your git history, and your content.

Your content (profile, posts, projects) lives as plain files in your own repo — a hand-maintained, always-current source of truth, closer to a living CV than a database record. Themes are swappable presets, not baked-in styling, so your site's look is a config choice, not a fork you have to maintain.

## Stack

Astro.

## Status

Early stage — architecture and requirements are being defined before feature work starts. See [`HANDOFF.md`](./HANDOFF.md) for project origin, design constraints, and the suggested build order.

## Setup

Requires **Node ≥20.6** (CI is pinned to Node 22) — this is the minimum version that supports Node's native `--env-file` flag, which `dev` and `start` rely on.

1. Run the interactive setup wizard to create a local `.env`:

   ```bash
   npm run setup
   ```

   The wizard prompts for optional GitHub publishing configuration (`GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_REPO_NAME`, `GITHUB_CONTENT_BRANCH`), an `ADMIN_ACCESS_TOKEN` (generate or supply your own), and the `THEME_PRESET`. It is safe to re-run — existing values are shown masked and can be kept or replaced individually, and unrelated keys already in `.env` are left untouched. `.env` is git-ignored and never committed.

2. Start the dev server:

   ```bash
   npm run dev
   ```

3. Or build and run the production entry point:

   ```bash
   npm run build
   npm run start
   ```

Both `npm run dev` and `npm run start` load `.env` automatically via `node --env-file=.env` — no extra tooling or `dotenv` dependency is required. On Node <20.6, this fails fast with `node: bad option: --env-file`.

## Origin

Spun off from a personal portfolio project's planning session, to build a standalone engine instead of mutating that project in place. Takes inspiration from a working git-as-CMS pattern proven in a live client project, without repeating its shortcuts (hardcoded content domain, no tests, high setup friction).
