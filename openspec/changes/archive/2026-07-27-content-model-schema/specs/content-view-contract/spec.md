# Content View Contract Specification

## Purpose

Defines the shared, generic display-shape type and the `src/content/**` mapper that produces it from any collection's Zod-inferred type. This is the single contract `src/presentation/**` is allowed to depend on, making content-agnosticism structurally provable rather than a matter of convention.

## Requirements

### Requirement: Shared Entry Contract Type

The system MUST define exactly one shared, generic type representing a displayable content entry, and this type MUST NOT expose any field name specific to a single collection (e.g. no `stack`, no `link`, no raw `tags`-as-posts-only semantics baked into the type name or shape).

#### Scenario: One shared type serves both collections

- GIVEN the shared entry contract type exported from `src/content/**`
- WHEN a `posts` entry and a `projects` entry are each mapped
- THEN both mapped results satisfy the same shared type with no collection-specific field required by only one of them

### Requirement: Per-Collection Mapper Functions

For each registered collection, `src/content/**` MUST provide a mapper function that converts that collection's Zod-inferred entry type into the shared entry contract type.

#### Scenario: Posts mapper produces the shared shape

- GIVEN a valid, schema-validated `posts` entry
- WHEN the posts mapper function is called with that entry
- THEN it returns a value conforming to the shared entry contract type

#### Scenario: Projects mapper produces the shared shape

- GIVEN a valid, schema-validated `projects` entry
- WHEN the projects mapper function is called with that entry
- THEN it returns a value conforming to the shared entry contract type

### Requirement: Presentation Layer Depends Only on the Shared Contract

`src/presentation/**` code MUST import only the shared entry contract type and mapper output; it MUST NOT import or reference `posts`- or `projects`-specific field names or collection-specific schema types.

#### Scenario: Sample presentation code proves agnosticism

- GIVEN sample `src/presentation/**` code added to demonstrate the contract
- WHEN that code renders an entry
- THEN it references only fields defined on the shared entry contract type, and `eslint .` (via the existing `boundaries/element-types` rule restricting `view` to `[lib, content]`) passes with no exceptions added

### Requirement: New Collections Require No View-Layer Control Flow

Adding a third, structurally different collection MUST require only a new `defineCollection` + Zod schema block in `src/content/config.ts` plus one new mapping entry in the mapper; it MUST NOT require new conditional or branching logic in `src/presentation/**` or elsewhere outside `src/content/**`.

#### Scenario: Third collection needs no presentation changes

- GIVEN a hypothetical third collection is added via a new schema block and a corresponding mapper entry
- WHEN `src/presentation/**` code that consumes the shared entry contract type is left unchanged
- THEN it continues to compile and render entries from the new collection without modification

### Requirement: Mapper Unit Test Coverage

Each mapper function MUST have unit tests covering the happy path (valid entry maps to the shared shape) and the validation-failure path (an entry that fails its collection's Zod schema is rejected before mapping), contributing to the repository's 80% coverage gate.

#### Scenario: Mapper happy path is tested

- GIVEN a valid entry for a given collection
- WHEN the mapper's unit test runs
- THEN it asserts the output matches the shared entry contract shape

#### Scenario: Mapper validation-failure path is tested

- GIVEN an entry that fails Zod schema validation for its collection
- WHEN the corresponding unit test runs
- THEN it asserts the schema rejects the entry before any mapping occurs
