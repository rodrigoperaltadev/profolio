import { z } from "zod";
import { describe, expect, it } from "vitest";
import { parseEntry } from "./validate-entry";

const schema = z.object({ title: z.string() });

describe("parseEntry", () => {
  it("returns ok: true with the parsed data when input is valid", () => {
    const result = parseEntry(schema, { title: "Hello World" });

    expect(result).toEqual({ ok: true, data: { title: "Hello World" } });
  });

  it("returns ok: false with an error message when input is invalid", () => {
    const result = parseEntry(schema, { title: 42 });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe("string");
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});
