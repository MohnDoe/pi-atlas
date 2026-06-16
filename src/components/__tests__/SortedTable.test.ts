import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockTUI, makeTheme } from "../../__tests__/components.fixtures";

import { ColumnDef, SortedTable, type SortConfig } from "../SortedTable";

const mockTui = makeMockTUI();

describe("SortedTable", () => {
  const columns = [
    { header: "Language", width: 20 },
    { header: "Lines", width: 10 },
    { header: "Edits", width: 10 },
  ];

  const rows = [
    ["TypeScript", "1500", "45"],
    ["Python", "800", "20"],
    ["JSON", "300", "5"],
  ];

  it("renders header row with column names", () => {
    const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui }, makeTheme());

    const lines = table.render(80);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const header = lines[0];
    expect(header).toContain("Language");
    expect(header).toContain("Lines");
    expect(header).toContain("Edits");
  });

  it("renders data rows", () => {
    const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(80);
    // Skip header (index 0), check first two data rows
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]).toContain("TypeScript");
    expect(lines[2]).toContain("Python");
    expect(lines[3]).toContain("JSON");
  });

  it("renders within width", () => {
    const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(50);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(50);
    }
  });

  it("shows all rows when they fit within maxHeight", () => {
    const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(80);
    // 1 header + 3 data rows = 4 lines (all fit in 10)
    expect(lines.length).toBe(4);
  });

  it("limits visible rows to maxHeight", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [
      `Lang${i}`,
      String(i * 100),
      String(i * 10),
    ]);
    const table = new SortedTable({ columns, rows: manyRows, maxHeight: 6, tui: mockTui}, makeTheme()); // 1 header + 5 data
    const lines = table.render(80);
    expect(lines.length).toBe(6);
  });

  it("handles empty rows", () => {
    const table = new SortedTable({ columns, rows: [], maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(80);
    // Should have at least a header, maybe an empty message
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]).toContain("Language");
  });

  it("scrolls down with handleInput", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [
      `Lang${i}`,
      String(i * 100),
      String(i * 10),
    ]);
    const table = new SortedTable({ columns, rows: manyRows, maxHeight: 6, tui: mockTui}, makeTheme()); // 5 data rows visible

    // Initial: cursor at 0, rows 0-4 visible
    let lines = table.render(80);
    expect(lines[1]).toContain("Lang0");
    expect(lines[lines.length - 1]).toContain("Lang4");

    // Move cursor down past visible area (cursor 0→5, viewport follows at 5th down)
    for (let i = 0; i < 5; i++) table.handleInput("\x1b[B");
    lines = table.render(80);
    // Viewport now shows rows 1-5, cursor row 5 highlighted
    expect(lines[1]).toContain("Lang1");
    expect(lines[lines.length - 1]).toContain("Lang5");
  });

  it("scrolls up with handleInput", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [
      `Lang${i}`,
      String(i * 100),
      String(i * 10),
    ]);
    const table = new SortedTable({ columns, rows: manyRows, maxHeight: 6, tui: mockTui}, makeTheme());

    // Move cursor down past visible area (cursor 0→6, viewport scrolls to 2)
    for (let i = 0; i < 6; i++) table.handleInput("\x1b[B");
    let lines = table.render(80);
    // Viewport shows rows 2-6
    expect(lines[1]).toContain("Lang2");

    // Move up until viewport scrolls back (cursor 6→1 takes 5 ups)
    // cursor=5: in viewport (5 < 2+5=7) ✓
    // cursor=4: in viewport ✓
    // cursor=3: in viewport ✓
    // cursor=2: in viewport ✓
    // cursor=1: 1 < 2 → scrollOffset=1, viewport shows rows 1-5
    for (let i = 0; i < 5; i++) table.handleInput("\x1b[A");
    lines = table.render(80);
    expect(lines[1]).toContain("Lang1");
  });

  it("does not move cursor past start", () => {
    const manyRows = Array.from({ length: 5 }, (_, i) => [`Lang${i}`, "100", "10"]);
    const table = new SortedTable({ columns, rows: manyRows, maxHeight: 10, tui: mockTui}, makeTheme());
    // Cursor at 0, pressing up should not move it
    table.handleInput("\x1b[A");
    const lines = table.render(80);
    // First data row (Lang0) should still be visible and highlighted
    expect(lines[1]).toContain("Lang0");
  });

  it("does not move cursor past end", () => {
    const manyRows = Array.from({ length: 5 }, (_, i) => [`Lang${i}`, "100", "10"]);
    const table = new SortedTable({ columns, rows: manyRows, maxHeight: 6, tui: mockTui}, makeTheme());
    // Move cursor all the way down (4 presses = last row)
    for (let i = 0; i < 10; i++) table.handleInput("\x1b[B");
    const lines = table.render(80);
    // Last row visible
    expect(lines[lines.length - 1]).toContain("Lang4");
    // Cursor should be at last row (Lang4)
  });

  it("invalidates render cache", () => {
    const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, makeTheme());
    table.render(80);
    table.invalidate();
    const lines = table.render(60);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });

  it("renders rows continuously respecting scroll offset", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [`Lang${i}`, "100", "10"]);
    const table = new SortedTable({ columns, rows: manyRows, maxHeight: 6, tui: mockTui}, makeTheme());

    // Scroll down past the viewport to trigger scroll
    // visibleRows = 5, so pressing down 5 times moves cursor to row 5, which is >= scrollOffset + visibleRows
    // → scrollOffset becomes 5 - 5 + 1 = 1
    for (let i = 0; i < 5; i++) table.handleInput("\x1b[B");
    const lines = table.render(80);
    // scrollOffset=1, first visible data row should be Lang1
    expect(lines[1]).toContain("Lang1");
  });

  // --- Flexible width tests ---

  it("renders each line at exactly the specified width (visible chars)", () => {
    const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(80);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBe(80);
    }
  });

  it("resolves percentage columns relative to content width", () => {
    const pctCols: ColumnDef[] = [
      { header: "Col", width: "50%" },
    ];
    // 1 column, 0 gaps → contentWidth = 20
    // 50% of 20 = 10
    const table = new SortedTable({ columns: pctCols, rows: [["hello"]], maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(20);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBe(20);
    }
  });

  it("fill column takes remaining space after fixed columns", () => {
    const fillCols: ColumnDef[] = [
      { header: "A", width: 5 },
      { header: "B", width: "fill" },
    ];
    // width=20, 1 gap → contentWidth=19
    // fixed: 5, remaining: 14 → fill=14
    const table = new SortedTable({ columns: fillCols, rows: [["x", "y"]], maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(20);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBe(20);
    }
    // Make sure the fill column got substantial width (not just 1)
    // B's content "y" should be padded, so the row should have space after "x"
    expect(lines[1]).toMatch(/x {4,}/);
  });

  it("fill column collapses to 1 char min when no space remains", () => {
    const tightCols: ColumnDef[] = [
      { header: "A", width: 18 },
      { header: "B", width: "fill" },
    ];
    // width=20, 1 gap → contentWidth=19
    // fixed: 18, remaining: 1 → fill=1 (min)
    const table = new SortedTable({ columns: tightCols, rows: [["aaa", "bbb"]], maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(20);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBe(20);
    }
  });

  it("throws when more than one fill column is specified", () => {
    const badCols: ColumnDef[] = [
      { header: "A", width: "fill" },
      { header: "B", width: "fill" },
    ];
    expect(() => new SortedTable({ columns: badCols, rows: [], maxHeight: 10, tui: mockTui}, makeTheme())).toThrow(
      "Cannot have more than one fill column"
    );
  });

  it("throws on invalid width string (not number, N%, or fill)", () => {
    const badCols: ColumnDef[] = [
      { header: "A", width: "abc" },
    ];
    expect(() => new SortedTable({ columns: badCols, rows: [], maxHeight: 10, tui: mockTui}, makeTheme())).toThrow(
      'Invalid column width: "abc"'
    );
  });

  it("handles mix of fixed, percentage, and fill columns", () => {
    const mixedCols: ColumnDef[] = [
      { header: "Fixed", width: 10 },
      { header: "Pct", width: "25%" },
      { header: "Fill", width: "fill" },
    ];
    // width=60, 2 gaps → contentWidth=58
    // fixed: 10, 25% of 58 = 14, remaining: 58 - 10 - 14 = 34 → fill=34
    const table = new SortedTable({ columns: mixedCols, rows: [["a", "b", "c"]], maxHeight: 10, tui: mockTui}, makeTheme());
    const lines = table.render(60);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBe(60);
    }
  });

  describe("sort indicators", () => {
    it("shows ▲ on the sorted column header when direction is asc", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, sort: { column: 0, direction: "asc" }, tui: mockTui}, makeTheme());
      const lines = table.render(80);
      const header = lines[0];
      expect(header).toContain("Language ▲");
      expect(header).toContain("Lines");
      expect(header).toContain("Edits");
    });

    it("shows ▼ on the sorted column header when direction is desc", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, sort: { column: 1, direction: "desc" }, tui: mockTui}, makeTheme());
      const lines = table.render(80);
      const header = lines[0];
      expect(header).toContain("Lines ▼");
      expect(header).toContain("Language");
      expect(header).toContain("Edits");
    });

    it("uses column width computed on raw header before appending triangle", () => {
      const tightCols = [
        { header: "Language", width: 10 },
        { header: "Lines", width: 10 },
        { header: "Edits", width: 10 },
      ];
      const table = new SortedTable({ columns: tightCols, rows, maxHeight: 10, sort: { column: 0, direction: "asc" }, tui: mockTui}, makeTheme());
      const lines = table.render(80);
      const header = lines[0];
      // "Language" is 8 chars, width 10 → 2 leftover for " ▲" → "Language ▲"
      expect(header).toContain("Language ▲");
      expect(header).not.toContain("Langua ▲"); // not shortened unnecessarily
    });

    it("shortens header text when header plus triangle exceeds column width", () => {
      const tightCols = [
        { header: "VeryLongName", width: 10 },
        { header: "Lines", width: 10 },
        { header: "Edits", width: 10 },
      ];
      const table = new SortedTable({ columns: tightCols, rows, maxHeight: 10, sort: { column: 0, direction: "asc" }, tui: mockTui}, makeTheme());
      const lines = table.render(80);
      const header = lines[0];
      // "VeryLongName" is 12 chars, width=10, " ▲" takes 2 → max raw = 8
      expect(header).toContain("VeryLong ▲"); // "VeryLong" (8) + " ▲" = 10
      expect(header).not.toContain("VeryLongName");
    });

    it("shows no triangle when sort is omitted", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, makeTheme());
      const lines = table.render(80);
      const header = lines[0];
      expect(header).not.toContain("▲");
      expect(header).not.toContain("▼");
      expect(header).toContain("Language");
    });
  });

  describe("cursor navigation", () => {
    function highlightTheme() {
      return makeTheme({
        bg: (color: string, text: string) => color === "selectedBg" ? `[[H]]${text}[[/H]]` : text,
      });
    }

    it("highlights the first row with selectedBg background by default", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, highlightTheme());
      const lines = table.render(80);

      // Header unaffected
      expect(lines[0]).toContain("Language");
      expect(lines[0]).not.toContain("[[H]]");

      // First data row has highlight
      expect(lines[1]).toContain("[[H]]");
      expect(lines[1]).toContain("TypeScript");

      // Second row is not highlighted
      expect(lines[2]).not.toContain("[[H]]");
    });

    it("down arrow moves highlight to the next row", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, highlightTheme());

      table.handleInput("\x1b[B");
      const lines = table.render(80);

      // First row no longer highlighted
      expect(lines[1]).not.toContain("[[H]]");
      // Second row now highlighted
      expect(lines[2]).toContain("[[H]]");
      expect(lines[2]).toContain("Python");
      // Third row not highlighted
      expect(lines[3]).not.toContain("[[H]]");
    });

    it("up arrow moves highlight to the previous row", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, highlightTheme());

      // Move down twice then back up once
      table.handleInput("\x1b[B");
      table.handleInput("\x1b[B");
      table.handleInput("\x1b[A");
      const lines = table.render(80);

      // Second row highlighted (moved down to row 3, back up to row 2)
      expect(lines[2]).toContain("[[H]]");
      expect(lines[2]).toContain("Python");
      // First and third rows not highlighted
      expect(lines[1]).not.toContain("[[H]]");
      expect(lines[3]).not.toContain("[[H]]");
    });

    it("cursor does not go above first row", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, highlightTheme());

      // Already at row 0, pressing up multiple times should keep highlight on row 0
      table.handleInput("\x1b[A");
      table.handleInput("\x1b[A");
      table.handleInput("\x1b[A");
      const lines = table.render(80);

      expect(lines[1]).toContain("[[H]]");
      expect(lines[1]).toContain("TypeScript");
    });

    it("cursor does not go past last row", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, highlightTheme());

      // Move to last row (index 2), then try to go further
      for (let i = 0; i < 5; i++) table.handleInput("\x1b[B");
      const lines = table.render(80);

      // Last row (JSON) is highlighted
      expect(lines[3]).toContain("[[H]]");
      expect(lines[3]).toContain("JSON");
    });

    it("handles empty rows gracefully with no highlight", () => {
      const table = new SortedTable({ columns, rows: [], maxHeight: 10, tui: mockTui}, highlightTheme());
      const lines = table.render(80);

      // Header only, no data rows
      expect(lines.length).toBe(1);
      // No highlight markers anywhere
      expect(lines[0]).not.toContain("[[H]]");

      // Inputs should not crash
      table.handleInput("\x1b[B");
      table.handleInput("\x1b[A");
    });

    it("shows cursor triangle on focused row and alignment on others", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, tui: mockTui}, makeTheme());

      // Default: first row focused
      let lines = table.render(80);
      expect(lines[1].startsWith("▶ ")).toBe(true);
      expect(lines[2].startsWith("  ")).toBe(true);
      expect(lines[3].startsWith("  ")).toBe(true);

      // Move down: second row focused
      table.handleInput("\x1b[B");
      lines = table.render(80);
      expect(lines[1].startsWith("  ")).toBe(true);
      expect(lines[2].startsWith("▶ ")).toBe(true);
      expect(lines[3].startsWith("  ")).toBe(true);
    });

    it("hides cursor when disabled", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, cursor: { enabled: false }, tui: mockTui}, makeTheme());
      const lines = table.render(80);

      // No cursor prefix on any row
      for (const line of lines) {
        expect(line.startsWith("▶ ")).toBe(false);
      }
      // Header should not be padded either
      expect(lines[0].startsWith("  ")).toBe(false);
    });

    it("uses custom cursor char", () => {
      const table = new SortedTable({ columns, rows, maxHeight: 10, cursor: { char: "▸" }, tui: mockTui}, makeTheme());
      const lines = table.render(80);

      expect(lines[1].startsWith("▸ ")).toBe(true);
      expect(lines[2].startsWith("  ")).toBe(true);
    });
  });

  describe("marquee", () => {
    const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");
    let mockTui: ReturnType<typeof makeMockTUI>;

    beforeEach(() => {
      vi.useFakeTimers();
      mockTui = makeMockTUI();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("scrolls overflowing text on focused row", () => {
      const cols: ColumnDef[] = [
        { header: "Name", width: 5, marquee: true },
      ];
      const rows = [["Hello World!"]];
      const table = new SortedTable({ columns: cols, rows, maxHeight: 10, tui: mockTui }, makeTheme());

      // tick=0, offset=0 → "Hello" (first 5 chars)
      let lines = table.render(20);
      expect(strip(lines[1])).toContain("▶ Hello");

      // Advance 150ms = 3 timer ticks → offset=1 → "ello "
      vi.advanceTimersByTime(150);
      lines = table.render(20);
      expect(strip(lines[1])).toContain("▶ ello");
    });

    it("wraps around when reaching end of content", () => {
      const cols: ColumnDef[] = [
        { header: "Col", width: 3, marquee: true },
      ];
      const rows = [["ABCDEF"]];
      const table = new SortedTable({ columns: cols, rows, maxHeight: 10, tui: mockTui }, makeTheme());

      // tick=0, offset=0 → "ABC"
      let lines = table.render(20);
      expect(strip(lines[1])).toContain("▶ ABC");

      // Advance 600ms = 12 timer ticks → offset=floor(12/3)%11=4 → "EF "
      // (5-space gap after text; trailing space stripped by trimEnd)
      vi.advanceTimersByTime(600);
      lines = table.render(20);
      expect(strip(lines[1])).toContain("▶ EF");
    });

    it("resets marquee when cursor moves to a different row", () => {
      const cols: ColumnDef[] = [
        { header: "Name", width: 5, marquee: true },
      ];
      const rows = [["Hello World!"], ["Another Long"]];
      const table = new SortedTable({ columns: cols, rows, maxHeight: 10, tui: mockTui }, makeTheme());

      // Advance ticks on row 0
      table.render(20);
      vi.advanceTimersByTime(150); // tick=3, offset=1 → "ello"
      let lines = table.render(20);
      expect(strip(lines[1])).toContain("▶ ello");

      // Move to row 1 — tick resets (MarqueeText instances are destroyed)
      table.handleInput("\x1b[B");
      vi.advanceTimersByTime(0); // process any pending microtasks
      lines = table.render(20); // fresh MarqueeText for row 1, tick=0, offset=0
      expect(strip(lines[2])).toContain("▶ Anoth"); // marquee starts from beginning
    });

    it("non-marquee columns truncate on focused row while marquee columns scroll", () => {
      const cols: ColumnDef[] = [
        { header: "Label", width: 10, marquee: true },
        { header: "Fixed", width: 4 },
      ];
      const rows = [["ABCDEFGHIJKLMNOP", "XYZ"]];
      const table = new SortedTable({ columns: cols, rows, maxHeight: 10, tui: mockTui }, makeTheme());

      // tick=0: marquee shows "ABCDEFGHIJ"
      let lines = table.render(30);
      const r1 = strip(lines[1]);
      expect(r1).toContain("▶ ABCDEFGHIJ");
      expect(r1).toContain("XYZ");

      // Advance 150ms = 3 ticks → offset=1 → "BCDEFGHIJK"
      vi.advanceTimersByTime(150);
      lines = table.render(30);
      const r1b = strip(lines[1]);
      expect(r1b).toContain("▶ BCDEFGHIJK");
      // Fixed column content never changes
      expect(r1b).toContain("XYZ");
      // The unfixed column changed
      expect(r1b).not.toContain("ABCDEFGHIJ");
    });

    it("shows ellipsis on unfocused marquee columns, scrolling on focused", () => {
      const cols: ColumnDef[] = [
        { header: "Name", width: 5, marquee: true },
      ];
      const rows = [["Longish Name"], ["Long Text Here!"]];
      const table = new SortedTable({ columns: cols, rows, maxHeight: 10, tui: mockTui }, makeTheme());

      // Focused row 0 — marquee starts at "Longi" (no ellipsis when focused)
      let lines = table.render(20);
      expect(strip(lines[1])).toContain("▶ Longi");

      // Move cursor to row 1 — row 0 becomes unfocused, shows ellipsis
      table.handleInput("\x1b[B");
      vi.advanceTimersByTime(0);
      lines = table.render(20);
      const unfocused = strip(lines[1]); // row 0 unfocused
      expect(unfocused).toContain("  Long…"); // truncated with ellipsis
      expect(unfocused).not.toContain("ongis"); // would appear if marquee was active

      // Focused row 1 shows "Long" at offset 0 (no ellipsis)
      expect(strip(lines[2])).toContain("▶ Long");

      // Advance ticks — unfocused row stays same (with ellipsis), focused advances
      vi.advanceTimersByTime(300); // tick=6, offset=2
      lines = table.render(20);
      expect(strip(lines[1])).toContain("  Long…"); // unchanged
      expect(strip(lines[2])).toContain("▶ ng T"); // focused advanced
    });

    it("starts marquee after resize from wide to narrow", () => {
      const cols: ColumnDef[] = [
        { header: "Col", width: "fill", marquee: true },
      ];
      const rows = [["Hello World!!!!!"]]; // 16 chars, overflows when fill < 16
      const table = new SortedTable({ columns: cols, rows, maxHeight: 10, tui: mockTui }, makeTheme());

      // Width=80: fill column = 80, text fits
      let lines = table.render(80);
      expect(strip(lines[1])).toContain("Hello World!!!!!");

      // Width=15: fill = 15 < 16 → overflows, marquee at offset 0
      lines = table.render(15);
      expect(strip(lines[1])).toContain("▶ Hello World!!");

      // Advance 150ms = 3 ticks → offset=1 → "ello World!!!!"
      vi.advanceTimersByTime(150);
      lines = table.render(15);
      expect(strip(lines[1])).toContain("▶ ello World!!!");
    });
  });
});
