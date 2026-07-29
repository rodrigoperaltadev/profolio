// Pure, unit-tested core for the env var setup wizard. See design.md's
// "Interfaces / Contracts" (exact function signatures) and its `.env` parse
// model decision (line-based `EnvLine`, not a plain key/value map) — a map
// would lose comments/blank lines/unrelated-key formatting, which this
// module's round-trip tests below exist specifically to prove is preserved.
import { describe, expect, it } from "vitest";
import {
  buildPatTemplateUrl,
  generateAdminToken,
  getEntryValue,
  isNonEmpty,
  isRepoSlug,
  looksLikeGithubToken,
  maskSecret,
  mergeEnvEntries,
  parseEnvFile,
  serializeEnv,
} from "./env-wizard-core.mjs";

const THEME_KEY = "THEME_PRESET";
const THEME_DEFAULT = "brutalist";
const THEME_UPDATED = "modern";
const THEME_ENTRY_LINE = `${THEME_KEY}=${THEME_DEFAULT}`;
const THEME_ENTRY = { type: "entry", key: THEME_KEY, value: THEME_DEFAULT, raw: THEME_ENTRY_LINE };

const GITHUB_TOKEN_KEY = "GITHUB_TOKEN";
const GITHUB_TOKEN_VALUE = "ghp_original";
const GITHUB_TOKEN_LINE = `${GITHUB_TOKEN_KEY}=${GITHUB_TOKEN_VALUE}`;
const GITHUB_TOKEN_ENTRY = {
  type: "entry",
  key: GITHUB_TOKEN_KEY,
  value: GITHUB_TOKEN_VALUE,
  raw: GITHUB_TOKEN_LINE,
};

const REPO_OWNER_KEY = "GITHUB_REPO_OWNER";
const REPO_OWNER_VALUE = "acme";
const REPO_OWNER_LINE = `${REPO_OWNER_KEY}=${REPO_OWNER_VALUE}`;

const COMMENT_LINE = "# a comment";
const EMPTY_STRING_CASE_LABEL = "empty string";

function rawLine(raw) {
  return { type: "raw", raw };
}

describe("parseEnvFile — entry lines", () => {
  it("parses a KEY=value line as an entry with the raw text preserved", () => {
    expect(parseEnvFile(REPO_OWNER_LINE)).toEqual([
      { type: "entry", key: REPO_OWNER_KEY, value: REPO_OWNER_VALUE, raw: REPO_OWNER_LINE },
    ]);
  });

  it("strips surrounding double quotes from the value", () => {
    const quoted = `${THEME_KEY}="${THEME_DEFAULT}"`;

    expect(parseEnvFile(quoted)).toEqual([
      { type: "entry", key: THEME_KEY, value: THEME_DEFAULT, raw: quoted },
    ]);
  });

  it("strips surrounding single quotes from the value", () => {
    const quoted = `${THEME_KEY}='${THEME_DEFAULT}'`;

    expect(parseEnvFile(quoted)).toEqual([
      { type: "entry", key: THEME_KEY, value: THEME_DEFAULT, raw: quoted },
    ]);
  });

  it("leaves a too-short value (below the 2-char quote-pair minimum) unstripped", () => {
    expect(parseEnvFile("EMPTY_VALUE=")).toEqual([
      { type: "entry", key: "EMPTY_VALUE", value: "", raw: "EMPTY_VALUE=" },
    ]);
  });
});

describe("parseEnvFile — raw passthrough lines", () => {
  it("treats a comment line as a raw passthrough", () => {
    expect(parseEnvFile(COMMENT_LINE)).toEqual([rawLine(COMMENT_LINE)]);
  });

  it("treats a blank line as a raw passthrough", () => {
    expect(parseEnvFile("")).toEqual([rawLine("")]);
  });

  it("treats a malformed non-KEY=value line as a raw passthrough", () => {
    const malformed = "not a valid line";

    expect(parseEnvFile(malformed)).toEqual([rawLine(malformed)]);
  });

  it("handles a trailing newline in the source text without adding an extra blank line", () => {
    expect(parseEnvFile(`${THEME_ENTRY_LINE}\n`)).toEqual([THEME_ENTRY]);
  });
});

