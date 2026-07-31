#!/usr/bin/env node
// Build-time proof for the public-homepage change — see
// openspec/changes/public-homepage/design.md's "Build-time proof script"
// decision: a new sibling script, NOT an extension of
// verify-content-collections.mjs (already near its max-lines: 300 budget).
// This phase (Unit 2 — home page rewrite) only proves the two home-page
// profile-presence states; later phases (listing routes, detail routes)
// extend this same script with their own scenarios, following the exact
// pattern verify-profile-export-import.mjs established as a new sibling
// script in profile-wizard.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const PROFILE_DIR = `${rootDir}/src/content/profile`;
const PROFILE_ENTRY_PATH = `${PROFILE_DIR}/me.md`;
const profileDirPreexisted = existsSync(PROFILE_DIR);
const distIndexPath = `${rootDir}/dist/client/index.html`;

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

function main() {
  proveHeroRendersWhenProfileExists();
  provePlaceholderRendersWhenNoProfile();
  console.log("[public-content-routes-proof] all public-content-routes proofs passed");
}

main();
