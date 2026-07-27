#!/usr/bin/env node
// Build-time proof that Astro's real `astro:content` pipeline resolves the
// `posts`/`projects` collections end-to-end (schema validation + mapper-ready
// data), not just the hand-built fixtures `schemas.test.ts` /
// `to-content-entry.test.ts` exercise. See "Build-Time Content Proof" in
// openspec/changes/content-model-schema/design.md for why this cannot be a
// Vitest test: Astro's content store (`globalDataStore`) is only populated by
// a real `astro build` (or `astro dev`) pass — importing `astro:content`, or
// rendering through `astro/container`, from a bare Vitest process reads an
// empty store every time, since neither triggers Astro's content-layer sync.
// This exact gap ("silently returns [] instead of resolving or failing") is
// the bug this script exists to catch going forward.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const pagesDir = `${rootDir}/src/pages`;
const probePagePath = `${pagesDir}/content-proof.astro`;
const probeDistPath = `${rootDir}/dist/content-proof/index.html`;
// NOTE: must NOT start with "_" — Astro's own content glob ignores
// underscore-prefixed entries entirely (silently, same failure shape as the
// bug this proof exists to catch), so an underscore-prefixed malformed
// fixture would never be loaded, let alone rejected.
const malformedEntryPath = `${rootDir}/src/content/posts/content-proof-malformed.md`;
const pagesDirPreexisted = existsSync(pagesDir);

const PROBE_PAGE_SOURCE = `---
import { getCollection } from "astro:content";
const posts = await getCollection("posts");
const projects = await getCollection("projects");
---
<div id="posts">{posts.length}</div>
<div id="projects">{projects.length}</div>
`;

const MALFORMED_ENTRY_SOURCE = `---
title: 123
draft: false
---
Missing required "date" field and wrong type for "title" — proves the real
build rejects invalid content instead of silently dropping it.
`;

function cleanAstroBuildState() {
  rmSync(`${rootDir}/.astro`, { recursive: true, force: true });
  rmSync(`${rootDir}/dist`, { recursive: true, force: true });
}

function runAstroBuild() {
  execFileSync("npx", ["astro", "build"], { cwd: rootDir, stdio: "inherit" });
}

function assertProof(condition, message) {
  if (!condition) {
    throw new Error(`[content-proof] FAILED: ${message}`);
  }
}

function proveValidContentResolves() {
  cleanAstroBuildState();
  runAstroBuild();
  const html = readFileSync(probeDistPath, "utf8");
  assertProof(
    html.includes('id="posts">1'),
    `expected posts:1 in build output, got: ${html}`,
  );
  assertProof(
    html.includes('id="projects">1'),
    `expected projects:1 in build output, got: ${html}`,
  );
  console.log(
    "[content-proof] valid content resolves through getCollection(): posts:1 projects:1 — OK",
  );
}

function proveMalformedContentFailsBuild() {
  writeFileSync(malformedEntryPath, MALFORMED_ENTRY_SOURCE);
  cleanAstroBuildState();
  let buildFailed = false;
  try {
    runAstroBuild();
  } catch {
    buildFailed = true;
  }
  assertProof(
    buildFailed,
    "expected `astro build` to fail on malformed content, but it exited 0",
  );
  console.log(
    "[content-proof] malformed content fails the real build (not silently dropped) — OK",
  );
}

function cleanup() {
  rmSync(probePagePath, { force: true });
  rmSync(malformedEntryPath, { force: true });
  if (!pagesDirPreexisted) {
    rmSync(pagesDir, { recursive: true, force: true });
  }
  cleanAstroBuildState();
}

function main() {
  mkdirSync(pagesDir, { recursive: true });
  writeFileSync(probePagePath, PROBE_PAGE_SOURCE);

  try {
    proveValidContentResolves();
    proveMalformedContentFailsBuild();
  } finally {
    cleanup();
  }

  console.log("[content-proof] all content-collection proofs passed");
}

main();
