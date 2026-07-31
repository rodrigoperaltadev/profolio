// POST handler for entry creation — see the spec's "Admin Entry Creation and
// Editing" requirement and design.md's Data Flow. Validation happens inside
// ContentWriter.create() (parseFrontmatter() runs before any fs/GitHub
// write), so an invalid submission never reaches disk/the API.
import type { APIRoute } from "astro";
import { createContentWriter } from "../../../../config/content-writer-factory";
import { parseCollectionParam } from "../../_lib/collection-param";
import {
  bodyFromFormData,
  frontmatterFromFormData,
  slugFromFormData,
} from "../../_lib/form-fields";
import { writeErrorMessage } from "../../_lib/write-error-message";

export const POST: APIRoute = async ({ params, request, redirect }) => {
  const collection = parseCollectionParam(params.collection);
  // `profile` is excluded here even though `parseCollectionParam` now accepts
  // it (profile-wizard change, task 2.2): `frontmatterFromFormData()` has no
  // branch for the profile shape, and the singleton has its own dedicated
  // create route instead (`/admin/api/profile/create`, Phase 3). Explicit,
  // not incidental — see sdd-verify's profile-wizard report.
  if (!collection || collection === "profile") {
    return new Response("Not Found", { status: 404 });
  }

  const formData = await request.formData();
  const slug = slugFromFormData(formData);

  const result = await createContentWriter().create({
    collection,
    slug,
    frontmatter: frontmatterFromFormData(collection, formData),
    body: bodyFromFormData(formData),
    commitMessage: `content: add ${collection}/${slug}`,
  });

  if (!result.ok) {
    const message = encodeURIComponent(writeErrorMessage(result.error));
    return redirect(`/admin/${collection}/new?error=${message}`, 303);
  }
  return redirect(`/admin?created=${encodeURIComponent(slug)}`, 303);
};
