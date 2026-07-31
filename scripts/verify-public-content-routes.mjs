#!/usr/bin/env node
// Build-time proof for the public-homepage change — see
// openspec/changes/public-homepage/design.md's "Build-time proof script"
// decision: a new sibling script, NOT an extension of
// verify-content-collections.mjs (already near its max-lines: 300 budget).
// Unit 2 (home page rewrite) proved the two home-page profile-presence
// states; Unit 3 (this batch) adds the /posts and /projects listing-route
// filter/sort proof — later phases (detail routes) extend this same script
// further, following the exact pattern verify-profile-export-import.mjs
// established as a new sibling script in profile-wizard.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const PROFILE_DIR = `${rootDir}/src/content/profile`;
const PROFILE_ENTRY_PATH = `${PROFILE_DIR}/me.md`;
const profileDirPreexisted = existsSync(PROFILE_DIR);
const distIndexPath = `${rootDir}/dist/client/index.html`;
const distPostsIndexPath = `${rootDir}/dist/client/posts/index.html`;
const distProjectsIndexPath = `${rootDir}/dist/client/projects/index.html`;

// Detail-route paths for the existing real sample entries (Unit 4) — proves
// the extensionless-slug-to-suffixed-`entry.id` resolution against real
// build output, per the content-listing spec's "Slug Shape Handles the
// .md-Suffix Entry Id" requirement's build-verified half.
const distPostDetailPath = `${rootDir}/dist/client/posts/hello-world/index.html`;
const distProjectDetailPath = `${rootDir}/dist/client/projects/profolio/index.html`;

// Listing-route fixtures — one older-but-visible entry (to prove sort order
// against the existing sample content's date) plus one deleted and one draft
// entry (to prove exclusion), seeded in EACH collection per the
// public-content-visibility spec's "Filter Applied at the /posts Listing"
// and "Filter Applied at the /projects Listing" requirements.
const OLDER_VISIBLE_POST_PATH = `${rootDir}/src/content/posts/public-content-routes-older.md`;
const DELETED_POST_PATH = `${rootDir}/src/content/posts/public-content-routes-deleted.md`;
const DRAFT_POST_PATH = `${rootDir}/src/content/posts/public-content-routes-draft.md`;
const OLDER_VISIBLE_PROJECT_PATH = `${rootDir}/src/content/projects/public-content-routes-older.md`;
const DELETED_PROJECT_PATH = `${rootDir}/src/content/projects/public-content-routes-deleted.md`;
const DRAFT_PROJECT_PATH = `${rootDir}/src/content/projects/public-content-routes-draft.md`;

// Real sample-content titles (hello-world.md / profolio.md), shared across
// the sort-order proof and the real-slug detail-route proof to satisfy
// sonarjs/no-duplicate-string.
const SAMPLE_POST_TITLE = "Hello World";
const SAMPLE_PROJECT_TITLE = "Profolio";
const OLDER_VISIBLE_POST_TITLE = "Older Visible Post Fixture";
const DELETED_POST_TITLE = "Deleted Post Fixture";
const DRAFT_POST_TITLE = "Draft Post Fixture";
const OLDER_VISIBLE_PROJECT_TITLE = "Older Visible Project Fixture";
const DELETED_PROJECT_TITLE = "Deleted Project Fixture";
const DRAFT_PROJECT_TITLE = "Draft Project Fixture";

// Minimal, valid profileSchema frontmatter — same seed shape
// verify-profile-export-import.mjs already uses for its own proofs.
const SAMPLE_PROFILE_MARKDOWN = [
  "---",
  'name: "Ada Lovelace"',
  'role: "Software Engineer"',
  'bio: "Building things with Astro."',
  'email: "ada@example.com"',
  "---",
  "",
].join("\n");

function assertProof(condition, message) {
  if (!condition) {
    throw new Error(`[public-content-routes-proof] FAILED: ${message}`);
  }
}

function cleanAstroBuildState() {
  rmSync(`${rootDir}/.astro`, { recursive: true, force: true });
  rmSync(`${rootDir}/dist`, { recursive: true, force: true });
}

function runAstroBuild() {
  execFileSync("npx", ["astro", "build"], { cwd: rootDir, stdio: "inherit" });
}

function readEmittedIndexHtml() {
  return readFileSync(distIndexPath, "utf-8");
}

function seedProfileEntry() {
  mkdirSync(PROFILE_DIR, { recursive: true });
  writeFileSync(PROFILE_ENTRY_PATH, SAMPLE_PROFILE_MARKDOWN);
}

function removeProfileEntry() {
  rmSync(PROFILE_ENTRY_PATH, { force: true });
  if (!profileDirPreexisted) {
    rmSync(PROFILE_DIR, { recursive: true, force: true });
  }
}

