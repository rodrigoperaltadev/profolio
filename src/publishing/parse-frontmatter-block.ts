// Production-grade reverse parser for the exact minimal-YAML grammar
// `buildMarkdownFile()` emits (see ./frontmatter.ts) — promoted from the
// test-only reverse parsers that used to live in frontmatter.test.ts, per
// design.md's Architecture Decisions: "Import parsing". Scoped strictly to
// this app's own deterministic output grammar: quoted scalars, bare
// booleans, empty/non-empty string-array blocks (`- "item"`), and the
// nested link-array block (`- label: "..."\n  url: "..."`). Deliberately
// NOT a general YAML parser — this repo's explicit zero-new-YAML-dependency
// precedent means import only ever needs to reverse this app's own output,
// never arbitrary hand-authored YAML. Malformed/hand-edited input always
// returns a clean `{ ok: false, error }` result, never throws.
import type { ParseResult } from "../content/validate-entry";

const FRONTMATTER_DELIMITER = "---";
const HEADER = `${FRONTMATTER_DELIMITER}\n`;
const CLOSING_MARKER = `\n${FRONTMATTER_DELIMITER}\n\n`;
const ARRAY_ITEM_PREFIX = "  - ";
const LINK_LABEL_PREFIX = "  - label: ";
const LINK_URL_PREFIX = "    url: ";

export interface ParsedFrontmatterBlock {
  readonly frontmatter: Record<string, unknown>;
  readonly body: string;
}

interface UnquotedToken {
  readonly ok: true;
  readonly value: string;
}

interface UnquoteFailure {
  readonly ok: false;
}

