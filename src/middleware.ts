// Thin Astro glue only — all branching logic lives in the pure, unit-tested
// `checkAdminAuth()`. `astro:middleware` runtime isn't easily unit-tested in
// isolation, so this file is deliberately kept small and is proven correct by
// `scripts/verify-admin-server.mjs` (real build + real server + real HTTP
// requests) instead of a dedicated Vitest suite. See design.md's
// "Auth-gate testability" decision.
import { defineMiddleware } from "astro:middleware";
import { checkAdminAuth } from "./config/admin-auth";
import { isPublishingConfigured, loadAdminAccessToken } from "./config/publishing-config";
import { SESSION_COOKIE_NAME, sessionStore } from "./config/admin-session";

// The login page and its POST endpoint must be reachable before a session
// exists, so they bypass the gate entirely — see design.md's Data Flow.
const LOGIN_PATHS = ["/admin/login", "/admin/api/login"];

export const onRequest = defineMiddleware((context, next) => {
  if (!context.url.pathname.startsWith("/admin")) return next();
  if (LOGIN_PATHS.includes(context.url.pathname)) return next();
  const sessionToken = context.cookies.get(SESSION_COOKIE_NAME)?.value;
  const result = checkAdminAuth(
    sessionToken,
    { isConfigured: isPublishingConfigured(), expectedToken: loadAdminAccessToken() },
    sessionStore,
  );
  if (!result.allowed) {
    // No login route exists to redirect to yet for non-GET requests (e.g. an
    // API call without a valid session) — those still fail closed with 401.
    // GET requests get a real page to land on, per design.md's "Redirect vs.
    // 401" decision.
    if (context.request.method === "GET") return context.redirect("/admin/login", 303);
    return new Response("Unauthorized", { status: 401 });
  }
  return next();
});
