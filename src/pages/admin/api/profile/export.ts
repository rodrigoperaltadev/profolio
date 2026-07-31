// GET handler for profile export — see the profile-portability spec's
// "Export Reuses the Existing Build Pipeline" requirement and
// admin-authoring's "Profile Export and Import Routes" requirement's
// "Export downloads the current profile file" scenario. Authentication is
// already enforced by `src/middleware.ts`'s admin gate for every `/admin/**`
// request; this route adds nothing extra on top of it. The response body is
// byte-identical to what `buildMarkdownFile()` produces for a normal
// create/edit write — same frontmatter key order as
// `profileFrontmatterFromFormData()` (task 3.3), so export output always
// matches what a subsequent edit would have written for the same data.
import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { PROFILE_SLUG } from "../../../../content/profile";
import { buildMarkdownFile } from "../../../../publishing/frontmatter";

const EXPORT_FILENAME = "profile.md";

export const GET: APIRoute = async () => {
  // getEntry() id shape gotcha (same as profile.ts/edit.ts): the real id
  // carries ".md" under legacy.collectionsBackwardsCompat.
  const entry = await getEntry("profile", `${PROFILE_SLUG}.md`);
  if (!entry) {
    return new Response("No profile exists yet.", { status: 404 });
  }

  const frontmatter = {
    name: entry.data.name,
    role: entry.data.role,
    bio: entry.data.bio,
    email: entry.data.email,
    links: entry.data.links,
  };
  const file = buildMarkdownFile(frontmatter, entry.body ?? "");

  // A `Headers` instance (not an object literal) — kebab-case header names
  // as object-literal keys trip this repo's
  // `@typescript-eslint/naming-convention` camelCase rule.
  const headers = new Headers();
  headers.set("content-type", "text/markdown; charset=utf-8");
  headers.set("content-disposition", `attachment; filename="${EXPORT_FILENAME}"`);

  return new Response(file, { status: 200, headers });
};
