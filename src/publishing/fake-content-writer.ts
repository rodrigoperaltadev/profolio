// In-memory `ContentWriter` test double — same validation/conflict
// semantics as `GithubContentWriterAdapter`, but no network access at all
// (not even a constructor-injectable HTTP client). See design.md's
// Interfaces/Contracts and the spec's "FakeContentWriter Test Double"
// requirement. Future callers (e.g. issue #5) import this directly for
// their own tests.
//
// Methods are intentionally NOT declared `async`: every branch is
// synchronous, and the repo's `@typescript-eslint/require-await` rule flags
// an `async` function with no `await` expression. Wrapping the return value
// in `Promise.resolve()` satisfies the `Promise<WriteResult>` contract
// without an unnecessary `async` keyword.
import { parseFrontmatter } from "./parse-frontmatter";
import type {
  Collection,
  ContentWriter,
  WriteEntryInput,
  WriteResult,
} from "./content-writer";

interface StoredEntry {
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
}

function buildKey(collection: Collection, slug: string): string {
  return `${collection}/${slug}`;
}

export class FakeContentWriter implements ContentWriter {
  private readonly store = new Map<string, StoredEntry>();

  create(input: WriteEntryInput): Promise<WriteResult> {
    const parsed = parseFrontmatter(input.collection, input.frontmatter);
    if (!parsed.ok) {
      return Promise.resolve({
        ok: false,
        error: { kind: "validation", message: parsed.error },
      });
    }
    const key = buildKey(input.collection, input.slug);
    if (this.store.has(key)) {
      return Promise.resolve({
        ok: false,
        error: { kind: "conflict", message: "file already exists" },
      });
    }
    this.store.set(key, { frontmatter: parsed.data, body: input.body });
    return Promise.resolve({ ok: true });
  }

  edit(input: WriteEntryInput): Promise<WriteResult> {
    const parsed = parseFrontmatter(input.collection, input.frontmatter);
    if (!parsed.ok) {
      return Promise.resolve({
        ok: false,
        error: { kind: "validation", message: parsed.error },
      });
    }
    const key = buildKey(input.collection, input.slug);
    if (!this.store.has(key)) {
      return Promise.resolve({
        ok: false,
        error: { kind: "not-found", message: "no file to edit" },
      });
    }
    this.store.set(key, { frontmatter: parsed.data, body: input.body });
    return Promise.resolve({ ok: true });
  }

  get(collection: Collection, slug: string): StoredEntry | undefined {
    return this.store.get(buildKey(collection, slug));
  }
}
