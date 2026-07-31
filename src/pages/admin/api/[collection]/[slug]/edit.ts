// POST handler for entry editing — see the spec's "Admin Entry Creation and
// Editing" requirement and design.md's Data Flow. Re-fetches the entry
// server-side first (same "don't trust client hidden fields" posture as the
// delete handler) so the submitted form only ever needs to carry the fields
// the user can actually change; the entry's current `deleted` value is
// always carried forward untouched by a regular edit save.
import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { createContentWriter } from "../../../../../config/content-writer-factory";
import { parseCollectionParam } from "../../../_lib/collection-param";
import { bodyFromFormData, frontmatterFromFormData } from "../../../_lib/form-fields";
import { writeErrorMessage } from "../../../_lib/write-error-message";

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const collection = parseCollectionParam(params.collection);
  const slug = params.slug;
  // `profile` is excluded here even though `parseCollectionParam` now
  // accepts it (profile-wizard change, task 2.2): this generic route reads
  // back `existing.data.deleted`, a field the shared `ContentEntry` contract
  // requires but `profileSchema` deliberately omits — see the "Profile Is
  // Exempt from the Shared Entry Contract" spec requirement. Profile edits
  // go through their own dedicated route instead (`/admin/api/profile/edit`,
  // Phase 3).
  if (!collection || collection === "profile" || !slug) {
    return new Response("Not Found", { status: 404 });
  }

  // getEntry() id shape gotcha (task 4.1): the real id carries ".md" under
  // legacy.collectionsBackwardsCompat — see design.md's Architecture Decisions.
  const existing = await getEntry(collection, `${slug}.md`);
  if (!existing) {
    return new Response("Not Found", { status: 404 });
  }

  const formData = await request.formData();
  const result = await createContentWriter().edit({
    collection,
    slug,
    frontmatter: frontmatterFromFormData(collection, formData, {
      deleted: existing.data.deleted,
    }),
    body: bodyFromFormData(formData),
    commitMessage: `content: update ${collection}/${slug}`,
  });

  if (!result.ok) {
    const message = encodeURIComponent(writeErrorMessage(result.error));
    return redirect(`/admin/${collection}/${slug}/edit?error=${message}`, 303);
  }
  return redirect(`/admin?updated=${encodeURIComponent(slug)}`, 303);
};
