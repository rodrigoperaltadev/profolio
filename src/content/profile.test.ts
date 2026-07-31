import { afterEach, describe, expect, it, vi } from "vitest";
import { getEntry } from "astro:content";
import { getProfile, PROFILE_SLUG } from "./profile";

// Mocking `astro:content`'s `getEntry` directly (not a real content store)
// proves getProfile()'s own found/not-found branching in isolation — same
// idiom as `content-writer-factory.test.ts`'s `publishing-config` mock.
vi.mock("astro:content", () => ({
  getEntry: vi.fn(),
}));

afterEach(() => {
  vi.mocked(getEntry).mockReset();
});

describe("getProfile — found", () => {
  it("returns the typed Profile when the entry exists at the fixed slug", async () => {
    const data = {
      name: "Ada Lovelace",
      role: "Software Engineer",
      bio: "Building things with Astro.",
      email: "ada@example.com",
      links: [{ label: "GitHub", url: "https://github.com/ada" }],
    };
    vi.mocked(getEntry).mockResolvedValue({
      id: `${PROFILE_SLUG}.md`,
      collection: "profile",
      data,
    });

    const result = await getProfile();

    expect(result).toEqual(data);
    // getEntry() takes ".md"-suffixed slugs under
    // legacy.collectionsBackwardsCompat — see edit.ts's documented gotcha.
    expect(getEntry).toHaveBeenCalledWith("profile", `${PROFILE_SLUG}.md`);
  });
});

describe("getProfile — not found", () => {
  it("returns undefined without throwing when no profile entry exists", async () => {
    vi.mocked(getEntry).mockResolvedValue(undefined);

    await expect(getProfile()).resolves.toBeUndefined();
  });
});