describe("parseEnvFile — line order", () => {
  it("preserves order across mixed entry/comment/blank lines", () => {
    const text = ["# header comment", "", GITHUB_TOKEN_LINE, THEME_ENTRY_LINE].join("\n");

    expect(parseEnvFile(text)).toEqual([
      rawLine("# header comment"),
      rawLine(""),
      GITHUB_TOKEN_ENTRY,
      THEME_ENTRY,
    ]);
  });
});

describe("getEntryValue", () => {
  it("returns the value for an existing key", () => {
    const lines = parseEnvFile(`${REPO_OWNER_LINE}\n${THEME_ENTRY_LINE}`);

    expect(getEntryValue(lines, REPO_OWNER_KEY)).toBe(REPO_OWNER_VALUE);
  });

  it("returns undefined for a missing key", () => {
    const lines = parseEnvFile(REPO_OWNER_LINE);

    expect(getEntryValue(lines, GITHUB_TOKEN_KEY)).toBeUndefined();
  });
});

describe("mergeEnvEntries", () => {
  it("updates the value of an existing key", () => {
    const lines = parseEnvFile(THEME_ENTRY_LINE);

    const result = mergeEnvEntries(lines, { [THEME_KEY]: THEME_UPDATED });

    expect(result).toEqual([
      { type: "entry", key: THEME_KEY, value: THEME_UPDATED, raw: `${THEME_KEY}=${THEME_UPDATED}` },
    ]);
  });

  it("appends a brand-new key not present in the original lines", () => {
    const lines = parseEnvFile(THEME_ENTRY_LINE);
    const newValue = "ghp_abc123";

    const result = mergeEnvEntries(lines, { [GITHUB_TOKEN_KEY]: newValue });

    expect(result).toEqual([
      THEME_ENTRY,
      { type: "entry", key: GITHUB_TOKEN_KEY, value: newValue, raw: `${GITHUB_TOKEN_KEY}=${newValue}` },
    ]);
  });

  it("leaves keys absent from answers untouched", () => {
    const lines = parseEnvFile(`${THEME_ENTRY_LINE}\n${GITHUB_TOKEN_LINE}`);

    const result = mergeEnvEntries(lines, { [THEME_KEY]: THEME_UPDATED });

    expect(result).toEqual([
      { type: "entry", key: THEME_KEY, value: THEME_UPDATED, raw: `${THEME_KEY}=${THEME_UPDATED}` },
      GITHUB_TOKEN_ENTRY,
    ]);
  });

  it("leaves every raw line (comments, blank lines, unrelated keys) byte-for-byte unchanged", () => {
    const unrelatedLine = "UNRELATED_KEY=keep-me";
    const original = [COMMENT_LINE, "", unrelatedLine, THEME_ENTRY_LINE].join("\n");
    const lines = parseEnvFile(original);

    const result = mergeEnvEntries(lines, { [THEME_KEY]: THEME_UPDATED });

    expect(result[0]).toEqual(rawLine(COMMENT_LINE));
    expect(result[1]).toEqual(rawLine(""));
    expect(result[2]).toEqual({
      type: "entry",
      key: "UNRELATED_KEY",
      value: "keep-me",
      raw: unrelatedLine,
    });
  });
});

describe("serializeEnv", () => {
  it("round-trips parseEnvFile output back to text with a trailing newline", () => {
    const text = `${THEME_ENTRY_LINE}\n${GITHUB_TOKEN_LINE}`;

    expect(serializeEnv(parseEnvFile(text))).toBe(`${text}\n`);
  });

  it("preserves comments, blank lines, and unrelated keys through a full parse-merge-serialize round trip", () => {
    const unrelatedLine = "UNRELATED_KEY=keep-me";
    const original = ["# setup wizard env", "", unrelatedLine, THEME_ENTRY_LINE, GITHUB_TOKEN_LINE].join(
      "\n",
    );

    const result = serializeEnv(mergeEnvEntries(parseEnvFile(original), { [THEME_KEY]: THEME_UPDATED }));

    expect(result).toBe(
      [
        "# setup wizard env",
        "",
        unrelatedLine,
        `${THEME_KEY}=${THEME_UPDATED}`,
        GITHUB_TOKEN_LINE,
        "",
      ].join("\n"),
    );
  });
});

