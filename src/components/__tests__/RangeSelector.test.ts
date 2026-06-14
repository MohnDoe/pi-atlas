import { describe, expect, it } from "vitest";
import { RangeSelector, type RangeSelectorTheme } from "../RangeSelector";

const identityTheme: RangeSelectorTheme = {
  fg: (_, text) => text,
};

describe("RangeSelector", () => {
  it("renders selected range", () => {
    const range = ["1d", "7d", "30d", "All"];
    for (const [index, label] of range.entries()) {
      const rs = new RangeSelector(identityTheme, range, index);
      const lines = rs.render(80);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(label);
    }
  });

  it("renders within width", () => {
    const rs = new RangeSelector(identityTheme, ["1d", "7d", "30d", "All"], 0);
    const lines = rs.render(40);
    expect(lines[0].length).toBeLessThanOrEqual(40);
  });
});
