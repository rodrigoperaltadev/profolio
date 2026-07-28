import { describe, expect, it } from "vitest";
import { sanitizeError } from "./sanitize-error";

const FAKE_TOKEN = "ghp_fakeTokenValue1234567890";
const REDACTED = "[REDACTED]";

describe("sanitizeError", () => {
  it("replaces a secret present in the message with [REDACTED]", () => {
    const err = new Error(`request failed: token ${FAKE_TOKEN} is invalid`);

    const message = sanitizeError(err, [FAKE_TOKEN]);

    expect(message).not.toContain(FAKE_TOKEN);
    expect(message).toContain(REDACTED);
  });

  it("passes the message through unchanged when the secret is absent", () => {
    const err = new Error("request failed: not found");

    const message = sanitizeError(err, [FAKE_TOKEN]);

    expect(message).toBe("request failed: not found");
  });

  it("passes the message through unchanged when the secrets list is empty", () => {
    const err = new Error(`request failed: token ${FAKE_TOKEN} is invalid`);

    const message = sanitizeError(err, []);

    expect(message).toBe(`request failed: token ${FAKE_TOKEN} is invalid`);
  });

  it("stringifies a non-Error value before redacting", () => {
    const message = sanitizeError(`raw failure with ${FAKE_TOKEN}`, [FAKE_TOKEN]);

    expect(message).not.toContain(FAKE_TOKEN);
    expect(message).toContain(REDACTED);
  });

  it("ignores an empty-string secret while still redacting a real one", () => {
    const err = new Error(`request failed: token ${FAKE_TOKEN} is invalid`);

    const message = sanitizeError(err, ["", FAKE_TOKEN]);

    expect(message).not.toContain(FAKE_TOKEN);
    expect(message).toContain(REDACTED);
  });
});
