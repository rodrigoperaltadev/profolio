// Shared by `GithubContentWriterAdapter` and `LocalFsContentWriterAdapter` —
// both must agree on where a collection entry lives on disk (see design.md's
// "Shared path-building" decision). Extracted from the GitHub adapter's
// former private copy so there is exactly one implementation.
import type { Collection } from "./content-writer";

export function buildContentPath(collection: Collection, slug: string): string {
  return `src/content/${collection}/${slug}.md`;
}
