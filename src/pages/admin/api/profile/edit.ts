// POST handler for profile editing — see admin-authoring's "Profile Setup
// and Edit Routes" requirement's "Edit form updates the profile" scenario.
// Always targets collection "profile", slug "me". Unlike the generic
// edit.ts, this route never re-fetches the existing entry first: profile's
// schema has no `deleted` (or any other) field that must be carried forward
// untouched by a regular save — every field on the form is the full set of
// fields the schema defines.
import type { APIRoute } from "astro";
import { createContentWriter } from "../../../../config/content-writer-factory";
import { PROFILE_SLUG } from "../../../../content/profile";
import { profileFrontmatterFromFormData } from "../../_lib/profile-form-fields";
import { writeErrorMessage } from "../../_lib/write-error-message";

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const result = await createContentWriter().edit({
    collection: "profile",
    slug: PROFILE_SLUG,
    frontmatter: profileFrontmatterFromFormData(formData),
    body: "",
    commitMessage: "content: update profile",
  });

  if (!result.ok) {
    const message = encodeURIComponent(writeErrorMessage(result.error));
    return redirect(`/admin/profile/edit?error=${message}`, 303);
  }
  // Deploy-lag disclosure (GitHub mode) vs. the existing commit reminder
  // (local-fallback mode) — see admin-authoring's "Build/Deploy Detection
  // Lag Disclosure" requirement. Both messages are rendered by
  // `admin/index.astro` off this one `profile-updated` query param, the
  // same "redirect with a status query param" precedent posts/projects
  // already use for `created`/`updated`/`deleted`.
  return redirect("/admin?profile-updated=1", 303);
};
