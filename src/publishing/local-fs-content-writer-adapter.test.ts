import { beforeEach, describe, expect, it, vi } from "vitest";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LocalFsContentWriterAdapter } from "./local-fs-content-writer-adapter";
import { buildContentPath } from "./content-path";
import type { WriteEntryInput } from "./content-writer";

// Same mocking idiom as `github-content-writer-adapter.test.ts`'s fetchFn
// mocks — real disk I/O is never exercised (per the spec's "no git
// operation" / no-real-write guarantee for this adapter's tests).
vi.mock("node:fs/promises", () => ({
  access: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

const PROJECT_ROOT = "/repo";

function buildPostsInput(
  overrides: Partial<WriteEntryInput> = {},
): WriteEntryInput {
  return {
    collection: "posts",
    slug: "hello-world",
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

beforeEach(() => {
  vi.mocked(access).mockReset();
  vi.mocked(mkdir).mockReset();
  vi.mocked(writeFile).mockReset();
});

describe("LocalFsContentWriterAdapter — create() happy path", () => {
  it("writes a markdown file to disk at src/content/<collection>/<slug>.md", async () => {
    vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT"));
    vi.mocked(mkdir).mockResolvedValueOnce(undefined);
    vi.mocked(writeFile).mockResolvedValueOnce(undefined);
    const adapter = new LocalFsContentWriterAdapter({
      projectRoot: PROJECT_ROOT,
    });

    const result = await adapter.create(buildPostsInput());

    expect(result).toEqual({ ok: true });
    const expectedPath = join(
      PROJECT_ROOT,
      buildContentPath("posts", "hello-world"),
    );
    expect(writeFile).toHaveBeenCalledWith(
      expectedPath,
      expect.stringContaining("Body content goes here."),
      "utf-8",
    );
  });
});

describe("LocalFsContentWriterAdapter — create-vs-edit branching", () => {
  it("returns a conflict when create() targets a slug that already exists", async () => {
    vi.mocked(access).mockResolvedValueOnce(undefined);
    const adapter = new LocalFsContentWriterAdapter({
      projectRoot: PROJECT_ROOT,
    });

    const result = await adapter.create(buildPostsInput());

    expect(result).toEqual({
      ok: false,
      error: { kind: "conflict", message: "file already exists" },
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("returns not-found when edit() targets a slug that does not exist", async () => {
    vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT"));
    const adapter = new LocalFsContentWriterAdapter({
      projectRoot: PROJECT_ROOT,
    });

    const result = await adapter.edit(buildPostsInput());

    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", message: "no file to edit" },
    });
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe("LocalFsContentWriterAdapter — edit() happy path", () => {
  it("overwrites the existing file in place", async () => {
    vi.mocked(access).mockResolvedValueOnce(undefined);
    vi.mocked(mkdir).mockResolvedValueOnce(undefined);
    vi.mocked(writeFile).mockResolvedValueOnce(undefined);
    const adapter = new LocalFsContentWriterAdapter({
      projectRoot: PROJECT_ROOT,
    });

    const result = await adapter.edit(
      buildPostsInput({
        frontmatter: {
          ...buildPostsInput().frontmatter,
          title: "Updated Title",
        },
      }),
    );

    expect(result).toEqual({ ok: true });
    expect(writeFile).toHaveBeenCalledTimes(1);
  });
});

describe("LocalFsContentWriterAdapter — validation failure", () => {
  it("rejects invalid frontmatter before any fs call", async () => {
    const adapter = new LocalFsContentWriterAdapter({
      projectRoot: PROJECT_ROOT,
    });

    const result = await adapter.create(
      buildPostsInput({ frontmatter: { title: 42 } }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
    expect(access).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });
});

describe("LocalFsContentWriterAdapter — unexpected fs error", () => {
  it("returns a sanitized api-error when writeFile rejects unexpectedly", async () => {
    vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT"));
    vi.mocked(mkdir).mockResolvedValueOnce(undefined);
    vi.mocked(writeFile).mockRejectedValueOnce(new Error("disk full"));
    const adapter = new LocalFsContentWriterAdapter({
      projectRoot: PROJECT_ROOT,
    });

    const result = await adapter.create(buildPostsInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("api-error");
      expect(result.error.message).toContain("disk full");
    }
  });
});
