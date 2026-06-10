import { describe, expect, it } from "vitest";
import { testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { Languages } from "../Languages";

describe("Languages", () => {
  const languages = [
    { language: "TypeScript", lines: 1500, edits: 45 },
    { language: "Python", lines: 800, edits: 20 },
    { language: "JSON", lines: 300, edits: 5 },
  ];

  it("renders ranked table with #, Language, Lines, Edits columns and data rows", () => {
    const tab = new Languages(languages, testTheme(), 10);
    const lines = tab.render(80);

    const text = lines.join("\n");

    // Header with column names + rank
    expect(text).toContain("#");
    expect(text).toContain("Language");
    expect(text).toContain("Lines");
    expect(text).toContain("Edits");

    // Data rows
    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
    expect(text).toContain("JSON");
    expect(text).toContain("1.5k");
    expect(text).toContain("800");
    expect(text).toContain("300");
    expect(text).toContain("45");
    expect(text).toContain("20");
    expect(text).toContain("5");

    // Fits within width
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(80);
    }
  });

  it("scrolls down with handleInput", () => {
    const manyLanguages = Array.from({ length: 20 }, (_, i) => ({
      language: `Lang${i}`,
      lines: (20 - i) * 100,
      edits: (20 - i) * 10,
    }));
    const tab = new Languages(manyLanguages, testTheme(), 6); // 5 data rows visible

    // Render to create the table
    let lines = tab.render(80);
    // First data row (index 1 after header) should be Lang0
    expect(lines[1]).toContain("Lang0");
    expect(lines[1]).toContain("1"); // rank 1

    // Scroll down
    tab.handleInput("\x1b[B");
    lines = tab.render(80);
    expect(lines[1]).toContain("Lang1");
    expect(lines[1]).toContain("2"); // rank 2, scrolled past Lang0
  });

  it("scrolls back up with handleInput", () => {
    const manyLanguages = Array.from({ length: 20 }, (_, i) => ({
      language: `Lang${i}`,
      lines: (20 - i) * 100,
      edits: (20 - i) * 10,
    }));
    const tab = new Languages(manyLanguages, testTheme(), 6);

    // Scroll down twice, then back up
    tab.render(80); // create table
    tab.handleInput("\x1b[B");
    tab.handleInput("\x1b[B");
    let lines = tab.render(80);
    expect(lines[1]).toContain("Lang2");

    tab.handleInput("\x1b[A");
    lines = tab.render(80);
    expect(lines[1]).toContain("Lang1");
  });

  it("ignores non-scroll keys in handleInput", () => {
    const manyLanguages = Array.from({ length: 20 }, (_, i) => ({
      language: `Lang${i}`,
      lines: (20 - i) * 100,
      edits: (20 - i) * 10,
    }));
    const tab = new Languages(manyLanguages, testTheme(), 6);

    tab.render(80); // create table
    let before = tab.render(80);

    // Non-arrow keys should not change the view
    tab.handleInput("q");
    tab.handleInput("enter");
    tab.handleInput(" ");
    let after = tab.render(80);

    expect(after).toEqual(before);
  });

  it("caches render output and invalidate clears cache", () => {
    const tab = new Languages(languages, testTheme(), 10);

    // Render at width 80
    const first = tab.render(80);
    // Same width should return cached (same identity)
    const second = tab.render(80);
    expect(second).toBe(first);

    // Invalidate + re-render at same width should produce fresh output
    tab.invalidate();
    const afterInvalidate = tab.render(80);
    // Should still contain data
    expect(afterInvalidate.length).toBe(first.length);
    expect(afterInvalidate.join("\n")).toContain("TypeScript");
  });

  it("re-renders at new width after invalidate", () => {
    const tab = new Languages(languages, testTheme(), 10);

    tab.render(80);
    tab.invalidate();
    const lines = tab.render(50);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(50);
    }
  });

  it("renders empty state message when languages is empty", () => {
    const tab = new Languages([], testTheme(), 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No language data for this time range");
    expect(text).toContain("<fg:muted>");
  });
});
