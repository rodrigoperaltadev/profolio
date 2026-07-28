// Security-critical surface — see design.md's Interfaces/Contracts and the
// `edit()` sequence diagram. Every write funnels through exactly one
// `parseEntry()` call and exactly one sanitizing catch boundary; the token
// is only reachable via constructor injection (`config.token`), never
// `process.env`.
import { parseFrontmatter } from "./parse-frontmatter";
import { sanitizeError } from "./sanitize-error";
import { buildMarkdownFile } from "./frontmatter";
import { buildContentPath } from "./content-path";
import type {
  ContentWriter,
  WriteEntryInput,
  WriteResult,
} from "./content-writer";

export interface GithubContentWriterConfig {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
}

type WriteMode = "create" | "edit";

type ExistingFile =
  | { readonly exists: true; readonly sha: string }
  | { readonly exists: false };

const CONTENTS_API_BASE = "https://api.github.com/repos";
const SHA_CONFLICT_STATUS = 409;
const NOT_FOUND_STATUS = 404;

function encodeBase64(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64");
}

export class GithubContentWriterAdapter implements ContentWriter {
  constructor(
    private readonly config: GithubContentWriterConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async create(input: WriteEntryInput): Promise<WriteResult> {
    return this.write(input, "create");
  }

  async edit(input: WriteEntryInput): Promise<WriteResult> {
    return this.write(input, "edit");
  }

  private buildUrl(path: string): string {
    return `${CONTENTS_API_BASE}/${this.config.owner}/${this.config.repo}/contents/${path}`;
  }

  private buildHeaders(): Record<string, string> {
    // Bracket-notation writes (not object-literal properties) — HTTP header
    // names are not JS/TS identifiers and shouldn't be forced into camelCase.
    const headers: Record<string, string> = {};
    headers["Authorization"] = `Bearer ${this.config.token}`;
    headers["Accept"] = "application/vnd.github+json";
    return headers;
  }

  private async write(
    input: WriteEntryInput,
    mode: WriteMode,
  ): Promise<WriteResult> {
    const parsed = parseFrontmatter(input.collection, input.frontmatter);
    if (!parsed.ok) {
      return { ok: false, error: { kind: "validation", message: parsed.error } };
    }
    try {
      return await this.writeValidated(input, mode, parsed.data);
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: "api-error",
          status: 0,
          message: sanitizeError(err, [this.config.token]),
        },
      };
    }
  }

  private async getExisting(path: string): Promise<ExistingFile> {
    const response = await this.fetchFn(this.buildUrl(path), {
      method: "GET",
      headers: this.buildHeaders(),
    });
    if (response.status === NOT_FOUND_STATUS) {
      return { exists: false };
    }
    const body = (await response.json()) as { sha: string };
    return { exists: true, sha: body.sha };
  }

  private branchingError(
    mode: WriteMode,
    existing: ExistingFile,
  ): WriteResult | null {
    if (mode === "create" && existing.exists) {
      return {
        ok: false,
        error: { kind: "conflict", message: "file already exists" },
      };
    }
    if (mode === "edit" && !existing.exists) {
      return {
        ok: false,
        error: { kind: "not-found", message: "no file to edit" },
      };
    }
    return null;
  }

  private async putFile(
    path: string,
    input: WriteEntryInput,
    frontmatter: Record<string, unknown>,
    existing: ExistingFile,
  ): Promise<Response> {
    const content = buildMarkdownFile(frontmatter, input.body);
    const payload = {
      message: input.commitMessage,
      content: encodeBase64(content),
      branch: this.config.branch,
      ...(existing.exists ? { sha: existing.sha } : {}),
    };
    return this.fetchFn(this.buildUrl(path), {
      method: "PUT",
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });
  }

  private async readErrorMessage(response: Response): Promise<string> {
    const body = await response.text();
    return `GitHub API error ${String(response.status)}: ${body}`;
  }

  private async writeValidated(
    input: WriteEntryInput,
    mode: WriteMode,
    frontmatter: Record<string, unknown>,
  ): Promise<WriteResult> {
    const path = buildContentPath(input.collection, input.slug);
    const existing = await this.getExisting(path);

    const branchError = this.branchingError(mode, existing);
    if (branchError) {
      return branchError;
    }

    const response = await this.putFile(path, input, frontmatter, existing);
    if (response.status === SHA_CONFLICT_STATUS) {
      return { ok: false, error: { kind: "conflict", message: "sha conflict" } };
    }
    if (!response.ok) {
      const message = await this.readErrorMessage(response);
      return {
        ok: false,
        error: {
          kind: "api-error",
          status: response.status,
          message: sanitizeError(message, [this.config.token]),
        },
      };
    }
    return { ok: true };
  }
}