function proveHeroRendersWhenProfileExists() {
  seedProfileEntry();
  try {
    cleanAstroBuildState();
    runAstroBuild();
    const html = readEmittedIndexHtml();
    assertProof(
      html.includes("Ada Lovelace") && html.includes("Software Engineer"),
      `expected the profile hero's name/role in the built index.html, got: ${html}`,
    );
    assertProof(
      !html.includes("No profile yet"),
      "expected the no-profile placeholder copy to be ABSENT when a profile exists",
    );
    console.log(
      "[public-content-routes-proof] home page renders the profile hero when a profile exists — OK",
    );
  } finally {
    removeProfileEntry();
    cleanAstroBuildState();
  }
}

function provePlaceholderRendersWhenNoProfile() {
  // No profile fixture is seeded here — proves the placeholder branch on a
  // genuinely empty `profile` collection, not merely "we didn't check".
  cleanAstroBuildState();
  runAstroBuild();
  const html = readEmittedIndexHtml();
  assertProof(
    html.includes("No profile yet") && html.includes('href="/admin"'),
    `expected the no-profile placeholder copy inviting the visitor to /admin, got: ${html}`,
  );
  assertProof(
    !html.includes("Ada Lovelace"),
    "expected the profile hero's content to be ABSENT when no profile exists",
  );
  console.log(
    "[public-content-routes-proof] home page renders the no-profile placeholder when no profile exists — OK",
  );
  cleanAstroBuildState();
}

// Data-driven fixture table — one row per seeded file, keeps
// `seedListingFixtures()` itself under the repo's `max-lines-per-function`
// budget instead of six near-identical inline `writeFileSync()` calls.
const LISTING_FIXTURES = [
  {
    path: OLDER_VISIBLE_POST_PATH,
    frontmatter: [`title: "${OLDER_VISIBLE_POST_TITLE}"`, "date: 2026-01-01"],
    body: "Older visible post — proves descending date sort against hello-world.md.",
  },
  {
    path: DELETED_POST_PATH,
    frontmatter: [`title: "${DELETED_POST_TITLE}"`, "date: 2026-07-30", "deleted: true"],
    body: "Deleted post fixture — must never appear on /posts.",
  },
  {
    path: DRAFT_POST_PATH,
    frontmatter: [`title: "${DRAFT_POST_TITLE}"`, "date: 2026-07-29", "draft: true"],
    body: "Draft post fixture — must never appear on /posts.",
  },
  {
    path: OLDER_VISIBLE_PROJECT_PATH,
    frontmatter: [
      `name: "${OLDER_VISIBLE_PROJECT_TITLE}"`,
      'link: "https://example.com/older-project"',
      "date: 2026-01-01",
    ],
    body: "Older visible project — proves descending date sort against profolio.md.",
  },
  {
    path: DELETED_PROJECT_PATH,
    frontmatter: [
      `name: "${DELETED_PROJECT_TITLE}"`,
      'link: "https://example.com/deleted-project"',
      "date: 2026-07-30",
      "deleted: true",
    ],
    body: "Deleted project fixture — must never appear on /projects.",
  },
  {
    path: DRAFT_PROJECT_PATH,
    frontmatter: [
      `name: "${DRAFT_PROJECT_TITLE}"`,
      'link: "https://example.com/draft-project"',
      "date: 2026-07-29",
      "draft: true",
    ],
    body: "Draft project fixture — must never appear on /projects.",
  },
];

// Detail-route dist paths for the deleted/draft listing fixtures above —
// `getStaticPaths()` must generate NO path at all for these, not merely
// omit them from a listing. See the public-content-visibility spec's
// "Filter Applied at /posts/[slug]'s getStaticPaths()" and "Filter Applied
// at /projects/[slug]'s getStaticPaths()" requirements.
const EXCLUDED_DETAIL_PATHS = [
  `${rootDir}/dist/client/posts/public-content-routes-deleted/index.html`,
  `${rootDir}/dist/client/posts/public-content-routes-draft/index.html`,
  `${rootDir}/dist/client/projects/public-content-routes-deleted/index.html`,
  `${rootDir}/dist/client/projects/public-content-routes-draft/index.html`,
];

function seedListingFixtures() {
  for (const fixture of LISTING_FIXTURES) {
    writeFileSync(
      fixture.path,
      ["---", ...fixture.frontmatter, "---", "", fixture.body].join("\n"),
    );
  }
}

function removeListingFixtures() {
  for (const path of [
    OLDER_VISIBLE_POST_PATH,
    DELETED_POST_PATH,
    DRAFT_POST_PATH,
    OLDER_VISIBLE_PROJECT_PATH,
    DELETED_PROJECT_PATH,
    DRAFT_PROJECT_PATH,
  ]) {
    rmSync(path, { force: true });
  }
}

