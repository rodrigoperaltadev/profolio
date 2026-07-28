// The only `process.env` read for the publishing layer — see design.md's
// Interfaces/Contracts. `GithubContentWriterAdapter` receives its config via
// constructor injection only (see the spec's "No Ambient Token Access in the
// Adapter" requirement); this is the composition-root boundary where the
// ambient environment is allowed to be read.
export interface PublishingConfig {
  readonly token: string;
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
}

const DEFAULT_BRANCH = "main";

export function loadPublishingConfig(): PublishingConfig {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo = process.env.GITHUB_REPO_NAME;
  if (!token || !owner || !repo) {
    throw new Error(
      "Missing required publishing config: GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME",
    );
  }
  return { token, owner, repo, branch: process.env.GITHUB_CONTENT_BRANCH ?? DEFAULT_BRANCH };
}
// Composition (future caller, e.g. issue #5):
//   const writer: ContentWriter = new GithubContentWriterAdapter(loadPublishingConfig());
