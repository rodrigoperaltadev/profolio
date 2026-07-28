import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isPublishingConfigured,
  loadAdminAccessToken,
  loadPublishingConfig,
} from "./publishing-config";

const requiredEnv = {
  githubToken: "ghp_fakeConfigToken1234567890",
  githubRepoOwner: "acme",
  githubRepoName: "site",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("loadPublishingConfig — all required vars present", () => {
  it("returns a config defaulting branch to \"main\" when GITHUB_CONTENT_BRANCH is unset", () => {
    vi.stubEnv("GITHUB_TOKEN", requiredEnv.githubToken);
    vi.stubEnv("GITHUB_REPO_OWNER", requiredEnv.githubRepoOwner);
    vi.stubEnv("GITHUB_REPO_NAME", requiredEnv.githubRepoName);
    vi.stubEnv("GITHUB_CONTENT_BRANCH", undefined);

    const config = loadPublishingConfig();

    expect(config).toEqual({
      token: requiredEnv.githubToken,
      owner: requiredEnv.githubRepoOwner,
      repo: requiredEnv.githubRepoName,
      branch: "main",
    });
  });

  it("uses GITHUB_CONTENT_BRANCH when it is set", () => {
    vi.stubEnv("GITHUB_TOKEN", requiredEnv.githubToken);
    vi.stubEnv("GITHUB_REPO_OWNER", requiredEnv.githubRepoOwner);
    vi.stubEnv("GITHUB_REPO_NAME", requiredEnv.githubRepoName);
    vi.stubEnv("GITHUB_CONTENT_BRANCH", "develop");

    const config = loadPublishingConfig();

    expect(config.branch).toBe("develop");
  });
});

describe("loadPublishingConfig — missing required vars", () => {
  it("throws when GITHUB_TOKEN is missing", () => {
    vi.stubEnv("GITHUB_TOKEN", undefined);
    vi.stubEnv("GITHUB_REPO_OWNER", requiredEnv.githubRepoOwner);
    vi.stubEnv("GITHUB_REPO_NAME", requiredEnv.githubRepoName);

    expect(() => loadPublishingConfig()).toThrow(/GITHUB_TOKEN/);
  });

  it("throws when GITHUB_REPO_OWNER is missing", () => {
    vi.stubEnv("GITHUB_TOKEN", requiredEnv.githubToken);
    vi.stubEnv("GITHUB_REPO_OWNER", undefined);
    vi.stubEnv("GITHUB_REPO_NAME", requiredEnv.githubRepoName);

    expect(() => loadPublishingConfig()).toThrow(/GITHUB_REPO_OWNER/);
  });

  it("throws when GITHUB_REPO_NAME is missing", () => {
    vi.stubEnv("GITHUB_TOKEN", requiredEnv.githubToken);
    vi.stubEnv("GITHUB_REPO_OWNER", requiredEnv.githubRepoOwner);
    vi.stubEnv("GITHUB_REPO_NAME", undefined);

    expect(() => loadPublishingConfig()).toThrow(/GITHUB_REPO_NAME/);
  });
});

describe("isPublishingConfigured", () => {
  it("returns true when all required GitHub publishing env vars are present", () => {
    vi.stubEnv("GITHUB_TOKEN", requiredEnv.githubToken);
    vi.stubEnv("GITHUB_REPO_OWNER", requiredEnv.githubRepoOwner);
    vi.stubEnv("GITHUB_REPO_NAME", requiredEnv.githubRepoName);

    expect(isPublishingConfigured()).toBe(true);
  });

  it("returns false when GITHUB_TOKEN is missing", () => {
    vi.stubEnv("GITHUB_TOKEN", undefined);
    vi.stubEnv("GITHUB_REPO_OWNER", requiredEnv.githubRepoOwner);
    vi.stubEnv("GITHUB_REPO_NAME", requiredEnv.githubRepoName);

    expect(isPublishingConfigured()).toBe(false);
  });

  it("returns false when GITHUB_REPO_OWNER is missing", () => {
    vi.stubEnv("GITHUB_TOKEN", requiredEnv.githubToken);
    vi.stubEnv("GITHUB_REPO_OWNER", undefined);
    vi.stubEnv("GITHUB_REPO_NAME", requiredEnv.githubRepoName);

    expect(isPublishingConfigured()).toBe(false);
  });

  it("returns false when GITHUB_REPO_NAME is missing", () => {
    vi.stubEnv("GITHUB_TOKEN", requiredEnv.githubToken);
    vi.stubEnv("GITHUB_REPO_OWNER", requiredEnv.githubRepoOwner);
    vi.stubEnv("GITHUB_REPO_NAME", undefined);

    expect(isPublishingConfigured()).toBe(false);
  });
});

describe("loadAdminAccessToken", () => {
  it("returns the value of ADMIN_ACCESS_TOKEN when set", () => {
    vi.stubEnv("ADMIN_ACCESS_TOKEN", "fake-admin-token");

    expect(loadAdminAccessToken()).toBe("fake-admin-token");
  });

  it("returns undefined when ADMIN_ACCESS_TOKEN is unset", () => {
    vi.stubEnv("ADMIN_ACCESS_TOKEN", undefined);

    expect(loadAdminAccessToken()).toBeUndefined();
  });
});
