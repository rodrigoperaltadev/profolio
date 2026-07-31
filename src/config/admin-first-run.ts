// Pure predicates for the first-run profile redirect — see design.md's
// "First-run check split" decision and the spec's "First-Run Profile
// Redirect (Both Publishing Modes)" requirement. `src/middleware.ts` is the
// only caller: it owns the actual `getProfile()` call and the redirect
// itself, so this module stays plain-value testable, matching
// `admin-auth.ts`'s existing split between pure logic and Astro glue.
//
// The exempt-path list is intentionally self-contained rather than importing
// `src/middleware.ts`'s own `LOGIN_PATHS` — `src/config/**` is not allowed to
// depend on the app's routing glue file (see design.md's Architecture
// Decisions / boundaries layering), and login paths never actually reach the
// first-run check in `middleware.ts` anyway (they bypass the gate entirely
// before this predicate is ever consulted). Declaring them exempt here too
// keeps this function correct and testable on its own, independent of that
// short-circuit.
const FIRST_RUN_EXEMPT_PATHS = ["/admin/profile/setup", "/admin/login", "/admin/api/login"];

export function isFirstRunExemptPath(pathname: string): boolean {
  return FIRST_RUN_EXEMPT_PATHS.includes(pathname);
}

export function shouldRedirectToProfileSetup(profileExists: boolean): boolean {
  return !profileExists;
}
