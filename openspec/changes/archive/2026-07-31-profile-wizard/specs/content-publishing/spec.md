# Delta for Content Publishing

## MODIFIED Requirements

### Requirement: ContentWriter Port Contract

The system MUST define a `ContentWriter` TypeScript interface with exactly two operations, `create` and `edit`, both taking explicit `collection`, `slug`, and content parameters, where `collection` is typed as `"posts" | "projects" | "profile"`. The port MUST NOT infer a slug or file path from title/content, and MUST NOT expose an HTTP route or a `delete` operation.

(Previously: `collection` was typed as `"posts" | "projects"`; this change widens the union to include `"profile"`. No change to the two-operation shape.)

#### Scenario: Port shape has no inference

- GIVEN the `ContentWriter` interface
- WHEN a caller invokes `create` or `edit`
- THEN it must explicitly pass `collection`, `slug`, and the entry content — no method derives a slug or path from title or body

#### Scenario: No delete method exists

- GIVEN the `ContentWriter` interface
- WHEN inspecting its members
- THEN no `delete` operation is present

#### Scenario: Profile is a valid collection value

- GIVEN a `create` or `edit` call with `collection: "profile"`
- WHEN the call is type-checked and executed against any `ContentWriter` implementation
- THEN it is accepted as a valid `Collection` value, exactly as `"posts"` and `"projects"` already are, and no port method is added or removed to accommodate it
