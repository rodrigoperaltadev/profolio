#!/usr/bin/env node
// Build-time proof that the admin access gate is actually wired into the
// live request pipeline — not just correct in `checkAdminAuth()`'s unit
// tests. Unit tests prove the auth *logic*; they cannot prove Astro's
// `src/middleware.ts` convention is really invoked for real `/admin/**`
// requests, that `/admin/login` + `/admin/api/login` really issue and read a
// session cookie over real HTTP, or that the adapter build produces a
// runnable `dist/server/entry.mjs`. Same genuine build-level proof pattern
// as `verify-content-collections.mjs` / `verify-frontmatter-round-trip.mjs`
// (catching real integration bugs mocks can't reach) — see design.md's
// "Third build-time proof script" Architecture Decision.
//
// Phase 3 replaces every Basic-Auth-header request with the real
// login → cookie → protected-request flow (see design.md's Data Flow) and
// adds the per-client lockout proof. The old Basic Auth mechanism no longer
// authenticates at all — `proveOldBasicAuthMechanismIsDead()` below asserts
// that directly, as a build-time complement to the manual `curl -u` check
// against a real running server (see tasks.md 3.6).
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
// Same-request-count contract as `src/config/admin-lockout.ts`'s
// LOCKOUT_THRESHOLD (5 failed attempts locks the 6th out within the window).
const LOCKOUT_THRESHOLD = 5;
const LOGIN_PATH = "/admin/login";
const SET_COOKIE_HEADER = "set-cookie";

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

// `redirect: "manual"` so the gate's real 303 (and its `Location`) is
// observable directly, instead of silently following it into whatever page
// it points at.
async function requestAdmin(headers) {
  return fetchWithRetry(`${BASE_URL}/admin`, { headers, redirect: "manual" });
}

async function postLogin(secret) {
  // Astro's built-in `security.checkOrigin` (default: on for server output)
  // rejects same-origin-looking form POSTs whose `Origin` header doesn't
  // match the request URL — a real browser sets this automatically, so a
  // form-content-type request without it is treated as a forbidden
  // cross-site submission (403). This script simulates that browser header.
  return fetchWithRetry(`${BASE_URL}/admin/api/login`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: BASE_URL,
    },
    body: new URLSearchParams({ secret }).toString(),
  });
}

// Extracts just the `name=value` pair from a `Set-Cookie` header, dropping
// attributes (`Path`, `HttpOnly`, etc.) — that's the form a real client
// sends back on the next request.
function cookiePairFromSetCookie(setCookieHeader) {
  return setCookieHeader.split(";")[0].trim();
}

async function proveLocalFallbackBypass() {
  const server = await startServer({});
  try {
    const response = await requestAdmin({});
    assertProof(
      response.status !== 401 && response.status !== 303,
      `expected no gate (no redirect, no 401) with no publishing env vars, got ${response.status}`,
    );
    console.log(
      `[admin-server-proof] local-fallback bypass: no publishing env vars → ${response.status} (no gate) — OK`,
    );
  } finally {
    await stopServer(server);
  }
}

async function proveFailClosedWithoutToken() {
  const server = await startServer(PUBLISHING_ENV);
  try {
    const response = await requestAdmin({});
    assertProof(
      response.status === 303 && response.headers.get("location") === LOGIN_PATH,
      `expected a 303 redirect to ${LOGIN_PATH} (fail-closed) with publishing env vars set and no ADMIN_ACCESS_TOKEN, got ${response.status} / ${response.headers.get("location")}`,
    );
    console.log(
      `[admin-server-proof] fail-closed: publishing configured, no ADMIN_ACCESS_TOKEN → 303 → ${LOGIN_PATH} — OK`,
    );
  } finally {
    await stopServer(server);
  }
}