describe("maskSecret", () => {
  it.each([
    ["", "", "empty value stays empty"],
    ["a", "*", "1-char value fully masked"],
    ["1234567", "*******", "7-char value (below threshold) fully masked"],
    ["12345678", "********", "exactly 8-char value fully masked (boundary)"],
    ["123456789", "1234*6789", "9-char value (above threshold) shows first/last 4"],
    ["ghp_fakeToken1234567890", "ghp_***************7890", "long token shows first/last 4"],
  ])("masks %j as %j (%s)", (value, expected) => {
    expect(maskSecret(value)).toBe(expected);
  });
});

describe("isNonEmpty", () => {
  it.each([
    [REPO_OWNER_VALUE, true, "non-empty string"],
    ["", false, EMPTY_STRING_CASE_LABEL],
    ["   ", false, "whitespace-only string"],
  ])("isNonEmpty(%j) is %j (%s)", (value, expected) => {
    expect(isNonEmpty(value)).toBe(expected);
  });
});

describe("looksLikeGithubToken", () => {
  it.each([
    ["ghp_abc123", true, "classic PAT prefix"],
    ["github_pat_abc123", true, "fine-grained PAT prefix"],
    ["gho_abc123", true, "OAuth token prefix"],
    ["ghu_abc123", true, "user-to-server token prefix"],
    ["ghs_abc123", true, "server-to-server token prefix"],
    ["ghr_abc123", true, "refresh token prefix"],
    ["not-a-token", false, "no recognized prefix"],
    ["", false, EMPTY_STRING_CASE_LABEL],
  ])("looksLikeGithubToken(%j) is %j (%s)", (value, expected) => {
    expect(looksLikeGithubToken(value)).toBe(expected);
  });
});

describe("isRepoSlug", () => {
  it.each([
    [REPO_OWNER_VALUE, true, "simple alphanumeric slug"],
    ["my-repo", true, "hyphenated slug"],
    ["my_repo", true, "underscored slug"],
    ["my.repo", true, "dotted slug"],
    ["", false, EMPTY_STRING_CASE_LABEL],
    ["owner/repo", false, "contains a slash"],
    ["has space", false, "contains a space"],
    ["-leading-hyphen", false, "leading non-alphanumeric char"],
  ])("isRepoSlug(%j) is %j (%s)", (value, expected) => {
    expect(isRepoSlug(value)).toBe(expected);
  });
});

describe("generateAdminToken", () => {
  // Non-deterministic by design — assert length and hex format, never an
  // exact value. See design.md's Interfaces/Contracts:
  // `crypto.randomBytes(32).toString("hex")` → 32 bytes = 64 hex chars.
  it("generates a 64-character lowercase hex string", () => {
    const token = generateAdminToken();

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates a different token on each call (triangulation — not a hardcoded constant)", () => {
    expect(generateAdminToken()).not.toBe(generateAdminToken());
  });
});

describe("buildPatTemplateUrl", () => {
  it("includes only name, description, and contents=write — no repo-scoping parameter", () => {
    const patName = "profolio-setup-wizard";
    const patDescription = "Fine-grained token for profolio's setup wizard";

    const parsed = new URL(buildPatTemplateUrl({ name: patName, description: patDescription }));

    expect(parsed.origin + parsed.pathname).toBe(
      "https://github.com/settings/personal-access-tokens/new",
    );
    expect([...parsed.searchParams.keys()].sort()).toEqual(["contents", "description", "name"]);
    expect(parsed.searchParams.get("name")).toBe(patName);
    expect(parsed.searchParams.get("description")).toBe(patDescription);
    expect(parsed.searchParams.get("contents")).toBe("write");
  });
});
