// POST handler for "wipe and start over" — see the profile-identity spec's
// "Reset via Edit, No New Port Method" requirement. Calls the existing
// `ContentWriter.edit()` with every profile field reset to empty/default;
// no new port method (no delete, no exists) is introduced, and the entry
// continues to exist at slug "me" rather than being removed.
import type { APIRoute } from "astro";
import { createContentWriter } from "../../../../config/content-writer-factory";
import { PROFILE_SLUG } from "../../../../content/profile";
import { writeErrorMessage } from "../../_lib/write-error-message";

const BLANK_PROFILE_FRONTMATTER: Record<string, unknown> = {
  name: "",
  role: "",
  bio: "",
  email: "",
  links: [],
};

export const POST: APIRoute = async ({ redirect }) => {
  const result = await createContentWriter().edit({
    collection: "profile",
    slug: PROFILE_SLUG,
    frontmatter: BLANK_PROFILE_FRONTMATTER,
    body: "",
    commitMessage: "content: reset profile",
  });

  if (!result.ok) {
    const message = encodeURIComponent(writeErrorMessage(result.error));
    return redirect(`/admin/profile/edit?error=${message}`, 303);
  }
  return redirect("/admin?profile-reset=1", 303);
};
