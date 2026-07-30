# Security Policy Specification

## Purpose

Documents the required content of `SECURITY.md`: rotation cadence and procedure for the project's two secrets (`GITHUB_TOKEN`, `ADMIN_ACCESS_TOKEN`), the interaction between revoking `ADMIN_ACCESS_TOKEN` and already-issued admin sessions, and vulnerability-reporting instructions. This is a documentation-only capability with no runtime enforcement.

## Requirements

### Requirement: Documented Secret Rotation Procedure

The system MUST provide a `SECURITY.md` file at the repository root documenting the rotation cadence and rotation procedure for both `GITHUB_TOKEN` and `ADMIN_ACCESS_TOKEN`.

#### Scenario: Rotation guidance is discoverable for both secrets

- GIVEN a contributor opens `SECURITY.md`
- WHEN they read it
- THEN they find a documented rotation cadence and procedure for `GITHUB_TOKEN` and a separate one for `ADMIN_ACCESS_TOKEN`

### Requirement: Documented Revoked-Secret-vs-Active-Session Interaction

`SECURITY.md` MUST explicitly state that revoking or rotating `ADMIN_ACCESS_TOKEN` does not retroactively invalidate session cookies already issued before the rotation; such sessions remain valid until their own expiry elapses.

#### Scenario: Interaction is stated plainly

- GIVEN a contributor reads `SECURITY.md`'s `ADMIN_ACCESS_TOKEN` rotation section
- WHEN they look for what happens to already-logged-in sessions after rotation
- THEN they find an explicit statement that those sessions remain valid until they individually expire

### Requirement: Vulnerability Reporting Instructions

`SECURITY.md` MUST document how to report a security vulnerability, including a contact channel or reporting mechanism (e.g. GitHub Security Advisory).

#### Scenario: Reporting path is discoverable

- GIVEN a security researcher or contributor wants to report a vulnerability
- WHEN they read `SECURITY.md`
- THEN they find a documented contact channel or reporting mechanism

### Requirement: No Over-Claiming of Enforcement

`SECURITY.md` MUST state that its rotation guidance is manual and documentation-only, and MUST NOT imply that rotation is automatically enforced or reminded by any tooling in this project.

#### Scenario: Manual nature is stated explicitly

- GIVEN a reader checks `SECURITY.md`'s rotation sections
- WHEN they look for any claim of automatic enforcement or reminders
- THEN they find none, and instead find an explicit statement that rotation is a manual, human-driven process
