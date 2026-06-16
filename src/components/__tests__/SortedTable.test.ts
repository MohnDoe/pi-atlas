import { describe, expect, it } from "vitest";
import { makeTheme } from "../../__tests__/components.fixtures";
import { SortedTable, type ColumnDef } from "../SortedTable";

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
    const table = new SortedTable(columns, rows, 10, makeTheme());
    const lines = table.render(80);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const header = lines[0];
    expect(header).toContain("Language");
    expect(header).toContain("Lines");
    expect(header).toContain("Edits");
  });

  it("renders data rows", () => {
    const table = new SortedTable(columns, rows, 10, makeTheme());
    const lines = table.render(80);
    // Skip header (index 0), check first two data rows
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(lines[1]).toContain("TypeScript");
    expect(lines[2]).toContain("Python");
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
    expect(lines[0]).toContain("Language");
  });

  it("scrolls down with handleInput", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [
      `Lang${i}`,
      String(i * 100),
      String(i * 10),
    ]);
    const table = new SortedTable(columns, manyRows, 6, makeTheme()); // 5 data rows visible

    // Initial: rows 0-4
    let lines = table.render(80);
    expect(lines[1]).toContain("Lang0");
    expect(lines[lines.length - 1]).toContain("Lang4");

    // Scroll down once
    table.handleInput("\x1b[B"); // down arrow
    lines = table.render(80);
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

    // Scroll down first
    table.handleInput("\x1b[B");
    table.handleInput("\x1b[B");
    let lines = table.render(80);
    expect(lines[1]).toContain("Lang2");

    // Scroll up
    table.handleInput("\x1b[A"); // up arrow
    lines = table.render(80);
    expect(lines[1]).toContain("Lang1");
  });

  it("does not scroll past start", () => {
    const manyRows = Array.from({ length: 5 }, (_, i) => [`Lang${i}`, "100", "10"]);
    const table = new SortedTable(columns, manyRows, 10, makeTheme());
    // All rows fit, scrolling up should not do anything
    table.handleInput("\x1b[A");
    const lines = table.render(80);
    expect(lines[1]).toContain("Lang0");
  });

  it("does not scroll past end", () => {
    const manyRows = Array.from({ length: 5 }, (_, i) => [`Lang${i}`, "100", "10"]);
    const table = new SortedTable(columns, manyRows, 6, makeTheme()); // 5 visible data rows, 5 total
    // Scroll all the way down
    for (let i = 0; i < 10; i++) table.handleInput("\x1b[B");
    const lines = table.render(80);
    // Should still show last row
    expect(lines[lines.length - 1]).toContain("Lang4");
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

  it("renders rows continuously respecting scroll offset", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [`Lang${i}`, "100", "10"]);
    const table = new SortedTable(columns, manyRows, 6, makeTheme());

    // Scroll down a few times
    table.handleInput("\x1b[B");
    table.handleInput("\x1b[B");
    table.handleInput("\x1b[B");
    const lines = table.render(80);
    // First visible row should show Lang3 (scroll offset 3)
    expect(lines[1]).toContain("Lang3");
  });

  // --- Flexible width tests ---

  it("renders each line at exactly the specified width (visible chars)", () => {
    const table = new SortedTable(columns, rows, 10, makeTheme());
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
    const table = new SortedTable(pctCols, [["hello"]], 10, makeTheme());
    const lines = table.render(20);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBe(20);
    }
  });
});
