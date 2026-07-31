#!/usr/bin/env node
// Build-time proof that the REAL export → re-import → export path (profile-
// wizard change, tasks 5.4/5.5) reproduces an identical profile — not just
// `parseFrontmatterBlock()` in isolation (already proven against
// `buildMarkdownFile()` directly by task 4.3's Vitest suite). This needs a
// real running server/adapter because the routes under test
// (`/admin/api/profile/{export,import}.ts`) are Astro API routes; a
// dedicated file keeps `verify-admin-server.mjs` under this repo's
// `max-lines: 300` ESLint budget instead of growing that file further — same
// "extend ... or a sibling script" allowance tasks.md's 5.5 leaves open.
//
// Also proves the "content is computed at build time" constraint documented
// in `verify-admin-server.mjs`'s `proveFirstRunRedirectStopsOnceProfileExists()`:
// the import route's write only becomes visible to `getEntry()` after a
// fresh `astro build`, so this proof rebuilds between the import POST and
// the re-export GET.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const PORT = 41733; // distinct port from verify-admin-server.mjs's 41732
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_START_TIMEOUT_MS = 10_000;
const READY_RETRY_ATTEMPTS = 20;
const READY_RETRY_DELAY_MS = 100;

const EXPORT_PATH = "/admin/api/profile/export";
const IMPORT_PATH = "/admin/api/profile/import";
const PROFILE_DIR = `${rootDir}/src/content/profile`;
const PROFILE_ENTRY_PATH = `${PROFILE_DIR}/me.md`;
const profileDirPreexisted = existsSync(PROFILE_DIR);

// Minimal, valid `profileSchema` frontmatter — `links` uses its schema
// default (`[]`) by omission, same seed shape `verify-admin-server.mjs`
// already uses for its own first-run-redirect proofs.
const SAMPLE_PROFILE_MARKDOWN = [
  "---",
  'name: "Ada Lovelace"',
  'role: "Software Engineer"',
  'bio: "Building things with Astro."',
  'email: "ada@example.com"',
  "---",
  "",
].join("\n");

function cleanAstroBuildState() {
  rmSync(`${rootDir}/.astro`, { recursive: true, force: true });
  rmSync(`${rootDir}/dist`, { recursive: true, force: true });
}

function runAstroBuild() {
  execFileSync("npx", ["astro", "build"], { cwd: rootDir, stdio: "inherit" });
}

function assertProof(condition, message) {
  if (!condition) {
    throw new Error(`[profile-export-import-proof] FAILED: ${message}`);
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function startServer(envOverrides) {
  const child = spawn("node", ["dist/server/entry.mjs"], {
    cwd: rootDir,
    env: { ...process.env, ...envOverrides, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await waitForServerReady(child);
  return child;
}

async function stopServer(child) {
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

// Same startup-race rationale as `verify-admin-server.mjs`'s own
// `fetchWithRetry()`: the "Server listening" stdout line and the socket
// actually accepting connections aren't perfectly synchronous.
async function fetchWithRetry(url, options) {
  let lastError;
  for (let attempt = 0; attempt < READY_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetch(url, options);
    } catch (error) {
      lastError = error;
      await sleep(READY_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

// No auth headers are needed: this proof runs in local-fallback mode (no
// publishing env vars), where `checkAdminAuth()` bypasses the gate entirely
// — same mode `verify-admin-server.mjs`'s `proveLocalFallbackBypass()`
// exercises. `redirect: "manual"` surfaces the real 303/200 directly.
async function getExportedProfile() {
  const response = await fetchWithRetry(`${BASE_URL}${EXPORT_PATH}`, {
    redirect: "manual",
  });
  assertProof(
    response.status === 200,
    `expected ${EXPORT_PATH} to return 200 for an existing profile, got ${response.status}`,
  );
  assertProof(
    response.headers.get("content-disposition")?.includes("attachment"),
    `expected ${EXPORT_PATH} to respond with a Content-Disposition: attachment header, got ${response.headers.get("content-disposition")}`,
  );
  return response.text();
}

async function postImportedFile(fileText) {
  const formData = new FormData();
  formData.set("file", new Blob([fileText], { type: "text/markdown" }), "profile.md");
  return fetchWithRetry(`${BASE_URL}${IMPORT_PATH}`, {
    method: "POST",
    redirect: "manual",
    headers: { origin: BASE_URL },
    body: formData,
  });
}

async function proveExportImportRoundTrip() {
  seedProfileEntry();
  try {
    cleanAstroBuildState();
    runAstroBuild();
    let server = await startServer({});
    let originalExport;
    try {
      originalExport = await getExportedProfile();
      assertProof(
        originalExport.includes('name: "Ada Lovelace"'),
        `expected the exported file to contain the seeded profile's data, got: ${originalExport}`,
      );
      const importResponse = await postImportedFile(originalExport);
      assertProof(
        importResponse.status === 303 &&
          !importResponse.headers.get("location")?.includes("error"),
        `expected re-uploading the exact downloaded file to ${IMPORT_PATH} to succeed (303, no error param), got ${importResponse.status} / ${importResponse.headers.get("location")}`,
      );
      console.log(
        `[profile-export-import-proof] download via ${EXPORT_PATH}, re-upload the exact file via ${IMPORT_PATH} → accepted — OK`,
      );
    } finally {
      await stopServer(server);
    }

    // Rebuild so the import route's real `ContentWriter.edit()` write is
    // reflected in the next server's content store, then re-export and
    // compare against the original download.
    cleanAstroBuildState();
    runAstroBuild();
    server = await startServer({});
    try {
      const reExported = await getExportedProfile();
      assertProof(
        reExported === originalExport,
        `expected the re-exported profile after import to be byte-identical to the original download, got:\n--- original ---\n${originalExport}\n--- re-exported ---\n${reExported}`,
      );
      console.log(
        "[profile-export-import-proof] export → re-import → export round trip: byte-identical to the original download — OK",
      );
    } finally {
      await stopServer(server);
    }
  } finally {
    removeProfileEntry();
    cleanAstroBuildState();
  }
}

async function main() {
  await proveExportImportRoundTrip();
  console.log("[profile-export-import-proof] all profile export/import proofs passed");
}

main();
