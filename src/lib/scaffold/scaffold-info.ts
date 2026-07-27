// SCAFFOLD PLACEHOLDER — delete once real feature code exists (see openspec issue #1).
//
// This module's sole purpose is to give the Vitest coverage gate a real,
// non-trivial unit to measure while the scaffold has no feature code yet.
// See AGENTS.md's Scaffold Note (added in Phase 5) for the full rationale.
//
// DEVIATION from design.md's Interfaces pseudocode: the literal
// `return { name: pkg.name, version: pkg.version }` pass-through has zero
// conditional branches, which makes branch coverage vacuously 0/0 (passes
// the threshold without measuring anything real — the exact failure mode
// the "Demonstrable Placeholder Module" spec requirement guards against).
// One defensive branch (blank-name fallback) is added so branch coverage is
// a genuine, exercised measurement. Public shape (`ScaffoldInfo`,
// `getScaffoldInfo`) is unchanged.

export interface ScaffoldInfo {
  readonly name: string;
  readonly version: string;
}

export function getScaffoldInfo(pkg: {
  name: string;
  version: string;
}): ScaffoldInfo {
  const name = pkg.name.trim().length > 0 ? pkg.name.trim() : "unknown";
  return { name, version: pkg.version };
}
