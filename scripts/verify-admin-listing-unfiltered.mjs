#!/usr/bin/env node
// public-homepage Unit 4 admin-unaffected re-check — a new sibling script,
// NOT an extension of verify-admin-server.mjs (already at its max-lines:
// 300 budget), following the same precedent design.md's "Build-time proof
// script" decision set for verify-public-content-routes.mjs. Proves the
// public-content-visibility spec's "Admin Reads Remain Unfiltered"
// requirement: /admin's listing must keep showing deleted/draft entries
// that the public build-time proof (verify-public-content-routes.mjs)
// excludes — confirming the two read paths genuinely diverge as designed,
// not silently coupled. Local-fallback mode (no publishing env vars, no
// ADMIN_ACCESS_TOKEN) is used deliberately: verify-admin-server.mjs's own
// proveLocalFallbackBypass() already establishes that mode reaches /admin
// with no auth-gate challenge, so this script can assert purely on listing
// content without re-deriving the login/cookie flow.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const PORT = 41733;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_START_TIMEOUT_MS = 10_000;

// A profile must exist, or profile-wizard's first-run redirect sends every
// /admin GET to /admin/profile/setup before the listing is ever rendered —
// same minimal fixture verify-admin-server.mjs already uses.
const PROFILE_DIR = `${rootDir}/src/content/profile`;
const PROFILE_ENTRY_PATH = `${PROFILE_DIR}/me.md`;
const profileDirPreexisted = existsSync(PROFILE_DIR);
const SAMPLE_PROFILE_MARKDOWN = [
  "---",
  'name: "Ada Lovelace"',
  'role: "Software Engineer"',
  'bio: "Building things with Astro."',
  'email: "ada@example.com"',
  "---",
  "",
].join("\n");

const DELETED_POST_PATH = `${rootDir}/src/content/posts/admin-listing-deleted.md`;
const DRAFT_POST_PATH = `${rootDir}/src/content/posts/admin-listing-draft.md`;
const DELETED_PROJECT_PATH = `${rootDir}/src/content/projects/admin-listing-deleted.md`;
const DRAFT_PROJECT_PATH = `${rootDir}/src/content/projects/admin-listing-draft.md`;
const DELETED_POST_TITLE = "Admin Listing Deleted Post Fixture";
const DRAFT_POST_TITLE = "Admin Listing Draft Post Fixture";
const DELETED_PROJECT_TITLE = "Admin Listing Deleted Project Fixture";
const DRAFT_PROJECT_TITLE = "Admin Listing Draft Project Fixture";

const FIXTURES = [
  { path: DELETED_POST_PATH, frontmatter: [`title: "${DELETED_POST_TITLE}"`, "date: 2026-07-30", "deleted: true"] },
  { path: DRAFT_POST_PATH, frontmatter: [`title: "${DRAFT_POST_TITLE}"`, "date: 2026-07-29", "draft: true"] },
  {
    path: DELETED_PROJECT_PATH,
    frontmatter: [
      `name: "${DELETED_PROJECT_TITLE}"`,
      'link: "https://example.com/admin-listing-deleted"',
      "date: 2026-07-30",
      "deleted: true",
    ],
  },
  {
    path: DRAFT_PROJECT_PATH,
    frontmatter: [
      `name: "${DRAFT_PROJECT_TITLE}"`,
      'link: "https://example.com/admin-listing-draft"',
      "date: 2026-07-29",
      "draft: true",
    ],
  },
];

function assertProof(condition, message) {
  if (!condition) {
    throw new Error(`[admin-listing-unfiltered-proof] FAILED: ${message}`);
  }
}

function cleanAstroBuildState() {
  rmSync(`${rootDir}/.astro`, { recursive: true, force: true });
  rmSync(`${rootDir}/dist`, { recursive: true, force: true });
}

function runAstroBuild() {
  execFileSync("npx", ["astro", "build"], { cwd: rootDir, stdio: "inherit" });
}

function seedFixtures() {
  for (const fixture of FIXTURES) {
    writeFileSync(fixture.path, ["---", ...fixture.frontmatter, "---", "", "Fixture body."].join("\n"));
  }
}

function removeFixtures() {
  for (const fixture of FIXTURES) {
    rmSync(fixture.path, { force: true });
  }
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

function waitForServerReady(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timed out waiting for the admin server to start listening"));
    }, SERVER_START_TIMEOUT_MS);
    child.stdout?.on("data", (chunk) => {
      if (chunk.toString().includes("Server listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`admin server exited early with code ${String(code)}`));
    });
  });
}

async function startServer() {
  const child = spawn("node", ["dist/server/entry.mjs"], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await waitForServerReady(child);
  return child;
}

async function stopServer(child) {
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

const READY_RETRY_ATTEMPTS = 20;
const READY_RETRY_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAdminWithRetry() {
  let lastError;
  for (let attempt = 0; attempt < READY_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    } catch (error) {
      lastError = error;
      await sleep(READY_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

async function proveAdminListingShowsDeletedAndDraftEntries() {
  seedFixtures();
  seedProfileEntry();
  try {
    cleanAstroBuildState();
    runAstroBuild();
    const server = await startServer();
    try {
      const response = await fetchAdminWithRetry();
      const html = await response.text();
      assertProof(
        html.includes(DELETED_POST_TITLE) &&
          html.includes(DRAFT_POST_TITLE) &&
          html.includes(DELETED_PROJECT_TITLE) &&
          html.includes(DRAFT_PROJECT_TITLE),
        `expected /admin's listing to still show deleted/draft entries the public build excludes, got: ${html}`,
      );
      console.log(
        "[admin-listing-unfiltered-proof] /admin listing still shows deleted/draft entries the public routes exclude — OK",
      );
    } finally {
      await stopServer(server);
    }
  } finally {
    removeFixtures();
    removeProfileEntry();
    cleanAstroBuildState();
  }
}

async function main() {
  await proveAdminListingShowsDeletedAndDraftEntries();
  console.log("[admin-listing-unfiltered-proof] admin-unaffected re-check passed");
}

main();
