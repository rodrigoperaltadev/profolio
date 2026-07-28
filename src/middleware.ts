// Thin Astro glue only — all branching logic lives in the pure, unit-tested
// `checkAdminAuth()`. `astro:middleware` runtime isn't easily unit-tested in
// isolation, so this file is deliberately kept small and is proven correct by
// `scripts/verify-admin-server.mjs` (real build + real server + real HTTP
// requests) instead of a dedicated Vitest suite. See design.md's
// "Auth-gate testability" decision.
import { defineMiddleware } from "astro:middleware";
import { checkAdminAuth } from "./config/admin-auth";
import { isPublishingConfigured, loadAdminAccessToken } from "./config/publishing-config";

export const onRequest = defineMiddleware((context, next) => {
  if (!context.url.pathname.startsWith("/admin")) return next();
  const result = checkAdminAuth(context.request, {
    isConfigured: isPublishingConfigured(),
    expectedToken: loadAdminAccessToken(),
  });
  if (!result.allowed) {
    // Built via `Headers.set()` (not an object literal) so the HTTP
    // "WWW-Authenticate" header name — a hyphenated wire-format string, not
    // a JS identifier — doesn't trip `@typescript-eslint/naming-convention`.
    const headers = new Headers();
    if (result.wwwAuthenticate) headers.set("WWW-Authenticate", result.wwwAuthenticate);
    return new Response("Unauthorized", { status: result.status, headers });
  }
  return next();
});
