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

  it("renders empty state message when languages is empty", () => {
    const tab = new Languages([], testTheme(), 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No language data for this time range");
    expect(text).toContain("<fg:muted>");
  });
});
