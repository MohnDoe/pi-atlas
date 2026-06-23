import { describe, expect, it } from "bun:test";
import { makeTheme } from "./components.fixtures";
import { type RangeOption, RangeSelector } from "./RangeSelector";

describe("RangeSelector", () => {
  const ranges: RangeOption[] = [
    { label: "Today", value: "1d" },
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "All time", value: "All" },
  ];

  it("renders selected range label", () => {
    for (const [index, { label }] of ranges.entries()) {
      const rs = new RangeSelector(makeTheme(), ranges, index);
      const lines = rs.render(80);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain(label);
    }
  });

  it("returns selectedValue from getter", () => {
    for (const [index, { value }] of ranges.entries()) {
      const rs = new RangeSelector(makeTheme(), ranges, index);
      expect(rs.selectedValue).toBe(value);
    }
  });

  it("renders within width", () => {
    const rs = new RangeSelector(makeTheme(), ranges, 0);
    const lines = rs.render(40);
    expect(lines[0]!.length).toBeLessThanOrEqual(40);
  });
});
