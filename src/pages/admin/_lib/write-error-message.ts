// Maps ContentWriter's typed WriteError to a plain user-facing message — see
// the spec's "Stale-SHA conflict is shown as a plain message" scenario and
// the Admin Entry Creation and Editing requirement's "plain user-facing
// message rather than an unhandled exception" wording.
import type { WriteError } from "../../../publishing/content-writer";

export function writeErrorMessage(error: WriteError): string {
  switch (error.kind) {
    case "validation":
      return `Invalid entry: ${error.message}`;
    case "conflict":
      return "This entry changed since you loaded it. Reload and try again.";
    case "not-found":
      return "This entry no longer exists.";
    case "api-error":
      return "Something went wrong saving this entry. Please try again.";
  }
}
