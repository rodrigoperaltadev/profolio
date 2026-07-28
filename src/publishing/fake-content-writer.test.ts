import { describe, expect, it } from "vitest";
import { FakeContentWriter } from "./fake-content-writer";
import type { WriteEntryInput } from "./content-writer";

const POSTS = "posts";
const SLUG = "hello-world";

function buildPostsInput(overrides: Partial<WriteEntryInput> = {}): WriteEntryInput {
  return {
    collection: POSTS,
    slug: SLUG,
    frontmatter: {
      title: "Hello World",
      date: new Date("2026-01-01T00:00:00.000Z"),
      tags: ["intro"],
      draft: false,
      deleted: false,
    },
    body: "Body content goes here.",
    commitMessage: "feat(content): add hello-world post",
    ...overrides,
  };
}

describe("FakeContentWriter — create then edit", () => {
  it("creates a new entry and then edits it in place", async () => {
    const writer = new FakeContentWriter();

    const createResult = await writer.create(buildPostsInput());
    expect(createResult).toEqual({ ok: true });

    const editResult = await writer.edit(
      buildPostsInput({ body: "Updated body content." }),
    );
    expect(editResult).toEqual({ ok: true });
    expect(writer.get(POSTS, SLUG)?.body).toBe("Updated body content.");
  });
});

describe("FakeContentWriter — conflict and not-found semantics", () => {
  it("returns a conflict when create() targets a slug that already exists", async () => {
    const writer = new FakeContentWriter();
    await writer.create(buildPostsInput());

    const result = await writer.create(buildPostsInput());

    expect(result).toEqual({
      ok: false,
      error: { kind: "conflict", message: "file already exists" },
    });
  });

  it("returns not-found when edit() targets a slug that does not exist", async () => {
    const writer = new FakeContentWriter();

    const result = await writer.edit(buildPostsInput());

    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", message: "no file to edit" },
    });
  });
});

describe("FakeContentWriter — validation still runs", () => {
  it("rejects invalid frontmatter on create() without recording anything", async () => {
    const writer = new FakeContentWriter();

    const result = await writer.create(buildPostsInput({ frontmatter: { title: 42 } }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
    expect(writer.get(POSTS, SLUG)).toBeUndefined();
  });

  it("rejects invalid frontmatter on edit() even for an existing entry", async () => {
    const writer = new FakeContentWriter();
    await writer.create(buildPostsInput());

    const result = await writer.edit(buildPostsInput({ frontmatter: { title: 42 } }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
  });
});

describe("FakeContentWriter — no fetch import", () => {
  it("has no reference to `fetch` anywhere in its module source", async () => {
    const fs = await import("node:fs/promises");
    const modulePath = new URL("./fake-content-writer.ts", import.meta.url);
    const source = await fs.readFile(modulePath, "utf-8");

    expect(source).not.toContain("fetch");
  });
});
