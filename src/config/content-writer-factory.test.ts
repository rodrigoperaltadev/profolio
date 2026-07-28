import { afterEach, describe, expect, it, vi } from "vitest";
import { createContentWriter } from "./content-writer-factory";
import { isPublishingConfigured, loadPublishingConfig } from "./publishing-config";
import { GithubContentWriterAdapter } from "../publishing/github-content-writer-adapter";
import { LocalFsContentWriterAdapter } from "../publishing/local-fs-content-writer-adapter";

// Mocking `isPublishingConfigured`/`loadPublishingConfig` (not env vars
// directly) proves the factory's own branching in isolation from either
// concrete adapter's construction requirements — same idiom as the
// github-adapter test's fetchFn mock.
vi.mock("./publishing-config", () => ({
  isPublishingConfigured: vi.fn(),
  loadPublishingConfig: vi.fn(),
}));

afterEach(() => {
  vi.mocked(isPublishingConfigured).mockReset();
  vi.mocked(loadPublishingConfig).mockReset();
});

describe("createContentWriter — isPublishingConfigured() true", () => {
  it("returns a GithubContentWriterAdapter instance built from loadPublishingConfig()", () => {
    vi.mocked(isPublishingConfigured).mockReturnValue(true);
    vi.mocked(loadPublishingConfig).mockReturnValue({
      token: "ghp_fakeFactoryToken1234567890",
      owner: "acme",
      repo: "site",
      branch: "main",
    });

    const writer = createContentWriter();

    expect(writer).toBeInstanceOf(GithubContentWriterAdapter);
  });
});

describe("createContentWriter — isPublishingConfigured() false", () => {
  it("returns a LocalFsContentWriterAdapter instance and never reads a GitHub token", () => {
    vi.mocked(isPublishingConfigured).mockReturnValue(false);

    const writer = createContentWriter();

    expect(writer).toBeInstanceOf(LocalFsContentWriterAdapter);
    expect(loadPublishingConfig).not.toHaveBeenCalled();
  });
});