// (a) Real login → cookie → protected-request flow.
async function proveLoginIssuesSessionThatUnlocksAdmin() {
  const server = await startServer({ ...PUBLISHING_ENV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN });
  try {
    const loginResponse = await postLogin(ADMIN_TOKEN);
    assertProof(
      loginResponse.status === 303 && loginResponse.headers.get("location") === "/admin",
      `expected correct-secret login to redirect (303) to /admin, got ${loginResponse.status} / ${loginResponse.headers.get("location")}`,
    );
    const setCookie = loginResponse.headers.get(SET_COOKIE_HEADER);
    assertProof(setCookie !== null, "expected a Set-Cookie header on successful login, got none");
    console.log(`[admin-server-proof] correct secret → 303 → /admin, Set-Cookie present — OK`);

    const cookie = cookiePairFromSetCookie(setCookie);
    const protectedResponse = await requestAdmin({ cookie });
    assertProof(
      protectedResponse.status !== 401 && protectedResponse.status !== 303,
      `expected the issued session cookie to grant access to /admin, got ${protectedResponse.status}`,
    );
    console.log(
      `[admin-server-proof] session cookie on next request → ${protectedResponse.status} (allowed) — OK`,
    );
  } finally {
    await stopServer(server);
  }
}

// (b) 5x wrong secret from the same simulated client (all requests in this
// script share one real client address, the local Node process), then the
// 6th attempt — even with the CORRECT secret — must still be denied. That's
// the observable proof that lockout short-circuits before the secret is
// evaluated at all, not just that wrong secrets keep failing.
async function proveLockoutAfterFiveFailedAttempts() {
  const server = await startServer({ ...PUBLISHING_ENV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN });
  try {
    for (let attempt = 1; attempt <= LOCKOUT_THRESHOLD; attempt++) {
      const response = await postLogin("wrong-secret");
      assertProof(
        response.status === 303 && response.headers.get("location")?.startsWith(LOGIN_PATH),
        `expected wrong-secret attempt ${attempt} to redirect back to ${LOGIN_PATH}, got ${response.status} / ${response.headers.get("location")}`,
      );
    }
    console.log(
      `[admin-server-proof] ${LOCKOUT_THRESHOLD} wrong-secret attempts recorded — OK`,
    );

    const sixthAttempt = await postLogin(ADMIN_TOKEN); // correct secret, still locked out
    assertProof(
      sixthAttempt.status === 303 &&
        sixthAttempt.headers.get("location")?.startsWith(LOGIN_PATH) &&
        sixthAttempt.headers.get(SET_COOKIE_HEADER) === null,
      `expected the 6th attempt (correct secret) to be denied by lockout without issuing a session, got ${sixthAttempt.status} / set-cookie=${sixthAttempt.headers.get(SET_COOKIE_HEADER)}`,
    );
    console.log(
      "[admin-server-proof] lockout: 6th attempt denied even with the correct secret (secret never evaluated) — OK",
    );
  } finally {
    await stopServer(server);
  }
}

// Complements the manual `curl -u admin:<token>` check (tasks.md 3.6): the
// old Basic Auth header must not authenticate anymore, not even as an
// accidental fallback alongside the new session cookie.
async function proveOldBasicAuthMechanismIsDead() {
  const server = await startServer({ ...PUBLISHING_ENV, ADMIN_ACCESS_TOKEN: ADMIN_TOKEN });
  try {
    const response = await requestAdmin({ authorization: basicAuthHeader(ADMIN_TOKEN) });
    assertProof(
      response.status === 303 && response.headers.get("location") === LOGIN_PATH,
      `expected a valid-looking Basic Auth header to be ignored entirely (redirect to ${LOGIN_PATH}), got ${response.status}`,
    );
    console.log(
      `[admin-server-proof] old Basic Auth header no longer authenticates → 303 → ${LOGIN_PATH} — OK`,
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
    await proveLoginIssuesSessionThatUnlocksAdmin();
    await proveLockoutAfterFiveFailedAttempts();
    await proveOldBasicAuthMechanismIsDead();
  } finally {
    cleanAstroBuildState();
  }

  console.log("[admin-server-proof] all admin access gate proofs passed");
}

main();
