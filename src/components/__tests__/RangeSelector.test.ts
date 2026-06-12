import { describe, expect, it } from "vitest";
import { testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { RangeSelector } from "../RangeSelector";

describe("RangeSelector", () => {
  it("renders selected range", () => {
    const range = ["1d", "7d", "30d", "All"];
    for (const [index, label] of range.entries()) {
      const rs = new RangeSelector(testTheme(), range, index);
      const lines = rs.render(80);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(label);
    }
  });

  it("renders within width", () => {
    const rs = new RangeSelector(testTheme(), ["1d", "7d", "30d", "All"], 0);
    const lines = rs.render(40);
    expect(visibleLength(lines[0])).toBeLessThanOrEqual(40);
  });
});
