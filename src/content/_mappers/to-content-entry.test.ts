import { describe, expect, it } from "vitest";
import type { CollectionEntry } from "astro:content";
import { toContentEntry } from "./to-content-entry";

const postsFixture: CollectionEntry<"posts"> = {
  id: "hello-world",
  collection: "posts",
  body: "First sample post proving the `posts` schema end-to-end.",
  data: {
    title: "Hello World",
    date: new Date("2026-07-27"),
    tags: ["meta", "profolio"],
    draft: false,
    deleted: false,
  },
};

const projectsFixture: CollectionEntry<"projects"> = {
  id: "profolio",
  collection: "projects",
  body: "Git-as-CMS content engine — the project this repo builds.",
  data: {
    name: "Profolio",
    stack: ["Astro", "TypeScript", "Zod"],
    link: "https://github.com/rodrigoperaltadev/profolio",
    date: new Date("2026-07-27"),
    draft: false,
    deleted: false,
  },
};

describe("toContentEntry dispatch", () => {
  it("dispatches a posts entry to the posts mapper", () => {
    const result = toContentEntry(postsFixture);

    expect(result).toEqual({
      id: "hello-world",
      title: "Hello World",
      date: postsFixture.data.date,
      draft: false,
      tags: ["meta", "profolio"],
      body: postsFixture.body,
    });
  });

  it("dispatches a projects entry to the projects mapper", () => {
    const result = toContentEntry(projectsFixture);

    expect(result).toEqual({
      id: "profolio",
      title: "Profolio",
      date: projectsFixture.data.date,
      draft: false,
      tags: ["Astro", "TypeScript", "Zod"],
      link: "https://github.com/rodrigoperaltadev/profolio",
      body: projectsFixture.body,
    });
  });
});

describe("toContentEntry body defaulting and shape", () => {
  it("defaults body to an empty string when the posts entry has no body", () => {
    const bodylessPost: CollectionEntry<"posts"> = {
      id: postsFixture.id,
      collection: postsFixture.collection,
      data: postsFixture.data,
    };

    const result = toContentEntry(bodylessPost);

    expect(result.body).toBe("");
  });

  it("defaults body to an empty string when the projects entry has no body", () => {
    const bodylessProject: CollectionEntry<"projects"> = {
      id: projectsFixture.id,
      collection: projectsFixture.collection,
      data: projectsFixture.data,
    };

    const result = toContentEntry(bodylessProject);

    expect(result.body).toBe("");
  });

  it("satisfies the shared ContentEntry shape for both collections", () => {
    const post = toContentEntry(postsFixture);
    const project = toContentEntry(projectsFixture);

    for (const entry of [post, project]) {
      expect(typeof entry.id).toBe("string");
      expect(typeof entry.title).toBe("string");
      expect(entry.date).toBeInstanceOf(Date);
      expect(typeof entry.draft).toBe("boolean");
      expect(Array.isArray(entry.tags)).toBe(true);
      expect(typeof entry.body).toBe("string");
    }
  });
});
