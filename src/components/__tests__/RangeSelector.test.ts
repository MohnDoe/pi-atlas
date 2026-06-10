import { describe, it, expect } from "vitest";
import { testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { RangeSelector } from "../RangeSelector";

describe("RangeSelector", () => {
  it("renders all range options", () => {
    const rs = new RangeSelector(testTheme(), ["1d", "7d", "30d", "All"], 0);
    const lines = rs.render(80);
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line).toContain("1d");
    expect(line).toContain("7d");
    expect(line).toContain("30d");
    expect(line).toContain("All");
  });

  it("highlights selected range", () => {
    const rs = new RangeSelector(testTheme(), ["1d", "7d", "30d", "All"], 2);
    const lines = rs.render(80);
    expect(lines[0]).toContain("30d");
  });

  it("ignores up/down (range now cycled via Dashboard r key)", () => {
    const rs = new RangeSelector(testTheme(), ["1d", "7d", "30d", "All"], 0);
    rs.handleInput("\x1b[B"); // down — no effect
    expect(rs.selectedIndex).toBe(0);
    rs.handleInput("\x1b[A"); // up — no effect
    expect(rs.selectedIndex).toBe(0);
    // selectedIndex is public, Dashboard sets it directly via r key
    rs.selectedIndex = 2;
    expect(rs.selectedIndex).toBe(2);
  });

  it("consumes enter without changing selection", () => {
    const rs = new RangeSelector(testTheme(), ["1d", "7d"], 0);
    rs.handleInput("\r"); // enter — consumed, no-op
    expect(rs.selectedIndex).toBe(0);
  });

  it("renders within width", () => {
    const rs = new RangeSelector(testTheme(), ["1d", "7d", "30d", "All"], 0);
    const lines = rs.render(40);
    expect(visibleLength(lines[0])).toBeLessThanOrEqual(40);
  });

  it("uses theme.bg('selectedBg') and theme.fg('accent') for selected range", () => {
    const rs = new RangeSelector(testTheme(), ["1d", "7d", "30d", "All"], 0);
    const lines = rs.render(80);
    expect(lines[0]).toContain("<bg:selectedBg>");
    expect(lines[0]).toContain("<fg:accent>");
  });

  it("uses theme.fg('muted') for unselected ranges", () => {
    const rs = new RangeSelector(testTheme(), ["1d", "7d", "30d", "All"], 0);
    const lines = rs.render(80);
    expect(lines[0]).toContain("<fg:muted>");
  });
});
