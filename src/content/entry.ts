// The single contract `src/presentation/**` may import — see design.md's
// Architecture Decisions: "Shared shape ownership" and "Facet unification".
export interface ContentEntry {
  readonly id: string;
  readonly title: string;
  readonly date: Date;
  readonly draft: boolean;
  readonly tags: readonly string[];
  readonly link?: string;
  readonly body: string;
}
