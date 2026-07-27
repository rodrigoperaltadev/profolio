# Proposal: Content-Agnostic Content Model & Schema

Cross-references: GitHub #3 (this change), #4 (publishing pipeline, blocked by #3), #1/#2 (repo-scaffold-ci-foundation, archived — supplies the locked layer boundaries this change must live within).

## Intent

Profolio's scaffold (issues #1-#2) is done, but the repo has zero feature code: no Astro install, no content types, no schema/validation. Issue #3 requires a content model that is provably content-agnostic — the presentation layer must render any content type without hardcoding its shape, so a second, structurally different content type can be added by declaring a schema, not by writing new imperative logic. This is the first real feature-code change in the repo, so it also sets the pattern every later content type (and issue #4's publishing pipeline) will follow.

## Scope

### In Scope
- Install Astro (`astro` dependency, `astro.config.mjs`) — first time Astro is added to this repo
- Two Astro Content Collections for day one, deliberately different shapes:
  - `posts`: title, date, body, tags, draft (boolean, default `false`)
  - `projects`: name, stack, link, date, draft (boolean, default `false`)
- `src/content/config.ts`: `defineCollection` + Zod schema per collection (native Astro Content Collections)
- A thin adapter/mapper in `src/content/**` that converts each collection's Zod-inferred type into one shared generic display shape (the "entry contract")
- The shared generic display shape/type itself (single source of truth for what `src/presentation/**` is allowed to consume)
- Folder-per-collection file layout under `src/content/<collection>/*.md` — this change owns that convention as the path contract issue #4 will write into
- Resolve the known `vitest.config.ts` deviation: switch from plain `defineConfig` to Astro's `getViteConfig()` now that `astro.config.mjs` exists
- Unit tests for the mapper/adapter and schema validation (happy path + validation-failure path), sufficient to hold the 80% coverage gate under strict TDD

