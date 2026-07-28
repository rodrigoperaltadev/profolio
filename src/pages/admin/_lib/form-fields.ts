// Write-side counterpart to `to-content-entry.ts`'s read-side mapper: builds
// each collection's frontmatter Record from a submitted admin form. The
// `deleted` flag is never taken from a checkbox in the create/edit forms —
// creation always starts undeleted, and edit callers must pass the entry's
// current `deleted` value explicitly (see design.md's "Delete's frontmatter
// source" decision: this admin surface never trusts a client-submitted
// hidden field for that flag).
import type { Collection } from "../../../publishing/content-writer";

function stringField(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function splitCommaList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function checkboxField(formData: FormData, key: string): boolean {
  return formData.get(key) !== null;
}

export interface FrontmatterFromFormDataOptions {
  readonly deleted: boolean;
}

export function frontmatterFromFormData(
  collection: Collection,
  formData: FormData,
  options: FrontmatterFromFormDataOptions = { deleted: false },
): Record<string, unknown> {
  const shared = {
    date: stringField(formData, "date"),
    draft: checkboxField(formData, "draft"),
    deleted: options.deleted,
  };
  return collection === "posts"
    ? {
        ...shared,
        title: stringField(formData, "title"),
        tags: splitCommaList(formData.get("tags")),
      }
    : {
        ...shared,
        name: stringField(formData, "name"),
        stack: splitCommaList(formData.get("stack")),
        link: stringField(formData, "link"),
      };
}

export function bodyFromFormData(formData: FormData): string {
  return stringField(formData, "body");
}

export function slugFromFormData(formData: FormData): string {
  return stringField(formData, "slug");
}
