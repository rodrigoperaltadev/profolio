#!/usr/bin/env node
// Build-time proof that the REAL `buildMarkdownFile()` output (not the
// hand-rolled reverse parser `frontmatter.test.ts` uses to prove internal
// self-consistency) round-trips through Astro's REAL frontmatter parser —
// closing the residual risk flagged twice in this change's apply-progress
// (Phase 2's round-trip test only proved the serializer against itself;
// Phase 3 added a lightweight structural sanity check but explicitly did not
// replace this dedicated proof).
//
// Also covers `profile`'s nested `links` block sequence (profile-wizard
// change, task 1.11): Vitest's `parseProfileFrontmatterBlock()` in
// `frontmatter.test.ts` only proves the serializer against a hand-rolled
// reverse parser, never against Astro's real YAML frontmatter parser — same
// residual-risk shape this script already exists to close for posts.
//
// Same rationale as `verify-content-collections.mjs` for why this cannot be
// a Vitest test: Astro's content store is only populated by a real `astro
// build` pass, so the probe page + real build + dist-HTML assertion pattern
// is reused here verbatim.
//
// The genuine, non-reimplemented `buildMarkdownFile()` is loaded via Vite's
// SSR module loader (already a transitive dependency of Astro/Vitest, so
// this adds zero new dependencies) rather than importing the .ts file
// directly from a plain Node script, which cannot resolve TypeScript syntax
// on its own.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const pagesDir = `${rootDir}/src/pages`;
const probePagePath = `${pagesDir}/frontmatter-round-trip-proof.astro`;
const probeDistPath = `${rootDir}/dist/client/frontmatter-round-trip-proof/index.html`;
// NOTE: must NOT start with "_" — see verify-content-collections.mjs's note;
// Astro's content glob silently ignores underscore-prefixed entries.
const entrySlug = "frontmatter-round-trip-proof";
const entryPath = `${rootDir}/src/content/posts/${entrySlug}.md`;
const profileDir = `${rootDir}/src/content/profile`;
const profileEntryPath = `${profileDir}/me.md`;
const pagesDirPreexisted = existsSync(pagesDir);
const profileDirPreexisted = existsSync(profileDir);

// The awkward-string case: a colon inside the title. A colon is meaningful
// YAML syntax (the key/value separator), so it must survive both
// `buildMarkdownFile()`'s quoting/escaping AND Astro's real YAML frontmatter
// parser without corrupting the value or breaking the document structure.
const SAMPLE_FRONTMATTER = {
  title: "Notes: On Publishing",
  date: new Date("2026-07-27T00:00:00.000Z"),
  tags: ["release: notes"],
  draft: false,
  deleted: false,
};
const SAMPLE_BODY = "Body written by the real buildMarkdownFile() output.";

// Colon-in-value case for the profile branch too, plus a two-entry `links`
// array to prove the nested block sequence (not parallel string arrays)
// survives Astro's real parser across multiple items.
const SAMPLE_PROFILE = {
  name: "Ada Lovelace",
  role: "Software Engineer",
  bio: "Building things with Astro.",
  email: "ada@example.com",
  links: [
    { label: "GitHub", url: "https://github.com/ada" },
    { label: "Site: Portfolio", url: "https://ada.example.com" },
  ],
};

const PROBE_PAGE_SOURCE = `---
export const prerender = true;
import { getCollection, getEntry } from "astro:content";
const posts = await getCollection("posts");
// Legacy \`type: "content"\` collections keep the file extension in \`id\`
// (e.g. "frontmatter-round-trip-proof.md"), unlike the slug-only \`entry.id\`
// naming this repo's \`toContentEntry()\` mapper happens to also use — see
// the debug session in apply-progress for how this was confirmed.
const entry = posts.find((post) => post.id === "${entrySlug}.md");
// Same ".md"-suffixed id shape applies to getEntry() — see profile.ts's own
// documented gotcha (mirrors edit.ts's precedent).
const profile = await getEntry("profile", "me.md");
---
<div id="found">{entry ? "yes" : "no"}</div>
<div id="title">{entry?.data.title}</div>
<div id="tag">{entry?.data.tags[0]}</div>
<div id="profile-found">{profile ? "yes" : "no"}</div>
<div id="profile-name">{profile?.data.name}</div>
<div id="profile-links-count">{profile?.data.links.length}</div>
<div id="profile-link-0-label">{profile?.data.links[0]?.label}</div>
<div id="profile-link-0-url">{profile?.data.links[0]?.url}</div>
<div id="profile-link-1-label">{profile?.data.links[1]?.label}</div>
<div id="profile-link-1-url">{profile?.data.links[1]?.url}</div>
`;