### Out of Scope
- Publishing pipeline / GitHub Contents API integration (issue #4)
- Admin UI (issue #5)
- Any page routing, layouts, or actual rendered views beyond what's needed to prove the mapper output is view-agnostic (full page/templating work is presentation-layer scope for a later change, not this one)
- Draft/publish workflow *logic* (the `draft` field exists on both schemas per the resolved question round below, but no filtering/behavior consumes it in this change — that's issue #4's scope)
- Content authoring tooling (CLI scaffolds, admin forms) — none of that exists yet and isn't needed to prove the model

## Capabilities

### New Capabilities
- `content-schema`: per-collection Zod schemas registered via native Astro Content Collections (`src/content/config.ts`), giving compile-time types and build-time validation for `posts` and `projects`
- `content-view-contract`: the shared generic entry shape + the `src/content/**` mapper that produces it from any collection, which is the only contract `src/presentation/**` is allowed to import

### Modified Capabilities
- `ci-quality-gate` (from repo-scaffold-ci-foundation): `vitest.config.ts` changes from plain `defineConfig` to `getViteConfig()` to align with the now-existing `astro.config.mjs`, per the previously-documented deviation

## Approach

Hybrid approach (per exploration): install Astro minimally and lean on native Content Collections for schema/validation rather than hand-rolling a generic registry — this avoids reinventing typed `getCollection`/asset handling and keeps the git-as-CMS file layout Astro-idiomatic. The agnosticism guarantee is enforced structurally, not by convention: `src/content/**` is the only layer allowed to know collection-specific field names (`title`/`date`/`body`/`tags` for posts, `name`/`stack`/`link`/`date` for projects); it maps each into one shared display shape, and `src/presentation/**` only ever imports that shared shape. This satisfies the already-locked `eslint-plugin-boundaries` rule (view → [lib, content]) while making the "no code changes for a new type" claim checkable at the mapper: adding a third collection means adding a `defineCollection` + Zod block and one mapping arm, both pure declaration/data-shape work, not new control flow in the view layer or elsewhere.

`content` file path ownership (folder-per-collection under `src/content/<collection>/`) is fixed by this change; issue #4 is a consumer of that convention, not a co-owner — it writes files into paths this change defines and validates against the Zod schemas this change exports.

## Affected Areas

| Area | Impact | Description |
|------|--------|--------------|
| `package.json`, `astro.config.mjs` | New | First Astro install in the repo |
| `src/content/config.ts` | New | `defineCollection` + Zod schema for `posts` and `projects` |
| `src/content/posts/*.md`, `src/content/projects/*.md` | New | Sample content files proving both shapes |
| `src/content/**` (mapper module) | New | Adapter converting each collection's inferred type → shared display shape |
| `src/lib/**` or `src/content/**` (shared type) | New | The generic entry contract type consumed by `src/presentation/**` |
| `vitest.config.ts` | Modified | `defineConfig` → `getViteConfig()` (resolves documented deviation) |
| `eslint.config.js`, `boundaries` rules | Unchanged | Already enforces the layer/import shape this change must respect |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Astro Content Collections are historically awkward to unit-test outside a full Astro build, risking the 80% coverage gate under strict TDD | Medium | Keep collection config declarative (near-zero branching to cover); concentrate tests on the mapper and schema-validation-failure paths, which are plain TypeScript and trivially testable |
| "No code changes" claim is easy to overstate if the mapper needs a new `case`/branch per collection | Medium | Accepted per locked decision #2: a `defineCollection` + Zod diff, plus a declarative mapping entry, counts as config-alone; document this precisely in spec/design so verify doesn't hold the bar too high |
| `getViteConfig()` migration could surface new Vitest/Astro interaction issues not seen with plain `defineConfig` | Low-Medium | Isolate this as its own task with its own test run before layering content-model work on top |
| A `draft` field exists on both schemas with nothing consuming it yet | Low | Schema-only addition per resolved question round; explicitly no filtering/behavior in this change's scope, avoids scope creep into issue #4's territory |

## Rollback Plan

All changes are additive (new dependency, new config files, new content files, new mapper module) plus one isolated modification (`vitest.config.ts`). Revert by removing `astro.config.mjs`, `src/content/**`, the mapper/shared-type module, and the `astro` dependency, and reverting `vitest.config.ts` and `package.json` via git. No data migration, no deployed behavior affected — no other change has consumed these artifacts yet.

## Dependencies

- Depends on repo-scaffold-ci-foundation (archived) for the layer boundaries, strict TDD, and coverage gate this change must operate inside.
- Blocks issue #4 (publishing pipeline), which will validate against this change's schemas and write into the file paths this change defines.

## Success Criteria

- [ ] `posts` and `projects` collections are defined via `defineCollection` + Zod in `src/content/config.ts`, with at least one valid sample file each
- [ ] A shared generic display-shape type exists, and `src/presentation/**` code (if any is added to prove the point) imports only that type — never `posts`- or `projects`-specific field names
- [ ] Adding a third, differently-shaped collection requires only a new `defineCollection`/Zod block plus a declarative mapping entry — no new control-flow/branching logic in `src/presentation/**` or elsewhere
- [ ] `vitest.config.ts` uses `getViteConfig()` and the full test suite still passes under it
- [ ] `eslint .` passes clean against the existing `boundaries` rules with no exceptions added
- [ ] Coverage gate holds at 80% (lines/functions/branches/statements) with the new content/mapper code included
- [ ] `npm run build` succeeds with Astro installed and both collections present

## Review Workload Forecast

- Estimated changed lines: ~250-400 (Astro install/config, two collection schemas + sample content files, mapper + shared type, vitest.config.ts migration, unit tests for schema validation + mapper). Likely mid-range, not clearly over the 400-line budget but close enough that actual task breakdown could push it over once tests are included.
- Chained PRs: Not obviously required by scope, but plausible if the `vitest.config.ts`/`getViteConfig()` migration surfaces enough friction to warrant isolating it from the content-model/mapper work as a separate PR. Flagging for delivery-strategy planning rather than deciding here.
- Decision needed before apply: Possibly — recommend the orchestrator re-check actual task-level line estimates once `sdd-tasks` breaks this down, and apply the cached `delivery_strategy` if the 400-line/chained-PR risk materializes.

## Proposal question round (resolved)

The exploration's five open questions were already answered by the user and are treated as locked (see decisions 1-4 above; the vitest/Astro question is folded into decision 3). Two smaller product-shaping gaps were confirmed by the user after this proposal was drafted:

1. **Tags taxonomy for `posts`**: confirmed free-form `array(string())`, no controlled vocabulary or minimum/maximum count.
2. **Draft/unpublished state**: confirmed a `draft: boolean` field, defaulting `false`, on BOTH collections (`posts` and `projects`) from day one — nothing consumes it yet (no filtering logic anywhere in this change's scope), but the field exists so issue #4's publishing pipeline has something to filter on later. This is a schema-only addition; it does not pull draft/publish workflow logic into scope.
