import { describe, expect, it } from "vitest";
import { byDateDesc, takeRecent } from "./sort";

const JAN = new Date("2026-01-01");
const MAR = new Date("2026-03-01");
const JUN = new Date("2026-06-01");

describe("byDateDesc", () => {
  it("sorts a later date before an earlier date", () => {
    const earlier = { date: JAN };
    const later = { date: JUN };

    expect(byDateDesc(later, earlier)).toBeLessThan(0);
    expect(byDateDesc(earlier, later)).toBeGreaterThan(0);
  });

  it("returns 0 for equal dates", () => {
    const a = { date: new Date("2026-03-15") };
    const b = { date: new Date("2026-03-15") };

    expect(byDateDesc(a, b)).toBe(0);
  });

  it("sorts an already-descending array correctly", () => {
    const items = [{ date: JUN }, { date: MAR }, { date: JAN }];

    const sorted = [...items].sort(byDateDesc);

    expect(sorted).toEqual(items);
  });

  it("sorts an already-ascending array into descending order", () => {
    const jan = { date: JAN };
    const mar = { date: MAR };
    const jun = { date: JUN };

    const sorted = [jan, mar, jun].sort(byDateDesc);

    expect(sorted).toEqual([jun, mar, jan]);
  });
});

describe("takeRecent", () => {
  const items = [1, 2, 3, 4, 5];

  it("slices the first N items", () => {
    expect(takeRecent(items, 3)).toEqual([1, 2, 3]);
  });

  it("returns an empty array when count is 0", () => {
    expect(takeRecent(items, 0)).toEqual([]);
  });

  it("returns the full array unchanged when count exceeds array length", () => {
    expect(takeRecent(items, 100)).toEqual(items);
  });
});
