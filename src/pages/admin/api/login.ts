// POST handler for /admin/login's form — see the spec's "Admin Login Route",
// "Session Issuance and Cookie Attributes", and "Failed-Attempt Lockout
// (Per-Client)" requirements, and design.md's Data Flow: lockout check first
// (denied without evaluating the secret), then the timing-safe secret check,
// then session issuance + cookie set on success.
import type { APIContext, APIRoute } from "astro";
import { timingSafeStringEqual } from "../../../config/admin-auth";
import { loadAdminAccessToken } from "../../../config/publishing-config";
import {
  issueSession,
  sessionStore,
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "../../../config/admin-session";
import { isLockedOut, recordFailedAttempt, clearLockout, lockoutStore } from "../../../config/admin-lockout";

const LOGIN_ERROR_MESSAGE = "Incorrect secret, or too many attempts. Try again later.";

function denyWithError(redirect: APIContext["redirect"]): Response {
  return redirect(`/admin/login?error=${encodeURIComponent(LOGIN_ERROR_MESSAGE)}`, 303);
}

export const POST: APIRoute = async ({ request, cookies, redirect, clientAddress }) => {
  // Keyed per client address, not a single global counter — see the spec's
  // "Failed-Attempt Lockout (Per-Client)" requirement.
  if (isLockedOut(lockoutStore, clientAddress)) {
    return denyWithError(redirect);
  }

  const formData = await request.formData();
  const secretValue = formData.get("secret");
  const secret = typeof secretValue === "string" ? secretValue : "";
  const expectedToken = loadAdminAccessToken();

  // No expectedToken means misconfiguration — fail closed the same as a
  // wrong secret, rather than leaking which case occurred.
  if (!expectedToken || !timingSafeStringEqual(secret, expectedToken)) {
    recordFailedAttempt(lockoutStore, clientAddress);
    return denyWithError(redirect);
  }

  clearLockout(lockoutStore, clientAddress);
  const token = issueSession(sessionStore);
  cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/admin",
    maxAge: SESSION_TTL_MS / 1000,
  });
  return redirect("/admin", 303);
};
