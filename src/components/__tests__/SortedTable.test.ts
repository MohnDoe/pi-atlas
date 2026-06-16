import { describe, expect, it } from "vitest";
import { makeTheme } from "../../__tests__/components.fixtures";
import { SortedTable, type SortConfig } from "../SortedTable";

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

  it("renders header row with column names and # rank column", () => {
    const table = new SortedTable(columns, rows, 10, makeTheme());
    const lines = table.render(80);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const header = lines[0];
    expect(header).toContain("#");
    expect(header).toContain("Language");
    expect(header).toContain("Lines");
    expect(header).toContain("Edits");
  });

  it("renders data rows with rank numbers", () => {
    const table = new SortedTable(columns, rows, 10, makeTheme());
    const lines = table.render(80);
    // Skip header (index 0), check first two data rows
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]).toContain("1");
    expect(lines[1]).toContain("TypeScript");
    expect(lines[2]).toContain("2");
    expect(lines[2]).toContain("Python");
    expect(lines[3]).toContain("3");
    expect(lines[3]).toContain("JSON");
  });

  it("renders within width", () => {
    const table = new SortedTable(columns, rows, 10, makeTheme());
    const lines = table.render(50);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(50);
    }
  });

  it("shows all rows when they fit within maxHeight", () => {
    const table = new SortedTable(columns, rows, 10, makeTheme());
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
    const table = new SortedTable(columns, manyRows, 6, makeTheme()); // 1 header + 5 data
    const lines = table.render(80);
    expect(lines.length).toBe(6);
  });

  it("handles empty rows", () => {
    const table = new SortedTable(columns, [], 10, makeTheme());
    const lines = table.render(80);
    // Should have at least a header, maybe an empty message
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[0]).toContain("#");
    expect(lines[0]).toContain("Language");
  });

  it("scrolls down with handleInput", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [
      `Lang${i}`,
      String(i * 100),
      String(i * 10),
    ]);
    const table = new SortedTable(columns, manyRows, 6, makeTheme()); // 5 data rows visible

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
    const table = new SortedTable(columns, manyRows, 6, makeTheme());

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
    const table = new SortedTable(columns, manyRows, 10, makeTheme());
    // Cursor at 0, pressing up should not move it
    table.handleInput("\x1b[A");
    const lines = table.render(80);
    // First data row (Lang0) should still be visible and highlighted
    expect(lines[1]).toContain("Lang0");
  });

  it("does not move cursor past end", () => {
    const manyRows = Array.from({ length: 5 }, (_, i) => [`Lang${i}`, "100", "10"]);
    const table = new SortedTable(columns, manyRows, 6, makeTheme());
    // Move cursor all the way down (4 presses = last row)
    for (let i = 0; i < 10; i++) table.handleInput("\x1b[B");
    const lines = table.render(80);
    // Last row visible
    expect(lines[lines.length - 1]).toContain("Lang4");
    // Cursor should be at last row (Lang4)
  });

  it("invalidates render cache", () => {
    const table = new SortedTable(columns, rows, 10, makeTheme());
    table.render(80);
    table.invalidate();
    const lines = table.render(60);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });

  it("renders rank numbers continuously respecting scroll offset", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [`Lang${i}`, "100", "10"]);
    const table = new SortedTable(columns, manyRows, 6, makeTheme());

    // Scroll down a few times
    table.handleInput("\x1b[B");
    table.handleInput("\x1b[B");
    table.handleInput("\x1b[B");
    const lines = table.render(80);
    // First visible row should be rank 4 (scroll offset 3, rank = offset + 1)
    expect(lines[1]).toContain("4");
    expect(lines[1]).toContain("Lang3");
  });

  describe("sort indicators", () => {
    it("shows ▲ on the sorted column header when direction is asc", () => {
      const table = new SortedTable(columns, rows, 10, makeTheme(), {
        column: 0,
        direction: "asc",
      });
      const lines = table.render(80);
      const header = lines[0];
      expect(header).toContain("Language ▲");
      expect(header).toContain("Lines");
      expect(header).toContain("Edits");
    });

    it("shows ▼ on the sorted column header when direction is desc", () => {
      const table = new SortedTable(columns, rows, 10, makeTheme(), {
        column: 1,
        direction: "desc",
      });
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
      const table = new SortedTable(tightCols, rows, 10, makeTheme(), {
        column: 0,
        direction: "asc",
      });
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
      const table = new SortedTable(tightCols, rows, 10, makeTheme(), {
        column: 0,
        direction: "asc",
      });
      const lines = table.render(80);
      const header = lines[0];
      // "VeryLongName" is 12 chars, width=10, " ▲" takes 2 → max raw = 8
      expect(header).toContain("VeryLong ▲"); // "VeryLong" (8) + " ▲" = 10
      expect(header).not.toContain("VeryLongName");
    });

    it("shows no triangle when sort is omitted", () => {
      const table = new SortedTable(columns, rows, 10, makeTheme());
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
      const table = new SortedTable(columns, rows, 10, highlightTheme());
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
      const table = new SortedTable(columns, rows, 10, highlightTheme());

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
      const table = new SortedTable(columns, rows, 10, highlightTheme());

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
      const table = new SortedTable(columns, rows, 10, highlightTheme());

      // Already at row 0, pressing up multiple times should keep highlight on row 0
      table.handleInput("\x1b[A");
      table.handleInput("\x1b[A");
      table.handleInput("\x1b[A");
      const lines = table.render(80);

      expect(lines[1]).toContain("[[H]]");
      expect(lines[1]).toContain("TypeScript");
    });

    it("cursor does not go past last row", () => {
      const table = new SortedTable(columns, rows, 10, highlightTheme());

      // Move to last row (index 2), then try to go further
      for (let i = 0; i < 5; i++) table.handleInput("\x1b[B");
      const lines = table.render(80);

      // Last row (JSON) is highlighted
      expect(lines[3]).toContain("[[H]]");
      expect(lines[3]).toContain("JSON");
    });

    it("handles empty rows gracefully with no highlight", () => {
      const table = new SortedTable(columns, [], 10, highlightTheme());
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
      const table = new SortedTable(columns, rows, 10, makeTheme());

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
  });
});
