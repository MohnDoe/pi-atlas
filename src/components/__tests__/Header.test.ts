import { describe, it, expect } from "vitest";
import { testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { RangeSelector } from "../RangeSelector";
import { Header } from "../Header";

function plainText(s: string): string {
  return s
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/<[/]?(?:b|fg:[^>]+|bg:[^>]+)>/g, "");
}

describe("Header", () => {
  it("renders title on 2 lines with range box right-aligned", () => {
    const rs = new RangeSelector(
      testTheme(),
      ["Today", "Last 7 days", "Last 30 days", "All time"],
      0,
    );
    const header = new Header(testTheme(), rs);
    const lines = header.render(80);

    expect(lines).toHaveLength(3);

    // All lines should have same visible width
    for (const line of lines) {
      expect(visibleLength(line)).toBe(80);
    }

    // Line 0: "Pi Usage" on the left, box top border on the right
    const l0 = plainText(lines[0]);
    expect(l0).toMatch(/^Pi Usage\s+╭.*Range \(r\)/);

    // Line 1: version on the left, box content on the right
    const l1 = plainText(lines[1]);
    expect(l1).toMatch(/^\s*v 0\.0\.1\s+│.*Today/);

    // Line 2: empty left side, box bottom border on the right
    const l2 = plainText(lines[2]);
    expect(l2).toMatch(/^\s+╰─/);
    const boxLeft = 80 - 17; // RANGE_BOX_WIDTH
    expect(l2.slice(0, boxLeft).trim()).toBe("");
  });
});
