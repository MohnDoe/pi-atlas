import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockTUI, testPalette, makeTheme } from "../../__tests__/components.fixtures";
import { Languages } from "../Languages";
import { LangStat } from "../../types";
import { SortedTable } from "../../components/SortedTable";

const CURSOR = SortedTable.DEFAULT_CURSOR_CHAR;

describe("Languages", () => {
  const mockTui = makeMockTUI();

  const languages: LangStat[] = [
    { language: "TypeScript", lines: 1500, edits: 45 },
    { language: "Python", lines: 800, edits: 20 },
    { language: "JSON", lines: 300, edits: 5 },
  ];

  it("renders data rows with formatted values", () => {
    const tab = new Languages(languages, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    // Headers
    expect(text).toContain("Language");
    expect(text).toContain("Edits");
    expect(text).toContain("Lines");
    expect(text).toContain("Share %");

    // Language names
    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
    expect(text).toContain("JSON");

    // Edits
    expect(text).toContain("45");
    expect(text).toContain("20");
    expect(text).toContain("5");

    // Lines formatted (no suffix)
    expect(text).toContain("1.5k");
    expect(text).toContain("800");
    expect(text).toContain("300");
  });

  it("shows empty state when languages is empty", () => {
    const tab = new Languages([], makeTheme(), testPalette(), mockTui, 10);
    const text = tab.render(80).join("\n");
    expect(text).toContain("No language data for this time range");
  });

  it("renders within width", () => {
    const tab = new Languages(languages, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(50);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(50);
    }
  });

  it("fill column adapts to width", () => {
    const tab = new Languages(languages, makeTheme(), testPalette(), mockTui, 10);

    // At width 30, columns shrink — no line exceeds render width
    const narrowLines = tab.render(30);
    for (const line of narrowLines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(30);
    }
    // Language column shrinks to ~9-10 chars — "TypeScript" (10 chars) truncates
    const narrowText = narrowLines.join("\n");
    expect(narrowText).not.toContain("TypeScript");

    // At width 80, fill column is spacious — full names visible
    const wideLines = tab.render(80);
    const wideText = wideLines.join("\n");
    expect(wideText).toContain("TypeScript");
    expect(wideText).toContain("1.5k");
  });

  it("shows cursor on first row", () => {
    const tab = new Languages(languages, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);
    // First data row (line 1, after header) should start with cursor
    expect(lines[1].startsWith(CURSOR)).toBe(true);
  });

  it("shows sort indicator on Lines column", () => {
    const tab = new Languages(languages, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");
    // Lines is column 2, sort direction "desc" → ▼
    expect(text).toContain("Lines ▼");
  });

  it("invalidates render cache", () => {
    const tab = new Languages(languages, makeTheme(), testPalette(), mockTui, 10);
    tab.render(80);
    tab.invalidate();
    const lines = tab.render(60);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(60);
    }
  });

  it("supports re-render after invalidation (lifecycle path)", () => {
    const tab = new Languages(languages, makeTheme(), testPalette(), mockTui, 10);

    const lines1 = tab.render(80);
    expect(lines1.join("\n")).toContain("TypeScript");

    tab.invalidate();

    const lines2 = tab.render(80);
    const text = lines2.join("\n");
    expect(text).toContain("TypeScript");
    expect(text).toContain("Lines ▼");
    expect(lines2[1].startsWith(CURSOR)).toBe(true);
    for (const line of lines2) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(80);
    }
  });

  describe("marquee lifecycle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears marquee timers on invalidate", () => {
      const longNames: LangStat[] = [
        { language: "TypeScript with a very long name that should overflow", lines: 1500, edits: 45 },
      ];
      const tab = new Languages(longNames, makeTheme(), testPalette(), mockTui, 10);

      // Render at narrow width where language name overflows fill column
      // → MarqueeCell starts timer on focused row
      tab.render(30);
      expect(vi.getTimerCount()).toBe(1);

      // Invalidate propagates: Languages → SortedTable → cells → MarqueeCell → clearInterval
      tab.invalidate();
      expect(vi.getTimerCount()).toBe(0);

      // Re-render at wider width so fill column has room for the name
      const lines = tab.render(80);
      const text = lines.join("\n");
      expect(text).toContain("TypeScript");
      expect(lines[1].startsWith(CURSOR)).toBe(true);
    });
  });
});
