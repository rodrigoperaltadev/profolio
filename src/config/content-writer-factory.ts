// Composition-root adapter selection — see design.md's Interfaces/Contracts
// and the spec's "Composition-Root Adapter Selection Factory" requirement.
// This is the only module that decides which `ContentWriter` implementation
// a caller gets; nothing outside `src/config/**` makes that decision.
import { GithubContentWriterAdapter } from "../publishing/github-content-writer-adapter";
import { LocalFsContentWriterAdapter } from "../publishing/local-fs-content-writer-adapter";
import { isPublishingConfigured, loadPublishingConfig } from "./publishing-config";
import type { ContentWriter } from "../publishing/content-writer";

export function createContentWriter(): ContentWriter {
  return isPublishingConfigured()
    ? new GithubContentWriterAdapter(loadPublishingConfig())
    : new LocalFsContentWriterAdapter();
}
