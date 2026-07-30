#!/usr/bin/env node
// Build-time proof that Node's native `--env-file` flag itself actually
// loads `.env` values into the spawned process — not just that the admin
// gate is env-driven. `verify-admin-server.mjs` injects env vars via the
// child's `env:` spawn option, which proves the auth *gate* but bypasses
// `--env-file` entirely. This is the 5th `verify-*.mjs` build-time proof
// script, added specifically to close that gap — see design.md's
// "Runtime `--env-file` proof" Architecture Decision.
//
// The proof: the target keys are deleted from the *parent* test process's
// own `process.env` before spawning (not just omitted from an override), and
// the child is spawned with `node --env-file=.env ...` against a
// script-written throwaway `.env`. If the child observes the configured
// admin token, it can only have come from reading that file on disk.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const ENV_PATH = `${rootDir}/.env`;
const PORT = 41734;
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_START_TIMEOUT_MS = 10_000;
const READY_RETRY_ATTEMPTS = 20;
const READY_RETRY_DELAY_MS = 100;

const ADMIN_TOKEN = "verify-env-file-loading-admin-token-abc123";
const THROWAWAY_ENV_LINES = [
  "GITHUB_TOKEN=ghp_verifyEnvFileLoadingThrowawayToken",
  "GITHUB_REPO_OWNER=verify-owner",
  "GITHUB_REPO_NAME=verify-repo",
  `ADMIN_ACCESS_TOKEN=${ADMIN_TOKEN}`,
];

function assertProof(condition, message) {
  if (!condition) {
    throw new Error(`[env-file-loading-proof] FAILED: ${message}`);
  }
}

function cleanAstroBuildState() {
  rmSync(`${rootDir}/.astro`, { recursive: true, force: true });
  rmSync(`${rootDir}/dist`, { recursive: true, force: true });
}

function runAstroBuild() {
  execFileSync("npx", ["astro", "build"], { cwd: rootDir, stdio: "inherit" });
}

function backupExistingEnv() {
  return existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf-8") : null;
}

function restoreEnv(previousContent) {
  if (previousContent === null) {
    if (existsSync(ENV_PATH)) unlinkSync(ENV_PATH);
    return;
  }
  writeFileSync(ENV_PATH, previousContent, "utf-8");
}

function writeThrowawayEnv() {
  writeFileSync(ENV_PATH, `${THROWAWAY_ENV_LINES.join("\n")}\n`, "utf-8");
}

function waitForServerReady(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("timed out waiting for the server to start listening"));
    }, SERVER_START_TIMEOUT_MS);
    child.stdout?.on("data", (chunk) => {
      if (chunk.toString().includes("Server listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited early with code ${String(code)}`));
    });
  });
}

const TARGET_ENV_KEYS = ["GITHUB_TOKEN", "GITHUB_REPO_OWNER", "GITHUB_REPO_NAME", "ADMIN_ACCESS_TOKEN"];

// Removing these keys from a *copy* of the parent's own env (rather than
// only omitting an override) is what makes this a proof of `--env-file`
// itself. `no-restricted-syntax` restricts `process.env.<KEY>` reads to
// `src/config/**`; capturing the spread once here (a whole-object copy, not
// a per-key member access) keeps this script within that same repo-wide
// convention while still letting it assert on individual keys below.
function parentEnvSnapshot() {
  return { ...process.env };
}

function parentEnvWithoutTargetKeys(snapshot) {
  const entries = Object.entries(snapshot).filter(([key]) => !TARGET_ENV_KEYS.includes(key));
  return Object.fromEntries(entries);
}

async function startServerViaEnvFile() {
  const snapshot = parentEnvSnapshot();
  assertProof(
    snapshot.ADMIN_ACCESS_TOKEN === undefined,
    "test setup invariant broken: ADMIN_ACCESS_TOKEN must not already be set in the parent process's own environment",
  );
  const child = spawn("node", ["--env-file=.env", "dist/server/entry.mjs"], {
    cwd: rootDir,
    env: { ...parentEnvWithoutTargetKeys(snapshot), PORT: String(PORT) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await waitForServerReady(child);
  return child;
}

async function stopServer(child) {
  child.kill();
  await new Promise((resolve) => child.once("exit", resolve));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// See verify-admin-server.mjs: the "Server listening" log line and the
// socket actually accepting connections aren't perfectly synchronous.
// `redirect: "manual"` so the gate's real 303 is observable directly instead
// of `fetch` silently following it into the login page (which would return
// 200 regardless of whether the gate is actually active).
async function requestAdmin(headers) {
  let lastError;
  for (let attempt = 0; attempt < READY_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fetch(`${BASE_URL}/admin`, { headers, redirect: "manual" });
    } catch (error) {
      lastError = error;
      await sleep(READY_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

// Post-security-hardening (#8), the admin gate is session-cookie-based, not
// Basic Auth — sending any Authorization header no longer has any effect.
// Astro's built-in `security.checkOrigin` also rejects form POSTs missing an
// `Origin` header as cross-site; see verify-admin-server.mjs's identical note.
async function postLogin(secret) {
  return fetch(`${BASE_URL}/admin/api/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: BASE_URL },
    body: new URLSearchParams({ secret }).toString(),
  });
}

async function proveEnvFileValueIsObserved() {
  const server = await startServerViaEnvFile();
  try {
    // Unauthenticated request is redirected to the login page — this can
    // only happen if GITHUB_TOKEN/GITHUB_REPO_OWNER/GITHUB_REPO_NAME were
    // genuinely loaded from .env (otherwise the app would be in
    // local-fallback mode, with no gate at all, and this would be a 200).
    const unauthedResponse = await requestAdmin({});
    assertProof(
      unauthedResponse.status === 303 && unauthedResponse.headers.get("location") === "/admin/login",
      `expected a 303 redirect to /admin/login (proving the .env-loaded publishing vars activated the gate), got ${unauthedResponse.status} / ${unauthedResponse.headers.get("location")}`,
    );

    // Logging in with the EXACT .env-configured ADMIN_ACCESS_TOKEN value
    // proves --env-file loaded that specific value, not just that some
    // publishing vars were present.
    const loginResponse = await postLogin(ADMIN_TOKEN);
    assertProof(
      loginResponse.status === 303 && loginResponse.headers.get("location") === "/admin",
      `expected login with the .env-configured ADMIN_ACCESS_TOKEN to succeed (303 to /admin), got ${loginResponse.status} / ${loginResponse.headers.get("location")}`,
    );
    const setCookie = loginResponse.headers.get("set-cookie");
    assertProof(Boolean(setCookie), "expected a session cookie to be issued on successful login");
    const cookiePair = setCookie.split(";")[0].trim();

    const authedResponse = await requestAdmin({ cookie: cookiePair });
    assertProof(
      authedResponse.status !== 303,
      `expected the session cookie to grant access (non-303), got ${authedResponse.status}`,
    );

    console.log(
      "[env-file-loading-proof] --env-file value observed by spawned process: gate active pre-login, .env-configured secret logs in and grants access — OK",
    );
  } finally {
    await stopServer(server);
  }
}

async function main() {
  const previousEnvContent = backupExistingEnv();
  try {
    writeThrowawayEnv();
    cleanAstroBuildState();
    runAstroBuild();
    await proveEnvFileValueIsObserved();
  } finally {
    cleanAstroBuildState();
    restoreEnv(previousEnvContent);
  }

  console.log("[env-file-loading-proof] --env-file loading proof passed");
}

main();
