// POST handler for profile import — see the profile-portability spec's
// "Import Runs Through the Same Validation-Before-Write Path as a Normal
// Edit" requirement and admin-authoring's "Profile Export and Import
// Routes" requirement's "Import writes a valid uploaded file" /
// "Import rejects an invalid uploaded file before writing" scenarios.
// Pipeline: request.formData() → file.text() → parseFrontmatterBlock() →
// parseFrontmatter("profile", ...) → ContentWriter.create()/.edit() — the
// exact same validation-before-write gate a normal profile edit goes
// through, just sourced from an uploaded file's text instead of a form
// (design.md's Data Flow). No new `ContentWriter` port method is used:
// `edit()` when a profile already exists, `create()` on the very first
// import (mirrors the setup-vs-edit choice already made by the two
// dedicated routes this pipeline stands in for).
import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { createContentWriter } from "../../../../config/content-writer-factory";
import { PROFILE_SLUG } from "../../../../content/profile";
import { writeErrorMessage } from "../../_lib/write-error-message";
import { parseFrontmatter } from "../../../../publishing/parse-frontmatter";
import { parseFrontmatterBlock } from "../../../../publishing/parse-frontmatter-block";

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    const message = encodeURIComponent("No file was uploaded.");
    return redirect(`/admin/profile/edit?error=${message}`, 303);
  }

  const rawText = await file.text();
  const parsedBlock = parseFrontmatterBlock(rawText);
  if (!parsedBlock.ok) {
    const message = encodeURIComponent(`Invalid profile file: ${parsedBlock.error}`);
    return redirect(`/admin/profile/edit?error=${message}`, 303);
  }

  const validated = parseFrontmatter("profile", parsedBlock.data.frontmatter);
  if (!validated.ok) {
    // `validated.error` is `ParseResult`'s plain string (Zod's message), not
    // a `WriteError` — `writeErrorMessage()` only maps the latter, so this
    // mirrors its "validation" case format directly instead of calling it.
    const message = encodeURIComponent(`Invalid entry: ${validated.error}`);
    return redirect(`/admin/profile/edit?error=${message}`, 303);
  }

  // getEntry() id shape gotcha (same as profile.ts/edit.ts): the real id
  // carries ".md" under legacy.collectionsBackwardsCompat.
  const existing = await getEntry("profile", `${PROFILE_SLUG}.md`);
  const writer = createContentWriter();
  const writeInput = {
    collection: "profile" as const,
    slug: PROFILE_SLUG,
    frontmatter: validated.data,
    body: parsedBlock.data.body,
    commitMessage: existing ? "content: import profile (update)" : "content: import profile (create)",
  };
  const result = existing ? await writer.edit(writeInput) : await writer.create(writeInput);

  if (!result.ok) {
    const message = encodeURIComponent(writeErrorMessage(result.error));
    return redirect(`/admin/profile/edit?error=${message}`, 303);
  }
  return redirect("/admin?profile-updated=1", 303);
};
