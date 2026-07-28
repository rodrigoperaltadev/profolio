import { describe, expect, it, vi } from "vitest";
import { GithubContentWriterAdapter } from "./github-content-writer-adapter";
import type { WriteEntryInput } from "./content-writer";

// Fake token — never a real credential. Used to prove `sanitizeError()` is
// actually invoked from the adapter's catch boundary, per design.md's
// "Sanitization mechanism" decision and the spec's "Sanitized Error
// Handling" requirement.
const FAKE_TOKEN = "ghp_fakeAdapterToken1234567890";
const REDACTED = "[REDACTED]";

const CONFIG = {
  token: FAKE_TOKEN,
  owner: "acme",
  repo: "site",
  branch: "main",
};

const POSTS_URL =
  "https://api.github.com/repos/acme/site/contents/src/content/posts/hello-world.md";
const PROJECTS_URL =
  "https://api.github.com/repos/acme/site/contents/src/content/projects/profolio.md";

function mockResponse(status: number, body: unknown = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () =>
      Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  } as Response;
}

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

function buildProjectsInput(
  overrides: Partial<WriteEntryInput> = {},
): WriteEntryInput {
  return {
    collection: "projects",
    slug: "profolio",
    frontmatter: {
      name: "Profolio",
      stack: ["Astro"],
      link: "https://example.com/profolio",
      date: new Date("2026-01-01T00:00:00.000Z"),
      draft: false,
      deleted: false,
    },
    body: "Project body.",
    commitMessage: "feat(content): edit profolio project",
    ...overrides,
  };
}

describe("GithubContentWriterAdapter — create() happy path", () => {
  it("sends a PUT with base64-encoded content and an Authorization header for a new posts slug", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(404))
      .mockResolvedValueOnce(mockResponse(201, { commit: { sha: "abc123" } }));
    const adapter = new GithubContentWriterAdapter(CONFIG, fetchFn);

    const result = await adapter.create(buildPostsInput());

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const [putUrl, putOptions] = fetchFn.mock.calls[1] as [
      string,
      RequestInit,
    ];
    expect(putUrl).toBe(POSTS_URL);
    expect(putOptions.method).toBe("PUT");
    expect(putOptions.headers).toHaveProperty("Authorization");

    const putBody = JSON.parse(putOptions.body as string) as {
      content: string;
    };
    // Real `buildMarkdownFile()` output (not mocked away) — a lightweight
    // structural sanity check independent of the Phase 2 round-trip test's
    // own reverse parser, per the orchestrator's residual concern about
    // `frontmatter.ts` only being proven self-consistent so far. This does
    // not replace the dedicated real-Astro-build round-trip check planned
    // for final verification.
    const decoded = Buffer.from(putBody.content, "base64").toString("utf-8");
    const frontmatterLines = decoded.split("\n");
    expect(frontmatterLines[0]).toBe("---");
    expect(frontmatterLines).toContain("---");
    expect(decoded).toContain('title: "Hello World"');
    expect(decoded).toContain("draft: false");
    expect(decoded).toContain("Body content goes here.");
  });
});

describe("GithubContentWriterAdapter — edit() happy path", () => {
  it("reads the current SHA before writing and includes it in the PUT body for projects", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(200, { sha: "sha-current" }))
      .mockResolvedValueOnce(mockResponse(200, { commit: { sha: "sha-new" } }));
    const adapter = new GithubContentWriterAdapter(CONFIG, fetchFn);

    const result = await adapter.edit(buildProjectsInput());

    expect(result).toEqual({ ok: true });
    expect(fetchFn).toHaveBeenCalledTimes(2);

    const [getUrl, getOptions] = fetchFn.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(getUrl).toBe(PROJECTS_URL);
    expect(getOptions.method).toBe("GET");

    const [, putOptions] = fetchFn.mock.calls[1] as [string, RequestInit];
    const putBody = JSON.parse(putOptions.body as string) as { sha: string };
    expect(putBody.sha).toBe("sha-current");
  });
});

describe("GithubContentWriterAdapter — create-vs-edit branching", () => {
  it("returns a conflict when create() targets a slug that already exists", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(200, { sha: "existing" }));
    const adapter = new GithubContentWriterAdapter(CONFIG, fetchFn);

    const result = await adapter.create(buildPostsInput());

    expect(result).toEqual({
      ok: false,
      error: { kind: "conflict", message: "file already exists" },
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("returns not-found when edit() targets a slug that does not exist", async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(mockResponse(404));
    const adapter = new GithubContentWriterAdapter(CONFIG, fetchFn);

    const result = await adapter.edit(buildPostsInput());

    expect(result).toEqual({
      ok: false,
      error: { kind: "not-found", message: "no file to edit" },
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});

describe("GithubContentWriterAdapter — SHA conflict", () => {
  it("surfaces a typed conflict and does not auto-retry when the PUT rejects a stale SHA", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(200, { sha: "sha-stale" }))
      .mockResolvedValueOnce(mockResponse(409));
    const adapter = new GithubContentWriterAdapter(CONFIG, fetchFn);

    const result = await adapter.edit(buildPostsInput());

    expect(result).toEqual({
      ok: false,
      error: { kind: "conflict", message: "sha conflict" },
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("GithubContentWriterAdapter — validation failure", () => {
  it("rejects invalid frontmatter before any network call", async () => {
    const fetchFn = vi.fn();
    const adapter = new GithubContentWriterAdapter(CONFIG, fetchFn);

    const result = await adapter.create(
      buildPostsInput({ frontmatter: { title: 42 } }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("validation");
    }
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("GithubContentWriterAdapter — error sanitization", () => {
  it("redacts the token when fetchFn throws an Error embedding it", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error(`network failure token=${FAKE_TOKEN}`));
    const adapter = new GithubContentWriterAdapter(CONFIG, fetchFn);

    const result = await adapter.create(buildPostsInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain(FAKE_TOKEN);
      expect(result.error.message).toContain(REDACTED);
    }
  });

  it("redacts the token when a non-ok PUT response body embeds it", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(404))
      .mockResolvedValueOnce(
        mockResponse(422, `token ${FAKE_TOKEN} is invalid`),
      );
    const adapter = new GithubContentWriterAdapter(CONFIG, fetchFn);

    const result = await adapter.create(buildPostsInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).not.toContain(FAKE_TOKEN);
      expect(result.error.message).toContain(REDACTED);
    }
  });
});
