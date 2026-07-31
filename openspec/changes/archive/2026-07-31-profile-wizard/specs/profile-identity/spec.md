# Profile Identity Specification

## Purpose

Defines the singleton `profile` Content Collection — the identity content every profolio clone needs on day one — its schema, its fixed-slug singleton convention, its dedicated (non-`ContentEntry`) read accessor, and the admin setup/edit UI plus first-run redirect that create, edit, and reset it via the existing `ContentWriter` port.

## Requirements

### Requirement: Profile Fields

The `profile` collection MUST define `name` (string), `role` (string), `bio` (string), `email` (string), and `links` (array of `{ label: string; url: string }` objects). It MUST NOT define an avatar/photo field.

#### Scenario: All fields are present on a valid profile

- GIVEN a `profile` entry with `name`, `role`, `bio`, `email`, and a `links` array of `{ label, url }` objects
- WHEN it is read via `getProfile()`
- THEN all five fields are present and typed on the returned value

#### Scenario: No avatar field exists

- GIVEN the `profile` schema
- WHEN inspected
- THEN no avatar/photo/image field is defined, consistent with this change's explicit deferral of binary-upload support

### Requirement: Fixed Slug Singleton Convention

Every write to the `profile` collection MUST target slug `"me"`; no code path MUST accept a caller-supplied profile slug. Reads MUST target the fixed slug directly rather than enumerating the collection.

#### Scenario: Write path hardcodes the slug

- GIVEN any admin write to the `profile` collection
- WHEN the write is invoked
- THEN the slug used is always `"me"`, never derived from request input

#### Scenario: Read accessor targets the fixed slug directly

- GIVEN `getProfile()` or the existence-check accessor
- WHEN it reads the `profile` collection
- THEN it looks up slug `"me"` directly rather than iterating all entries in the collection

### Requirement: Dedicated Profile Read Accessor

The system MUST provide a dedicated, directly-importable read function (e.g. `getProfile()`) that returns the `profile` entry (or an absent/not-found result) as a typed `Profile` value, consumable by `src/presentation/**` and future callers outside `src/pages/admin/**` without depending on `ContentEntry` or the shared mapper.

#### Scenario: Accessor returns the profile when it exists

- GIVEN a `profile` entry exists at slug `"me"`
- WHEN `getProfile()` is called
- THEN it returns a typed `Profile` value with all schema fields populated

#### Scenario: Accessor reports absence when no profile exists

- GIVEN no `profile` entry exists
- WHEN `getProfile()` (or its existence-check variant) is called
- THEN it returns a result indicating absence, without throwing

### Requirement: Profile Setup and Edit UI

The admin UI MUST provide a setup form (used when no profile exists) and an edit form (used once one does), both server-rendered native HTML forms consistent with the existing `posts`/`projects` admin patterns, submitting to the routes defined by `admin-authoring`'s profile setup/edit requirement.

#### Scenario: Setup form is shown before a profile exists

- GIVEN no `profile` entry exists
- WHEN the operator reaches the profile section of `/admin/**`
- THEN the setup form is rendered, not the edit form

#### Scenario: Edit form is shown once a profile exists

- GIVEN a `profile` entry exists
- WHEN the operator reaches the profile section of `/admin/**`
- THEN the edit form is rendered, pre-populated with the current values

### Requirement: Reset via Edit, No New Port Method

Resetting the profile ("wipe and start over") MUST be implemented as `ContentWriter.edit` with all fields set to empty/default values. This change MUST NOT introduce any new `ContentWriter` port method.

#### Scenario: Reset clears all fields

- GIVEN an existing `profile` entry with populated fields
- WHEN the operator submits the reset action
- THEN `edit()` is called with all fields reset to empty/default, and the entry continues to exist at slug `"me"` (not deleted)
