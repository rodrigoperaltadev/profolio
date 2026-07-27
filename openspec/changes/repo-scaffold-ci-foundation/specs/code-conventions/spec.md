# Code Conventions Specification

## Purpose

Documents the project's clean-code/SOLID conventions and wires the mechanically-enforceable subset into the shared lint step, so conventions are discoverable and, where possible, automatically enforced.

## Requirements

### Requirement: Documented Conventions

The system MUST provide a `CLAUDE.md` file documenting naming conventions, Single Responsibility Principle (SRP) guidance, function/file complexity limits, and dependency-injection (DI) conventions.

#### Scenario: Conventions are discoverable

- GIVEN a contributor opens `CLAUDE.md`
- WHEN they read it
- THEN they find documented guidance for naming, SRP, complexity limits, and DI conventions

### Requirement: Mechanical vs. Guidance Split

`CLAUDE.md` MUST explicitly label each documented convention as either "mechanically enforced by linter" or "guidance only (requires human review)", and MUST NOT claim linter enforcement for a rule that is not actually wired into `eslint.config.js`.

#### Scenario: Split is explicit and accurate

- GIVEN the mechanical ESLint rules active in `eslint.config.js` (e.g. naming-convention, complexity, max-lines-per-function, relevant sonarjs/import-boundary rules)
- WHEN cross-checked against `CLAUDE.md`'s "mechanically enforced" list
- THEN every rule listed as mechanically enforced has a corresponding active ESLint rule, and every guidance-only item is not claimed as enforced

#### Scenario: Non-mechanical SOLID guidance is not overclaimed

- GIVEN a reader checks `CLAUDE.md` for true SRP, abstraction quality, or DI design-quality claims
- WHEN they compare it against the ESLint rule set
- THEN these items are labeled guidance-only, not mechanically enforced

### Requirement: Mechanical Subset Wired Into Lint Step

The system MUST wire the mechanically-enforceable subset of conventions (naming, complexity thresholds, max lines per function, import-boundary/DI-adjacent restrictions) into the same `eslint.config.js` used by the CI lint step, not a separate or unenforced config.

#### Scenario: Mechanical violation fails CI

- GIVEN a sample function exceeding the configured complexity or max-lines-per-function limit
- WHEN the CI lint step runs
- THEN the lint step fails, blocking the change

#### Scenario: Compliant code passes

- GIVEN code conforming to the naming, complexity, and import-boundary rules
- WHEN the CI lint step runs
- THEN it passes with no violations related to these rules
