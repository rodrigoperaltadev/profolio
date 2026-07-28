// Local-dev fallback used when publishing env vars are absent — see
// design.md's Interfaces/Contracts and the spec's "LocalFsContentWriterAdapter
// Implements ContentWriter" requirement. Writes go straight to disk via
// `fs/promises`; this adapter performs no git operation whatsoever.
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseFrontmatter } from "./parse-frontmatter";
import { sanitizeError } from "./sanitize-error";
import { buildMarkdownFile } from "./frontmatter";
import { buildContentPath } from "./content-path";
import type { ContentWriter, WriteEntryInput, WriteResult } from "./content-writer";

export interface LocalFsContentWriterConfig {
  readonly projectRoot: string; // defaults to process.cwd(), same injection idiom as fetchFn
}

type WriteMode = "create" | "edit";

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export class LocalFsContentWriterAdapter implements ContentWriter {
  constructor(
    private readonly config: LocalFsContentWriterConfig = {
      projectRoot: process.cwd(),
    },
  ) {}

  async create(input: WriteEntryInput): Promise<WriteResult> {
    return this.write(input, "create");
  }

  async edit(input: WriteEntryInput): Promise<WriteResult> {
    return this.write(input, "edit");
  }

  private branchingError(mode: WriteMode, exists: boolean): WriteResult | null {
    if (mode === "create" && exists) {
      return {
        ok: false,
        error: { kind: "conflict", message: "file already exists" },
      };
    }
    if (mode === "edit" && !exists) {
      return { ok: false, error: { kind: "not-found", message: "no file to edit" } };
    }
    return null;
  }

  private async write(input: WriteEntryInput, mode: WriteMode): Promise<WriteResult> {
    const parsed = parseFrontmatter(input.collection, input.frontmatter);
    if (!parsed.ok) {
      return { ok: false, error: { kind: "validation", message: parsed.error } };
    }
    const absPath = join(
      this.config.projectRoot,
      buildContentPath(input.collection, input.slug),
    );
    const exists = await fileExists(absPath);
    const branchError = this.branchingError(mode, exists);
    if (branchError) {
      return branchError;
    }
    try {
      await mkdir(dirname(absPath), { recursive: true });
      await writeFile(absPath, buildMarkdownFile(parsed.data, input.body), "utf-8");
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: { kind: "api-error", status: 0, message: sanitizeError(err, []) },
      };
    }
  }
}