async function loadRealBuildMarkdownFile() {
  const server = await createServer({
    configFile: false,
    root: rootDir,
    logLevel: "silent",
  });
  try {
    const mod = await server.ssrLoadModule("/src/publishing/frontmatter.ts");
    return mod.buildMarkdownFile;
  } finally {
    await server.close();
  }
}

function cleanAstroBuildState() {
  rmSync(`${rootDir}/.astro`, { recursive: true, force: true });
  rmSync(`${rootDir}/dist`, { recursive: true, force: true });
}

function runAstroBuild() {
  execFileSync("npx", ["astro", "build"], { cwd: rootDir, stdio: "inherit" });
}

function assertProof(condition, message) {
  if (!condition) {
    throw new Error(`[frontmatter-round-trip-proof] FAILED: ${message}`);
  }
}

function cleanup() {
  rmSync(probePagePath, { force: true });
  rmSync(entryPath, { force: true });
  rmSync(profileEntryPath, { force: true });
  if (!pagesDirPreexisted) {
    rmSync(pagesDir, { recursive: true, force: true });
  }
  if (!profileDirPreexisted) {
    rmSync(profileDir, { recursive: true, force: true });
  }
  cleanAstroBuildState();
}

function assertPostsProof(html) {
  assertProof(
    html.includes('id="found">yes'),
    `expected the probe entry to resolve via getCollection(), got: ${html}`,
  );
  assertProof(
    html.includes(SAMPLE_FRONTMATTER.title),
    `expected title "${SAMPLE_FRONTMATTER.title}" in build output, got: ${html}`,
  );
  assertProof(
    html.includes(SAMPLE_FRONTMATTER.tags[0]),
    `expected tag "${SAMPLE_FRONTMATTER.tags[0]}" in build output, got: ${html}`,
  );
}

function assertProfileProof(html) {
  const [firstLink, secondLink] = SAMPLE_PROFILE.links;
  assertProof(
    html.includes('id="profile-found">yes'),
    `expected the profile entry to resolve via getEntry(), got: ${html}`,
  );
  assertProof(
    html.includes(`id="profile-name">${SAMPLE_PROFILE.name}`),
    `expected profile name "${SAMPLE_PROFILE.name}" in build output, got: ${html}`,
  );
  assertProof(
    html.includes(`id="profile-links-count">${SAMPLE_PROFILE.links.length}`),
    `expected links.length === ${SAMPLE_PROFILE.links.length} in build output, got: ${html}`,
  );
  assertProof(
    html.includes(`id="profile-link-0-label">${firstLink.label}`) &&
      html.includes(`id="profile-link-0-url">${firstLink.url}`),
    `expected the first nested links[] block (label/url pair) to survive Astro's real parser, got: ${html}`,
  );
  assertProof(
    html.includes(`id="profile-link-1-label">${secondLink.label}`) &&
      html.includes(`id="profile-link-1-url">${secondLink.url}`),
    `expected the second nested links[] block (label/url pair, including the colon in its label) to survive Astro's real parser, got: ${html}`,
  );
}

async function main() {
  const buildMarkdownFile = await loadRealBuildMarkdownFile();
  const fileContent = buildMarkdownFile(SAMPLE_FRONTMATTER, SAMPLE_BODY);
  const profileFileContent = buildMarkdownFile(SAMPLE_PROFILE, SAMPLE_BODY);

  mkdirSync(pagesDir, { recursive: true });
  mkdirSync(profileDir, { recursive: true });
  writeFileSync(probePagePath, PROBE_PAGE_SOURCE);
  writeFileSync(entryPath, fileContent);
  writeFileSync(profileEntryPath, profileFileContent);

  try {
    cleanAstroBuildState();
    runAstroBuild();
    const html = readFileSync(probeDistPath, "utf8");
    assertPostsProof(html);
    assertProfileProof(html);
    console.log(
      "[frontmatter-round-trip-proof] real buildMarkdownFile() output round-trips through Astro's real frontmatter parser — OK",
    );
    console.log(
      "[frontmatter-round-trip-proof] real profile links[] nested block sequence round-trips through Astro's real getEntry()/getCollection() — OK",
    );
  } finally {
    cleanup();
  }
}

main();
