#!/usr/bin/env node
// Thin CLI entry point for `npm run setup` — the only file in this change
// that touches fs or readline. All `.env` parsing/merging/serialization,
// per-field validation, token generation, and PAT-link construction live in
// `./lib/env-wizard-core.mjs`; see design.md's Data Flow diagram and the
// spec's "CLI Entry Point and Testable Core Module" requirement. This file
// is intentionally excluded from the unit-test coverage gate (thin, I/O-only
// orchestration) — see design.md's Testing Strategy, "Not unit-tested" row.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import * as core from "./lib/env-wizard-core.mjs";

const ENV_PATH = fileURLToPath(new URL("../.env", import.meta.url));

const KEY_GITHUB_TOKEN = "GITHUB_TOKEN";
const KEY_GITHUB_REPO_OWNER = "GITHUB_REPO_OWNER";
const KEY_GITHUB_REPO_NAME = "GITHUB_REPO_NAME";
const KEY_GITHUB_CONTENT_BRANCH = "GITHUB_CONTENT_BRANCH";
const KEY_ADMIN_ACCESS_TOKEN = "ADMIN_ACCESS_TOKEN";
const KEY_THEME_PRESET = "THEME_PRESET";

const DEFAULT_BRANCH = "main";
const DEFAULT_THEME_PRESET = "brutalist";

const INVALID_TOKEN_MESSAGE =
  "That doesn't look like a valid GitHub token (expected a ghp_/github_pat_/gho_/ghu_/ghs_/ghr_ prefix). Try again.";
const INVALID_SLUG_MESSAGE = "That doesn't look like a valid GitHub owner/repo name. Try again.";
const MANUAL_SCOPING_NOTE =
  "Note: repository access is NOT pre-selected by this link — choose the target repository manually in GitHub's UI before generating the token.";

async function askYesNo(rl, question, defaultYes) {
  const suffix = defaultYes ? "Y/n" : "y/N";
  const answer = (await rl.question(`${question} (${suffix}) `)).trim().toLowerCase();
  if (answer === "") return defaultYes;
  return answer === "y" || answer === "yes";
}

async function askRequired(rl, question, validate, invalidMessage) {
  for (;;) {
    const answer = (await rl.question(`${question} `)).trim();
    if (core.isNonEmpty(answer) && (validate === undefined || validate(answer))) {
      return answer;
    }
    console.log(invalidMessage);
  }
}

async function askOptional(rl, question, defaultValue) {
  const answer = (await rl.question(`${question} [${defaultValue}] `)).trim();
  return answer === "" ? defaultValue : answer;
}

// Shared idempotency flow: if a value already exists for this key, show it
// masked (when secret) and let the operator keep it or replace it. Only
// falls through to `askNew()` when there's nothing to keep or the operator
// chose to replace — see spec's "Idempotent .env Handling with Masked
// Display".
async function resolveOrAsk(rl, current, secret, askNew) {
  if (current !== undefined) {
    const display = secret ? core.maskSecret(current) : current;
    const keep = await askYesNo(rl, `Existing value found: "${display}". Keep it?`, true);
    if (keep) return current;
  }
  return askNew();
}

async function promptGithubToken(rl, lines) {
  const current = core.getEntryValue(lines, KEY_GITHUB_TOKEN);
  return resolveOrAsk(rl, current, true, () =>
    askRequired(
      rl,
      "GitHub personal access token (GITHUB_TOKEN):",
      core.looksLikeGithubToken,
      INVALID_TOKEN_MESSAGE,
    ),
  );
}

async function promptGithubOwner(rl, lines) {
  const current = core.getEntryValue(lines, KEY_GITHUB_REPO_OWNER);
  return resolveOrAsk(rl, current, false, () =>
    askRequired(rl, "GitHub repo owner (GITHUB_REPO_OWNER):", core.isRepoSlug, INVALID_SLUG_MESSAGE),
  );
}

async function promptGithubRepo(rl, lines) {
  const current = core.getEntryValue(lines, KEY_GITHUB_REPO_NAME);
  return resolveOrAsk(rl, current, false, () =>
    askRequired(rl, "GitHub repo name (GITHUB_REPO_NAME):", core.isRepoSlug, INVALID_SLUG_MESSAGE),
  );
}

async function promptGithubBranch(rl, lines) {
  const current = core.getEntryValue(lines, KEY_GITHUB_CONTENT_BRANCH);
  return resolveOrAsk(rl, current, false, () =>
    askOptional(rl, "Content branch (GITHUB_CONTENT_BRANCH):", DEFAULT_BRANCH),
  );
}

async function generateOrEnterAdminToken(rl) {
  const wantsGenerate = await askYesNo(rl, "Generate a new ADMIN_ACCESS_TOKEN automatically?", true);
  if (wantsGenerate) {
    const generated = core.generateAdminToken();
    console.log(`Generated ADMIN_ACCESS_TOKEN: ${generated}`);
    return generated;
  }
  return askRequired(rl, "Enter a custom ADMIN_ACCESS_TOKEN:", undefined, "Token cannot be empty. Try again.");
}

async function promptAdminToken(rl, lines) {
  const current = core.getEntryValue(lines, KEY_ADMIN_ACCESS_TOKEN);
  return resolveOrAsk(rl, current, true, () => generateOrEnterAdminToken(rl));
}

async function promptThemePreset(rl, lines) {
  const current = core.getEntryValue(lines, KEY_THEME_PRESET) ?? DEFAULT_THEME_PRESET;
  return askOptional(rl, "Theme preset (THEME_PRESET):", current);
}

// GitHub publishing is a skippable-as-a-set group: declining never prompts
// for (or writes) any of the three GitHub vars, `GITHUB_CONTENT_BRANCH`, or
// `ADMIN_ACCESS_TOKEN` — see spec's "GitHub Publishing Prompt Group".
async function promptGithubPublishing(rl, lines) {
  const wantsGithub = await askYesNo(rl, "Configure GitHub publishing?", false);
  if (!wantsGithub) return { configured: false, answers: {} };

  const answers = {
    [KEY_GITHUB_TOKEN]: await promptGithubToken(rl, lines),
    [KEY_GITHUB_REPO_OWNER]: await promptGithubOwner(rl, lines),
    [KEY_GITHUB_REPO_NAME]: await promptGithubRepo(rl, lines),
    [KEY_GITHUB_CONTENT_BRANCH]: await promptGithubBranch(rl, lines),
    [KEY_ADMIN_ACCESS_TOKEN]: await promptAdminToken(rl, lines),
  };

  return { configured: true, answers };
}

function printPatLinkAndNote() {
  const url = core.buildPatTemplateUrl({
    name: "profolio-content-publishing",
    description: "Fine-grained token for profolio's git-as-CMS publishing wizard",
  });
  console.log(`\nCreate a fine-grained PAT here: ${url}`);
  console.log(MANUAL_SCOPING_NOTE);
}

function readExistingEnv() {
  return existsSync(ENV_PATH) ? core.parseEnvFile(readFileSync(ENV_PATH, "utf-8")) : [];
}

async function main() {
  const lines = readExistingEnv();
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    console.log("Profolio env setup wizard\n");
    const github = await promptGithubPublishing(rl, lines);
    const themePreset = await promptThemePreset(rl, lines);

    const answers = { ...github.answers, [KEY_THEME_PRESET]: themePreset };
    const merged = core.mergeEnvEntries(lines, answers);
    writeFileSync(ENV_PATH, core.serializeEnv(merged));

    if (github.configured) printPatLinkAndNote();
    console.log(`\n.env written to ${ENV_PATH}`);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
