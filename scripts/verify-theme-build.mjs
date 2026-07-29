#!/usr/bin/env node
// Build-time proof that the theme system's CSS/HTML output is real — the
// dark and light custom-property values actually differ in the emitted
// (minified) CSS, and the emitted HTML carries the `data-theme` attribute
// plus the toggle script. Unit tests prove `loadThemePreset()`'s logic;
// they cannot prove Tailwind/lightningcss actually emit two distinct token
// sets, or that Layout.astro's inline scripts survive a production build.
// Same build-level proof pattern as verify-admin-server.mjs /
// verify-content-collections.mjs — see design.md's Migration/Rollout risk
// on CSS minification rewriting token values.
//
// Empirically confirmed during apply (task 2.9): lightningcss lowercases
// and shortens plain hex colors (`#111111` -> `#111`, `#00FFFF` -> `#0ff`)
// and rewrites `rgba(...)` tokens to 8-digit hex-with-alpha (e.g.
// `rgba(229,228,226,0.6)` -> `#e5e4e299`) — it does NOT rewrite our
// `@theme` overrides to an `oklch(...)` form (that form only appeared for
// Tailwind's own built-in red/yellow/green palette, unrelated to this
// change). The assertion below compares captured values via regex, not an
// exact string match, so it tolerates either normalized form.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("..", import.meta.url));
const SAMPLED_TOKEN = "--color-background";

function assertProof(condition, message) {
  if (!condition) {
    throw new Error(`[theme-build-proof] FAILED: ${message}`);
  }
}

function cleanAstroBuildState() {
  rmSync(`${rootDir}/.astro`, { recursive: true, force: true });
  rmSync(`${rootDir}/dist`, { recursive: true, force: true });
}

function runAstroBuild() {
  execFileSync("npx", ["astro", "build"], { cwd: rootDir, stdio: "inherit" });
}

function readEmittedCss() {
  const assetsDir = `${rootDir}/dist/client/_astro`;
  const cssFile = readdirSync(assetsDir).find((name) => name.endsWith(".css"));
  assertProof(Boolean(cssFile), `no emitted CSS file found in ${assetsDir}`);
  return readFileSync(`${assetsDir}/${cssFile}`, "utf-8");
}

function readEmittedIndexHtml() {
  return readFileSync(`${rootDir}/dist/client/index.html`, "utf-8");
}

function sampleTokenValues(css, token) {
  const pattern = new RegExp(`${token}:([^;}]+)[;}]`, "g");
  return [...css.matchAll(pattern)].map((match) => match[1]);
}

function proveDarkAndLightValuesDiffer(css) {
  const values = sampleTokenValues(css, SAMPLED_TOKEN);
  assertProof(
    values.length >= 2,
    `expected at least 2 occurrences of ${SAMPLED_TOKEN} in emitted CSS, found ${values.length}`,
  );
  const uniqueValues = new Set(values);
  assertProof(
    uniqueValues.size >= 2,
    `expected dark and light values of ${SAMPLED_TOKEN} to differ, all occurrences were identical: ${values.join(", ")}`,
  );
  console.log(
    `[theme-build-proof] ${SAMPLED_TOKEN} has ${uniqueValues.size} distinct values in emitted CSS: ${[...uniqueValues].join(", ")} — OK`,
  );
}

function proveDataThemeAttributePresent(html) {
  assertProof(/data-theme="[^"]+"/.test(html), "expected a data-theme attribute in emitted HTML");
  console.log("[theme-build-proof] data-theme attribute present in emitted HTML — OK");
}

function proveToggleScriptPresent(html) {
  assertProof(
    html.includes("data-theme-toggle"),
    "expected the toggle-delegation script referencing [data-theme-toggle] in emitted HTML",
  );
  assertProof(
    html.includes("light-theme"),
    "expected light-theme toggle logic in emitted HTML",
  );
  console.log("[theme-build-proof] toggle script present in emitted HTML — OK");
}

function main() {
  cleanAstroBuildState();
  runAstroBuild();

  try {
    const css = readEmittedCss();
    const html = readEmittedIndexHtml();

    proveDarkAndLightValuesDiffer(css);
    proveDataThemeAttributePresent(html);
    proveToggleScriptPresent(html);
  } finally {
    cleanAstroBuildState();
  }

  console.log("[theme-build-proof] all theme build proofs passed");
}

main();
