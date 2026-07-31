// POST handler for logical delete — see the spec's "Admin Logical Delete"
// requirement and design.md's "Delete's frontmatter source" decision:
// re-fetches the full frontmatter server-side via getEntry() rather than
// trusting a client-submitted hidden field, then calls edit() with
// deleted: true on the full existing frontmatter (no new port method, no
// hard delete).
import type { APIRoute } from "astro";
import { getEntry } from "astro:content";
import { createContentWriter } from "../../../../../config/content-writer-factory";
import { parseCollectionParam } from "../../../_lib/collection-param";
import { writeErrorMessage } from "../../../_lib/write-error-message";

export const POST: APIRoute = async ({ params, redirect }) => {
  const collection = parseCollectionParam(params.collection);
  const slug = params.slug;
  // `profile` is excluded here even though `parseCollectionParam` now accepts
  // it (profile-wizard change, task 2.2): `profileSchema` has no `deleted`
  // field (see "Profile Is Exempt from the Shared Entry Contract"), so this
  // route's `{ ...entry.data, deleted: true }` would silently no-op instead
  // of deleting anything, while still claiming success. The singleton has no
  // delete route at all — reset (`/admin/api/profile/reset`, Phase 3) is its
  // equivalent. Explicit, not incidental — see sdd-verify's profile-wizard report.
  if (!collection || collection === "profile" || !slug) {
    return new Response("Not Found", { status: 404 });
  }

  const entry = await getEntry(collection, `${slug}.md`);
  if (!entry) {
    return new Response("Not Found", { status: 404 });
  }

  const result = await createContentWriter().edit({
    collection,
    slug,
    frontmatter: { ...entry.data, deleted: true },
    body: entry.body ?? "",
    commitMessage: `content: delete ${collection}/${slug}`,
  });

  if (!result.ok) {
    const message = encodeURIComponent(writeErrorMessage(result.error));
    return redirect(`/admin/${collection}/${slug}/edit?error=${message}`, 303);
  }
  return redirect(`/admin?deleted=${encodeURIComponent(slug)}`, 303);
};
