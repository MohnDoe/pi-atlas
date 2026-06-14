import { describe, it, expect } from "vitest";
import { makeTheme } from "../../__tests__/components.fixtures";
import { RangeSelector } from "../RangeSelector";
import { Header } from "../Header";

describe("Header", () => {
  it("renders title on 2 lines with range box right-aligned", () => {
    const rs = new RangeSelector(
      makeTheme(),
      ["Today", "Last 7 days", "Last 30 days", "All time"],
      0,
    );
    const header = new Header(makeTheme(), rs);
    const lines = header.render(80);

    expect(lines).toHaveLength(3);

    // All lines should have same visible width
    for (const line of lines) {
      expect(line.length).toBe(80);
    }

    // Line 0: "Pi Usage" on the left, box top border on the right
    const l0 = lines[0];
    expect(l0).toMatch(/^Pi Usage\s+╭.*Range \(r\)/);

    // Line 1: version on the left, box content on the right
    const l1 = lines[1];
    expect(l1).toMatch(/^\s*v 0\.0\.1\s+│.*Today/);

    // Line 2: empty left side, box bottom border on the right
    const l2 = lines[2];
    expect(l2).toMatch(/^\s+╰─/);
    const boxLeft = 80 - 17; // RANGE_BOX_WIDTH
    expect(l2.slice(0, boxLeft).trim()).toBe("");
  });
});
