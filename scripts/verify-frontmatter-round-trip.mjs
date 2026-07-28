#!/usr/bin/env node
// Build-time proof that the REAL `buildMarkdownFile()` output (not the
// hand-rolled reverse parser `frontmatter.test.ts` uses to prove internal
// self-consistency) round-trips through Astro's REAL frontmatter parser —
// closing the residual risk flagged twice in this change's apply-progress
// (Phase 2's round-trip test only proved the serializer against itself;
// Phase 3 added a lightweight structural sanity check but explicitly did not
// replace this dedicated proof).
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
const probeDistPath = `${rootDir}/dist/frontmatter-round-trip-proof/index.html`;
// NOTE: must NOT start with "_" — see verify-content-collections.mjs's note;
// Astro's content glob silently ignores underscore-prefixed entries.
const entrySlug = "frontmatter-round-trip-proof";
const entryPath = `${rootDir}/src/content/posts/${entrySlug}.md`;
const pagesDirPreexisted = existsSync(pagesDir);

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

const PROBE_PAGE_SOURCE = `---
import { getCollection } from "astro:content";
const posts = await getCollection("posts");
// Legacy \`type: "content"\` collections keep the file extension in \`id\`
// (e.g. "frontmatter-round-trip-proof.md"), unlike the slug-only \`entry.id\`
// naming this repo's \`toContentEntry()\` mapper happens to also use — see
// the debug session in apply-progress for how this was confirmed.
const entry = posts.find((post) => post.id === "${entrySlug}.md");
---
<div id="found">{entry ? "yes" : "no"}</div>
<div id="title">{entry?.data.title}</div>
<div id="tag">{entry?.data.tags[0]}</div>
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
  if (!pagesDirPreexisted) {
    rmSync(pagesDir, { recursive: true, force: true });
  }
  cleanAstroBuildState();
}

async function main() {
  const buildMarkdownFile = await loadRealBuildMarkdownFile();
  const fileContent = buildMarkdownFile(SAMPLE_FRONTMATTER, SAMPLE_BODY);

  mkdirSync(pagesDir, { recursive: true });
  writeFileSync(probePagePath, PROBE_PAGE_SOURCE);
  writeFileSync(entryPath, fileContent);

  try {
    cleanAstroBuildState();
    runAstroBuild();
    const html = readFileSync(probeDistPath, "utf8");
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
    console.log(
      "[frontmatter-round-trip-proof] real buildMarkdownFile() output round-trips through Astro's real frontmatter parser — OK",
    );
  } finally {
    cleanup();
  }
}

main();
