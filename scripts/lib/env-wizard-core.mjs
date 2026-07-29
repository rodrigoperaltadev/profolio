// Pure logic for the env var setup wizard: `.env` parse/merge/serialize,
// field validators, PAT-link builder, and admin token generator. No fs, no
// readline, no `process.env` reads — see design.md's "Interfaces /
// Contracts" and the spec's "CLI Entry Point and Testable Core Module" and
// "Idempotency Check Never Reads process.env" requirements.
import { randomBytes } from "node:crypto";

const ENTRY_LINE_PATTERN = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

function stripSurroundingQuotes(value) {
  if (value.length < 2) return value;
  const first = value[0];
  const last = value[value.length - 1];
  const isDoubleQuoted = first === '"' && last === '"';
  const isSingleQuoted = first === "'" && last === "'";
  return isDoubleQuoted || isSingleQuoted ? value.slice(1, -1) : value;
}

function parseLine(raw) {
  const trimmed = raw.trim();
  if (trimmed === "" || trimmed.startsWith("#")) {
    return { type: "raw", raw };
  }
  const match = ENTRY_LINE_PATTERN.exec(raw);
  if (!match) {
    return { type: "raw", raw };
  }
  const [, key, rawValue] = match;
  return { type: "entry", key, value: stripSurroundingQuotes(rawValue), raw };
}

// `EnvLine = { type: "raw", raw } | { type: "entry", key, value, raw }` — see
// design.md's ".env parse model" decision. Splitting on a single trailing
// newline (rather than every line ending) keeps `serializeEnv` a clean
// inverse: re-joining with "\n" and adding one trailing "\n" reproduces the
// original text exactly, including any interior blank lines.
export function parseEnvFile(text) {
  const withoutTrailingNewline = text.endsWith("\n") ? text.slice(0, -1) : text;
  const rawLines = withoutTrailingNewline === "" ? [""] : withoutTrailingNewline.split("\n");
  return rawLines.map(parseLine);
}

export function getEntryValue(lines, key) {
  const found = lines.find((line) => line.type === "entry" && line.key === key);
  return found?.value;
}

// Table-driven per design.md: updates an existing key, appends a brand-new
// key, leaves keys absent from `answers` untouched, and never rewrites
// `{type:"raw"}` lines (comments, blank lines) — see the spec's "Idempotent
// .env Handling" and "Unrelated existing keys are never touched" scenarios.
export function mergeEnvEntries(lines, answers) {
  const seenKeys = new Set();
  const updated = lines.map((line) => {
    if (line.type !== "entry") return line;
    seenKeys.add(line.key);
    if (!Object.hasOwn(answers, line.key) || answers[line.key] === undefined) return line;
    const value = answers[line.key];
    return { type: "entry", key: line.key, value, raw: `${line.key}=${value}` };
  });

  const appended = Object.entries(answers)
    .filter(([key, value]) => value !== undefined && !seenKeys.has(key))
    .map(([key, value]) => ({ type: "entry", key, value, raw: `${key}=${value}` }));

  return [...updated, ...appended];
}

export function serializeEnv(lines) {
  return `${lines.map((line) => line.raw).join("\n")}\n`;
}

const MASK_VISIBLE_CHARS = 4;
const MASK_FULL_THRESHOLD = 8;

// Boundary rule per design.md: values of 8 chars or fewer are fully masked
// (showing 4+4 would reveal the entire short value or overlap); longer
// values show first/last 4 chars so the operator can recognize *which*
// secret it is without echoing it in full. See spec's "Existing secret is
// shown masked".
export function maskSecret(value) {
  if (value.length <= MASK_FULL_THRESHOLD) {
    return "*".repeat(value.length);
  }
  const first = value.slice(0, MASK_VISIBLE_CHARS);
  const last = value.slice(-MASK_VISIBLE_CHARS);
  const maskedLength = value.length - MASK_VISIBLE_CHARS * 2;
  return `${first}${"*".repeat(maskedLength)}${last}`;
}

export function isNonEmpty(value) {
  return value.trim().length > 0;
}

const GITHUB_TOKEN_PREFIXES = ["ghp_", "github_pat_", "gho_", "ghu_", "ghs_", "ghr_"];

export function looksLikeGithubToken(value) {
  return GITHUB_TOKEN_PREFIXES.some((prefix) => value.startsWith(prefix));
}

// GitHub owner/repo slug shape: alphanumeric, may contain `-`, `_`, `.`
// after the first character, which must be alphanumeric. Local format check
// only — see spec's "Format and Presence Validation Only" (no network call).
const REPO_SLUG_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function isRepoSlug(value) {
  return REPO_SLUG_PATTERN.test(value);
}

const ADMIN_TOKEN_BYTES = 32;

export function generateAdminToken() {
  return randomBytes(ADMIN_TOKEN_BYTES).toString("hex");
}

const PAT_TEMPLATE_BASE_URL = "https://github.com/settings/personal-access-tokens/new";

// Only confirmed query params are included — no repo-scoping param, since
// per-repo pre-fill was never confirmed during exploration. See design.md's
// "PAT link params" decision and the spec's "Honest PAT Template Link".
export function buildPatTemplateUrl({ name, description }) {
  const params = new URLSearchParams({ name, description, contents: "write" });
  return `${PAT_TEMPLATE_BASE_URL}?${params.toString()}`;
}