// Satisfies content-listing's "Literal Per-Collection Listing Routes" and
// "Date-Descending Listing and Teaser Sort" requirements, and
// public-content-visibility's "Filter Applied at the /posts Listing" /
// "Filter Applied at the /projects Listing" requirements — real astro
// build, real dist/client/**/index.html assertions.
function proveListingRoutesFilterAndSort() {
  seedListingFixtures();
  try {
    cleanAstroBuildState();
    runAstroBuild();
    const postsHtml = readFileSync(distPostsIndexPath, "utf-8");
    const projectsHtml = readFileSync(distProjectsIndexPath, "utf-8");

    assertProof(
      !postsHtml.includes(DELETED_POST_TITLE) && !postsHtml.includes(DRAFT_POST_TITLE),
      `expected /posts to exclude deleted/draft fixtures, got: ${postsHtml}`,
    );
    assertProof(
      !projectsHtml.includes(DELETED_PROJECT_TITLE) &&
        !projectsHtml.includes(DRAFT_PROJECT_TITLE),
      `expected /projects to exclude deleted/draft fixtures, got: ${projectsHtml}`,
    );

    assertProof(
      postsHtml.includes(SAMPLE_POST_TITLE) && postsHtml.includes(OLDER_VISIBLE_POST_TITLE),
      `expected /posts to include both visible entries, got: ${postsHtml}`,
    );
    assertProof(
      postsHtml.indexOf(SAMPLE_POST_TITLE) < postsHtml.indexOf(OLDER_VISIBLE_POST_TITLE),
      "expected /posts to list the newer entry (hello-world.md, 2026-07-27) before the older fixture (2026-01-01)",
    );

    assertProof(
      projectsHtml.includes(SAMPLE_PROJECT_TITLE) &&
        projectsHtml.includes(OLDER_VISIBLE_PROJECT_TITLE),
      `expected /projects to include both visible entries, got: ${projectsHtml}`,
    );
    assertProof(
      projectsHtml.indexOf(SAMPLE_PROJECT_TITLE) < projectsHtml.indexOf(OLDER_VISIBLE_PROJECT_TITLE),
      "expected /projects to list the newer entry (profolio.md, 2026-07-27) before the older fixture (2026-01-01)",
    );

    console.log(
      "[public-content-routes-proof] /posts and /projects filter deleted/draft entries and sort visible entries by date descending — OK",
    );
  } finally {
    removeListingFixtures();
    cleanAstroBuildState();
  }
}

// Satisfies content-listing's "Detail Routes via getStaticPaths()" and
// "Slug Shape Handles the .md-Suffix Entry Id" (build-verified half)
// requirements — real astro build, real extensionless
// dist/client/**/<slug>/index.html assertions against the existing real
// sample entries (hello-world.md / profolio.md), confirming
// getStaticPaths()'s `toSlug(entry.id)` params resolve to real output paths
// and the rendered page carries the correct title/body.
function proveDetailRoutesResolveRealSlug() {
  cleanAstroBuildState();
  runAstroBuild();
  try {
    assertProof(
      existsSync(distPostDetailPath),
      `expected ${distPostDetailPath} to exist for the real "hello-world" post entry`,
    );
    const postHtml = readFileSync(distPostDetailPath, "utf-8");
    assertProof(
      postHtml.includes(SAMPLE_POST_TITLE) &&
        postHtml.includes("First sample post proving"),
      `expected /posts/hello-world to render the entry's title and body, got: ${postHtml}`,
    );

    assertProof(
      existsSync(distProjectDetailPath),
      `expected ${distProjectDetailPath} to exist for the real "profolio" project entry`,
    );
    const projectHtml = readFileSync(distProjectDetailPath, "utf-8");
    assertProof(
      projectHtml.includes(SAMPLE_PROJECT_TITLE) &&
        projectHtml.includes("Git-as-CMS content engine"),
      `expected /projects/profolio to render the entry's title and body, got: ${projectHtml}`,
    );

    console.log(
      "[public-content-routes-proof] /posts/[slug] and /projects/[slug] resolve real .md-suffixed ids to extensionless slugs — OK",
    );
  } finally {
    cleanAstroBuildState();
  }
}

// Satisfies public-content-visibility's "Filter Applied at /posts/[slug]'s
// getStaticPaths()" and "Filter Applied at /projects/[slug]'s
// getStaticPaths()" requirements — confirms getStaticPaths() generates NO
// path whatsoever for deleted/draft entries, not merely that they're
// absent from a listing.
function proveDetailRoutesExcludeDeletedAndDraft() {
  seedListingFixtures();
  try {
    cleanAstroBuildState();
    runAstroBuild();
    for (const excludedPath of EXCLUDED_DETAIL_PATHS) {
      assertProof(
        !existsSync(excludedPath),
        `expected getStaticPaths() to generate NO output at all for a deleted/draft entry, but found: ${excludedPath}`,
      );
    }
    console.log(
      "[public-content-routes-proof] /posts/[slug] and /projects/[slug] generate no path at all for deleted/draft entries — OK",
    );
  } finally {
    removeListingFixtures();
    cleanAstroBuildState();
  }
}

function main() {
  proveHeroRendersWhenProfileExists();
  provePlaceholderRendersWhenNoProfile();
  proveListingRoutesFilterAndSort();
  proveDetailRoutesResolveRealSlug();
  proveDetailRoutesExcludeDeletedAndDraft();
  console.log("[public-content-routes-proof] all public-content-routes proofs passed");
}

main();
