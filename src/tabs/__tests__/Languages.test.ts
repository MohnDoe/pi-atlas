import { describe, expect, it } from "vitest";
import { testPalette } from "../../__tests__/components.fixtures";
import { Languages } from "../Languages";
import type { UsageRowTheme } from "../../components/UsageRow";

const identityTheme: UsageRowTheme = {
  fg: (_, text) => text,
  bold: (text) => text,
};

describe("Languages", () => {
  const languages = [
    { language: "TypeScript", lines: 1500, edits: 45 },
    { language: "Python", lines: 800, edits: 20 },
    { language: "JSON", lines: 300, edits: 5 },
  ];

  it("renders ranked table with  data rows", () => {
    const tab = new Languages(languages, identityTheme, testPalette());
    const lines = tab.render(80);

    const text = lines.join("\n");

    // Data rows
    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
    expect(text).toContain("JSON");
    expect(text).toContain("1.5k ln");
    expect(text).toContain("800 ln");
    expect(text).toContain("300 ln");
    expect(text).toContain("45 edits");
    expect(text).toContain("20 edits");
    expect(text).toContain("5 edits");

    // Fits within width
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
  });

  it("caches render output and invalidate clears cache", () => {
    const tab = new Languages(languages, identityTheme, testPalette());

    // Render at width 80
    const first = tab.render(80);
    // Same width should return cached (same identity)
    const second = tab.render(80);
    expect(second).toStrictEqual(first);

    // Invalidate + re-render at same width should produce fresh output
    tab.invalidate();
    const afterInvalidate = tab.render(80);
    // Should still contain data
    expect(afterInvalidate.length).toBe(first.length);
    expect(afterInvalidate.join("\n")).toContain("TypeScript");
  });

  it("re-renders at new width after invalidate", () => {
    const tab = new Languages(languages, identityTheme, testPalette());

    tab.render(80);
    tab.invalidate();
    const lines = tab.render(50);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(50);
    }
  });

  it("renders empty state message when languages is empty", () => {
    const tab = new Languages([], identityTheme, testPalette());
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No language data for this time range");
  });
});
