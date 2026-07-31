// POST handler for profile setup — see admin-authoring's "Profile Setup and
// Edit Routes" requirement's "Setup form creates the profile" scenario.
// Always targets collection "profile", slug "me" — the request never
// supplies a slug (profile-identity spec's "Fixed Slug Singleton
// Convention" requirement). Validation happens inside
// ContentWriter.create() (parseFrontmatter() runs before any fs/GitHub
// write), so an invalid submission never reaches disk/the API — same
// "validation-before-write" posture as the generic create.ts.
import type { APIRoute } from "astro";
import { createContentWriter } from "../../../../config/content-writer-factory";
import { PROFILE_SLUG } from "../../../../content/profile";
import { profileFrontmatterFromFormData } from "../../_lib/profile-form-fields";
import { writeErrorMessage } from "../../_lib/write-error-message";

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();

  const result = await createContentWriter().create({
    collection: "profile",
    slug: PROFILE_SLUG,
    frontmatter: profileFrontmatterFromFormData(formData),
    body: "",
    commitMessage: "content: set up profile",
  });

  if (!result.ok) {
    const message = encodeURIComponent(writeErrorMessage(result.error));
    return redirect(`/admin/profile/setup?error=${message}`, 303);
  }
  return redirect("/admin?profile-created=1", 303);
};