function unquoteYamlString(raw: string): UnquotedToken | UnquoteFailure {
  const trimmed = raw.trim();
  if (trimmed.length < 2 || !trimmed.startsWith('"') || !trimmed.endsWith('"')) {
    return { ok: false };
  }
  const inner = trimmed.slice(1, -1);
  return { ok: true, value: inner.replace(/\\"/g, '"').replace(/\\\\/g, "\\") };
}

interface ParsedScalar {
  readonly ok: true;
  readonly value: unknown;
}

function parseScalarToken(raw: string): ParsedScalar | UnquoteFailure {
  const trimmed = raw.trim();
  if (trimmed === "true") {
    return { ok: true, value: true };
  }
  if (trimmed === "false") {
    return { ok: true, value: false };
  }
  if (trimmed === "[]") {
    return { ok: true, value: [] };
  }
  return unquoteYamlString(trimmed);
}

interface LinkEntry {
  readonly label: string;
  readonly url: string;
}

type ArrayMode = "string" | "link" | null;

// One mutable pass over the frontmatter lines, split into small per-line-
// shape handlers to keep each method's complexity/depth low — a single
// flat function covering all four line shapes (key, array item, link
// label, link url) would exceed this repo's complexity/depth lint budget.
class FrontmatterLinesParser {
  private readonly frontmatter: Record<string, unknown> = {};
  private currentKey: string | null = null;
  private arrayMode: ArrayMode = null;
  private stringItems: string[] = [];
  private linkItems: LinkEntry[] = [];
  private pendingLabel: string | null = null;
  private error: string | null = null;

  parse(lines: readonly string[]): ParseResult<Record<string, unknown>> {
    for (const line of lines) {
      if (this.error !== null) {
        break;
      }
      this.consumeLine(line);
    }
    if (this.error === null) {
      this.flush();
    }
    return this.error === null
      ? { ok: true, data: this.frontmatter }
      : { ok: false, error: this.error };
  }

  private consumeLine(line: string): void {
    if (line.startsWith(LINK_LABEL_PREFIX)) {
      this.consumeLinkLabel(line);
      return;
    }
    if (line.startsWith(LINK_URL_PREFIX)) {
      this.consumeLinkUrl(line);
      return;
    }
    if (line.startsWith(ARRAY_ITEM_PREFIX)) {
      this.consumeArrayItem(line);
      return;
    }
    this.consumeKeyLine(line);
  }

  private consumeLinkLabel(line: string): void {
    if (this.currentKey === null || this.arrayMode === "string") {
      this.error = "Link entry found without a compatible array key";
      return;
    }
    if (this.pendingLabel !== null) {
      this.error = `Malformed link entry for key "${this.currentKey}": label without a matching url`;
      return;
    }
    const parsedLabel = unquoteYamlString(line.slice(LINK_LABEL_PREFIX.length));
    if (!parsedLabel.ok) {
      this.error = `Malformed label value for key "${this.currentKey}"`;
      return;
    }
    this.arrayMode = "link";
    this.pendingLabel = parsedLabel.value;
  }

  private consumeLinkUrl(line: string): void {
    if (this.currentKey === null || this.pendingLabel === null) {
      this.error = "Malformed link entry: url found without a preceding label";
      return;
    }
    const parsedUrl = unquoteYamlString(line.slice(LINK_URL_PREFIX.length));
    if (!parsedUrl.ok) {
      this.error = `Malformed url value for key "${this.currentKey}"`;
      return;
    }
    this.linkItems.push({ label: this.pendingLabel, url: parsedUrl.value });
    this.pendingLabel = null;
  }

  private consumeArrayItem(line: string): void {
    if (this.currentKey === null || this.arrayMode === "link") {
      this.error = "Array item found without a compatible array key";
      return;
    }
    const parsedItem = unquoteYamlString(line.slice(ARRAY_ITEM_PREFIX.length));
    if (!parsedItem.ok) {
      this.error = `Malformed array item for key "${this.currentKey}"`;
      return;
    }
    this.arrayMode = "string";
    this.stringItems.push(parsedItem.value);
  }

  private consumeKeyLine(line: string): void {
    this.flush();
    if (this.error !== null) {
      return;
    }
    const separatorIndex = line.indexOf(": ");
    if (separatorIndex === -1) {
      this.consumeDanglingArrayKey(line);
      return;
    }
    const key = line.slice(0, separatorIndex);
    const parsedScalar = parseScalarToken(line.slice(separatorIndex + 2));
    if (!parsedScalar.ok) {
      this.error = `Malformed value for key "${key}"`;
      return;
    }
    this.frontmatter[key] = parsedScalar.value;
  }

  private consumeDanglingArrayKey(line: string): void {
    if (line.length < 2 || !line.endsWith(":")) {
      this.error = `Malformed frontmatter line: "${line}"`;
      return;
    }
    this.currentKey = line.slice(0, -1);
  }

  private flush(): void {
    if (this.currentKey === null) {
      return;
    }
    if (this.arrayMode === "link" && this.pendingLabel !== null) {
      this.error = `Malformed link entry for key "${this.currentKey}": label without a matching url`;
      return;
    }
    this.frontmatter[this.currentKey] =
      this.arrayMode === "link" ? this.linkItems : this.stringItems;
    this.currentKey = null;
    this.arrayMode = null;
    this.stringItems = [];
    this.linkItems = [];
  }
}

function splitFrontmatterBoundaries(
  markdown: string,
): ParseResult<{ block: string; body: string }> {
  if (!markdown.startsWith(HEADER)) {
    return { ok: false, error: "Missing opening frontmatter delimiter" };
  }
  const rest = markdown.slice(HEADER.length);
  const closingIndex = rest.indexOf(CLOSING_MARKER);
  if (closingIndex === -1) {
    return { ok: false, error: "Missing closing frontmatter delimiter" };
  }
  return {
    ok: true,
    data: {
      block: rest.slice(0, closingIndex),
      body: rest.slice(closingIndex + CLOSING_MARKER.length),
    },
  };
}

export function parseFrontmatterBlock(
  markdown: string,
): ParseResult<ParsedFrontmatterBlock> {
  const boundaries = splitFrontmatterBoundaries(markdown);
  if (!boundaries.ok) {
    return boundaries;
  }
  const lines =
    boundaries.data.block.length === 0 ? [] : boundaries.data.block.split("\n");
  const parsedLines = new FrontmatterLinesParser().parse(lines);
  if (!parsedLines.ok) {
    return parsedLines;
  }
  return {
    ok: true,
    data: { frontmatter: parsedLines.data, body: boundaries.data.body },
  };
}
