#!/usr/bin/env node
// Build-time proof that the admin access gate is actually wired into the
// live request pipeline — not just correct in `checkAdminAuth()`'s unit
// tests. Unit tests prove the auth *logic*; they cannot prove Astro's
// `src/middleware.ts` convention is really invoked for real `/admin/**`
// requests, or that the adapter build produces a runnable
// `dist/server/entry.mjs`. Same genuine build-level proof pattern as
// `verify-content-collections.mjs` / `verify-frontmatter-round-trip.mjs`
// (catching real integration bugs mocks can't reach) — see design.md's
// "Third build-time proof script" Architecture Decision.
//
// Assertions here target gate status codes only: `/admin` still 404s in
// this phase since no admin page exists until a later change — that is
// expected and sufficient to prove the gate itself (Astro's middleware runs
// ahead of route resolution).
import { execFileSync, spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const PORT = 41732;
// The Node adapter binds without an explicit host (defaults to Node's
// dual-stack "::"); on some platforms that accepts "localhost"/"::1"
// connections but refuses explicit "127.0.0.1" — matching the adapter's own
// "Server listening on http://localhost:<port>" log line avoids that gap.
const BASE_URL = `http://localhost:${PORT}`;
const SERVER_START_TIMEOUT_MS = 10_000;

const PUBLISHING_ENV = {
  GITHUB_TOKEN: "fake-verify-token",
  GITHUB_REPO_OWNER: "acme",
  GITHUB_REPO_NAME: "site",
};
const ADMIN_TOKEN = "fake-verify-admin-token";

function cleanAstroBuildState() {
  rmSync(`${rootDir}/.astro`, { recursive: true, force: true });
  rmSync(`${rootDir}/dist`, { recursive: true, force: true });
}

function runAstroBuild() {
  execFileSync("npx", ["astro", "build"], { cwd: rootDir, stdio: "inherit" });
}

function assertProof(condition, message) {
  if (!condition) {
    throw new Error(`[admin-server-proof] FAILED: ${message}`);
  }
}

function basicAuthHeader(password) {
  return `Basic ${Buffer.from(`admin:${password}`, "utf-8").toString("base64")}`;
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

const READY_RETRY_ATTEMPTS = 20;
const READY_RETRY_DELAY_MS = 100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The "Server listening" stdout line and the underlying socket actually
// accepting connections aren't perfectly synchronous — a bare fetch
// immediately after detecting that line intermittently hits ECONNREFUSED.
// Retrying a handful of times with a short delay absorbs that startup race
// without weakening any of the assertions the caller makes on the response.
async function requestAdminPath(headers) {
  let lastError;
  for (let attempt = 0; attempt < READY_RETRY_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(`${BASE_URL}/admin`, { headers });
      return response.status;
    } catch (error) {
      lastError = error;
      await sleep(READY_RETRY_DELAY_MS);
    }
  }
  throw lastError;
}

async function proveLocalFallbackBypass() {
  const server = await startServer({});
  try {
    const status = await requestAdminPath({});
    assertProof(
      status !== 401,
      `expected non-401 (bypass) with no publishing env vars, got ${status}`,
    );
    console.log(
      `[admin-server-proof] local-fallback bypass: no publishing env vars → ${status} (not 401) — OK`,
    );
  } finally {
    await stopServer(server);
  }
}

async function proveFailClosedWithoutToken() {
  const server = await startServer(PUBLISHING_ENV);
  try {
    const status = await requestAdminPath({});
    assertProof(
      status === 401,
      `expected 401 (fail-closed) with publishing env vars set and no ADMIN_ACCESS_TOKEN, got ${status}`,
    );
    console.log(
      "[admin-server-proof] fail-closed: publishing configured, no ADMIN_ACCESS_TOKEN → 401 — OK",
    );
  } finally {
    await stopServer(server);
  }
}

async function proveWrongCredentialsDenied() {
  const server = await startServer({ ...PUBLISHING_ENV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN });
  try {
    const status = await requestAdminPath({ authorization: basicAuthHeader("wrong-token") });
    assertProof(status === 401, `expected 401 with wrong Basic Auth credentials, got ${status}`);
    console.log("[admin-server-proof] wrong Basic Auth credentials → 401 — OK");
  } finally {
    await stopServer(server);
  }
}

async function proveCorrectCredentialsAllowed() {
  const server = await startServer({ ...PUBLISHING_ENV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN });
  try {
    const status = await requestAdminPath({ authorization: basicAuthHeader(ADMIN_TOKEN) });
    assertProof(
      status !== 401,
      `expected non-401 with correct Basic Auth credentials, got ${status}`,
    );
    console.log(
      `[admin-server-proof] correct Basic Auth credentials → ${status} (not 401) — OK`,
    );
  } finally {
    await stopServer(server);
  }
}

async function main() {
  cleanAstroBuildState();
  runAstroBuild();

  try {
    await proveLocalFallbackBypass();
    await proveFailClosedWithoutToken();
    await proveWrongCredentialsDenied();
    await proveCorrectCredentialsAllowed();
  } finally {
    cleanAstroBuildState();
  }

  console.log("[admin-server-proof] all admin access gate proofs passed");
}

main();
