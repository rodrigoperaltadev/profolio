// Declarative type-only file — no dedicated test, same idiom as
// `src/content/entry.ts` (see design.md's Interfaces/Contracts). TS
// exhaustiveness of the `WriteError` discriminated union is
// compiler-enforced, not re-tested.
export type Collection = "posts" | "projects";

export interface WriteEntryInput {
  readonly collection: Collection;
  readonly slug: string;
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
  readonly commitMessage: string;
}

export type WriteError =
  | { readonly kind: "validation"; readonly message: string }
  | { readonly kind: "not-found"; readonly message: string }
  | { readonly kind: "conflict"; readonly message: string }
  | { readonly kind: "api-error"; readonly status: number; readonly message: string };

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: WriteError };

export interface ContentWriter {
  create(input: WriteEntryInput): Promise<WriteResult>;
  edit(input: WriteEntryInput): Promise<WriteResult>;
}
