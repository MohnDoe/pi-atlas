import chalk from "chalk";
import { describe, expect, it } from "vitest";
import { makeTheme } from "../../__tests__/components.fixtures";
import { RankedBarList } from "../RankedBarList";

describe("RankedBarList", () => {
  it("renders a single item with 100% bar width", () => {
    const theme = makeTheme();
    const list = new RankedBarList([
      {
        name: "TypeScript",
        primaryValue: 100,
        mainValueText: "100 ln",
        secondaryValueText: "5 edits",
        color: chalk.green,
      },
    ], theme);
    const lines = list.render(80);
    expect(lines.length).toBe(3); // name+value, bar+%, spacer
    const text = lines.join("\n");
    expect(text).toContain("TypeScript");
    expect(text).toContain("100 ln");
    expect(text).toContain("5 edits");
    expect(text).toContain("100.00%");
  });

  it("returns empty array for empty items", () => {
    const list = new RankedBarList([], makeTheme());
    expect(list.render(80)).toEqual([]);
  });

  it("computes proportional bars for multiple items", () => {
    const list = new RankedBarList([
      { name: "Python", primaryValue: 60, mainValueText: "60 ln", color: chalk.blue },
      { name: "Rust", primaryValue: 40, mainValueText: "40 ln", color: chalk.red },
    ], makeTheme());
    const lines = list.render(80);
    const text = lines.join("\n");
    // Python should be 60% and 100% bar, Rust should be 40% and 66.67% bar
    expect(text).toContain("60.00%");
    expect(text).toContain("40.00%");
    expect(text).toContain("Python");
    expect(text).toContain("Rust");
    expect(lines.length).toBe(6); // 2 items × 3 lines each
  });

  it("renders without secondary value", () => {
    const list = new RankedBarList([
      { name: "bash", primaryValue: 10, mainValueText: "10", color: chalk.white },
    ], makeTheme());
    const lines = list.render(80);
    const text = lines.join("\n");
    expect(text).toContain("bash");
    expect(text).toContain("10");
  });

  it("renders 0% bars when all primaryValues are zero", () => {
    const list = new RankedBarList([
      { name: "Empty1", primaryValue: 0, mainValueText: "0", color: chalk.gray },
      { name: "Empty2", primaryValue: 0, mainValueText: "0", color: chalk.gray },
    ], makeTheme());
    const lines = list.render(80);
    const text = lines.join("\n");
    expect(text).toContain("0.00%");
    // Should not crash with division by zero
    expect(lines.length).toBe(6);
  });

  it("caches rendered output for same width", () => {
    const list = new RankedBarList([
      { name: "Rust", primaryValue: 50, mainValueText: "50 ln", color: chalk.red },
    ], makeTheme());
    const lines1 = list.render(80);
    const lines2 = list.render(80);
    expect(lines1).toBe(lines2); // same reference (cached)
  });

  it("re-renders when width changes", () => {
    const list = new RankedBarList([
      { name: "Rust", primaryValue: 50, mainValueText: "50 ln", color: chalk.red },
    ], makeTheme());
    const lines1 = list.render(80);
    const lines2 = list.render(40);
    expect(lines1).not.toBe(lines2);
  });

  it("invalidates cache", () => {
    const list = new RankedBarList([
      { name: "Rust", primaryValue: 50, mainValueText: "50 ln", color: chalk.red },
    ], makeTheme());
    list.render(80);
    list.invalidate();
    const lines = list.render(80);
    // Should render (not throw), tested by the fact it returns 3 lines
    expect(lines.length).toBe(3);
  });
});
