import { describe, it, expect } from "vitest";
import { TabBar, RangeSelector, KpiCards, BarChart, Dashboard, LoadingView, RankedTable, formatModelName } from "../components";

function visibleLength(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

describe("TabBar", () => {
  const tabs = ["Overview", "Languages", "Models", "Projects + Tools"];

  it("renders all tab names", () => {
    const tb = new TabBar(tabs, 0);
    const lines = tb.render(80);
    expect(lines).toHaveLength(1);
    const line = lines[0];
    for (const tab of tabs) {
      expect(line).toContain(tab);
    }
  });

  it("renders within width", () => {
    const tb = new TabBar(tabs, 0);
    const lines = tb.render(40);
    expect(lines).toHaveLength(1);
    expect(visibleLength(lines[0])).toBeLessThanOrEqual(40);
  });

  it("highlights the active tab", () => {
    const tb = new TabBar(tabs, 2);
    const lines = tb.render(80);
    // Models tab (index 2) should stand out from the others
    expect(lines[0]).toContain("Models");
  });

  it("moves active tab left with handleInput", () => {
    const tb = new TabBar(tabs, 2);
    tb.handleInput("\x1b[D"); // left arrow
    expect((tb as { activeIndex: number }).activeIndex).toBe(1);

    tb.handleInput("\x1b[D");
    expect((tb as { activeIndex: number }).activeIndex).toBe(0);

    // Wraps around? Or stays at 0?
    tb.handleInput("\x1b[D");
    expect((tb as { activeIndex: number }).activeIndex).toBe(0); // stays
  });

  it("moves active tab right with handleInput", () => {
    const tb = new TabBar(tabs, 2);
    tb.handleInput("\x1b[C"); // right arrow
    expect((tb as { activeIndex: number }).activeIndex).toBe(3);

    tb.handleInput("\x1b[C");
    expect((tb as { activeIndex: number }).activeIndex).toBe(3); // stays
  });

  it("invalidates render cache", () => {
    const tb = new TabBar(tabs, 0);
    tb.render(80);
    tb.invalidate();
    // After invalidate, next render should recompute
    const lines = tb.render(60); // different width → should still work
    expect(visibleLength(lines[0])).toBeLessThanOrEqual(60);
  });
});

describe("RangeSelector", () => {
  it("renders all range options", () => {
    const rs = new RangeSelector(["1d", "7d", "30d", "All"], 0);
    const lines = rs.render(80);
    expect(lines).toHaveLength(1);
    const line = lines[0];
    expect(line).toContain("1d");
    expect(line).toContain("7d");
    expect(line).toContain("30d");
    expect(line).toContain("All");
  });

  it("highlights selected range", () => {
    const rs = new RangeSelector(["1d", "7d", "30d", "All"], 2);
    const lines = rs.render(80);
    expect(lines[0]).toContain("30d");
  });

  it("moves selection up/down", () => {
    const rs = new RangeSelector(["1d", "7d", "30d", "All"], 0);
    rs.handleInput("\x1b[B"); // down
    expect(rs.selectedIndex).toBe(1);
    rs.handleInput("\x1b[B"); // down
    expect(rs.selectedIndex).toBe(2);
    rs.handleInput("\x1b[A"); // up
    expect(rs.selectedIndex).toBe(1);
  });

  it("doesn't move past boundaries", () => {
    const rs = new RangeSelector(["1d", "7d"], 0);
    rs.handleInput("\x1b[A"); // up at top
    expect(rs.selectedIndex).toBe(0);
    rs.handleInput("\x1b[B"); // down
    rs.handleInput("\x1b[B"); // down at bottom
    expect(rs.selectedIndex).toBe(1);
  });

  it("renders within width", () => {
    const rs = new RangeSelector(["1d", "7d", "30d", "All"], 0);
    const lines = rs.render(40);
    expect(visibleLength(lines[0])).toBeLessThanOrEqual(40);
  });
});

describe("KpiCards", () => {
  const kpis = {
    totalCost: 12.34,
    sessionCount: 42,
    totalMessages: 1500,
    totalTokens: 250000,
    daysActive: 7,
    avgCostPerDay: 1.76,
  };

  it("renders 6 KPIs in a grid", () => {
    const cards = new KpiCards(kpis);
    const lines = cards.render(80);
    // Should have multiple lines (2 rows of 3 cards each)
    expect(lines.length).toBeGreaterThanOrEqual(2);
    // Should mention key metrics
    const text = lines.join("\n");
    expect(text).toContain("12.34");
    expect(text).toContain("42");
    expect(text).toContain("1.5k");
    expect(text).toContain("250.0k");
    expect(text).toContain("7");
    expect(text).toContain("1.76");
  });

  it("renders label for each card", () => {
    const cards = new KpiCards(kpis);
    const lines = cards.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Total Cost");
    expect(text).toContain("Sessions");
    expect(text).toContain("Messages");
    expect(text).toContain("Total Tokens");
    expect(text).toContain("Days Active");
    expect(text).toContain("Avg Cost/Day");
  });

  it("renders within width", () => {
    const cards = new KpiCards(kpis);
    const lines = cards.render(50);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(50);
    }
  });

  it("formats large token numbers", () => {
    const cards = new KpiCards({ ...kpis, totalTokens: 1500000 });
    const lines = cards.render(80);
    expect(lines.join("\n")).toContain("1.5M");
  });

  it("invalidates cache", () => {
    const cards = new KpiCards(kpis);
    cards.render(80);
    cards.invalidate();
    const lines = cards.render(60);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }
  });
});

describe("BarChart", () => {
  const dailySpend = [
    { date: "2026-06-01", cost: 1.0 },
    { date: "2026-06-02", cost: 0.0 },
    { date: "2026-06-03", cost: 2.5 },
    { date: "2026-06-04", cost: 0.5 },
    { date: "2026-06-05", cost: 0.0 },
    { date: "2026-06-06", cost: 1.2 },
    { date: "2026-06-07", cost: 3.0 },
  ];

  it("renders bar chart with X-axis labels", () => {
    const chart = new BarChart(dailySpend, "7d", 15);
    const lines = chart.render(80);
    // Should have some visual output (bars)
    expect(lines.length).toBeGreaterThan(0);
    const text = lines.join("\n");
    // X-axis labels should include day abbreviations
    expect(text).toContain("Mon");
  });

  it("renders within width", () => {
    const chart = new BarChart(dailySpend, "7d", 15);
    const lines = chart.render(50);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(50);
    }
  });

  it("handles empty daily spend", () => {
    const chart = new BarChart([], "7d", 15);
    const lines = chart.render(80);
    expect(lines.length).toBeGreaterThan(0);
    // Should show empty state or just labels
    const text = lines.join("\n");
    expect(text).toContain("No data");
  });

  it("auto-scales bars to available height", () => {
    const chart = new BarChart(dailySpend, "7d", 10);
    const lines = chart.render(80);
    // Should have at most maxHeight rows of bar content
    expect(lines.length).toBeLessThanOrEqual(12); // 10 bars + 2 labels
  });

  it("uses block characters for bars", () => {
    const chart = new BarChart(dailySpend, "7d", 15);
    const lines = chart.render(80);
    const text = lines.join("\n");
    expect(text).toContain("█");
  });

  it("invalidates cache", () => {
    const chart = new BarChart(dailySpend, "7d", 15);
    chart.render(80);
    chart.invalidate();
    const lines = chart.render(60);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }
  });
});

describe("RankedTable", () => {
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
    const table = new RankedTable(columns, rows, 10);
    const lines = table.render(80);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const header = lines[0];
    expect(header).toContain("#");
    expect(header).toContain("Language");
    expect(header).toContain("Lines");
    expect(header).toContain("Edits");
  });

  it("renders data rows with rank numbers", () => {
    const table = new RankedTable(columns, rows, 10);
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
    const table = new RankedTable(columns, rows, 10);
    const lines = table.render(50);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(50);
    }
  });

  it("shows all rows when they fit within maxHeight", () => {
    const table = new RankedTable(columns, rows, 10);
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
    const table = new RankedTable(columns, manyRows, 6); // 1 header + 5 data
    const lines = table.render(80);
    expect(lines.length).toBe(6);
  });

  it("handles empty rows", () => {
    const table = new RankedTable(columns, [], 10);
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
    const table = new RankedTable(columns, manyRows, 6); // 5 data rows visible

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
    const table = new RankedTable(columns, manyRows, 6);

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
    const manyRows = Array.from({ length: 5 }, (_, i) => [
      `Lang${i}`,
      "100",
      "10",
    ]);
    const table = new RankedTable(columns, manyRows, 10);
    // All rows fit, scrolling up should not do anything
    table.handleInput("\x1b[A");
    const lines = table.render(80);
    expect(lines[1]).toContain("Lang0");
  });

  it("does not scroll past end", () => {
    const manyRows = Array.from({ length: 5 }, (_, i) => [
      `Lang${i}`,
      "100",
      "10",
    ]);
    const table = new RankedTable(columns, manyRows, 6); // 5 visible data rows, 5 total
    // Scroll all the way down
    for (let i = 0; i < 10; i++) table.handleInput("\x1b[B");
    const lines = table.render(80);
    // Should still show last row
    expect(lines[lines.length - 1]).toContain("Lang4");
  });

  it("invalidates render cache", () => {
    const table = new RankedTable(columns, rows, 10);
    table.render(80);
    table.invalidate();
    const lines = table.render(60);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }
  });

  it("renders rank numbers continuously respecting scroll offset", () => {
    const manyRows = Array.from({ length: 20 }, (_, i) => [
      `Lang${i}`,
      "100",
      "10",
    ]);
    const table = new RankedTable(columns, manyRows, 6);

    // Scroll down a few times
    table.handleInput("\x1b[B");
    table.handleInput("\x1b[B");
    table.handleInput("\x1b[B");
    const lines = table.render(80);
    // First visible row should be rank 4 (scroll offset 3, rank = offset + 1)
    expect(lines[1]).toContain("4");
    expect(lines[1]).toContain("Lang3");
  });
});

describe("formatModelName", () => {
  it("strips claude- prefix and date suffix", () => {
    expect(formatModelName("claude-sonnet-4-20250514")).toBe("Sonnet 4");
  });

  it("strips deepseek- prefix", () => {
    expect(formatModelName("deepseek-v4-pro")).toBe("V4 Pro");
  });

  it("strips gemini- prefix", () => {
    expect(formatModelName("gemini-2.5-pro")).toBe("2.5 Pro");
  });

  it("handles model name without prefix or suffix", () => {
    expect(formatModelName("claude-haiku-3.5")).toBe("Haiku 3.5");
  });

  it("strips 8-digit date suffix", () => {
    expect(formatModelName("claude-opus-4-20250514")).toBe("Opus 4");
  });

  it("strips YYYY-MM-DD date suffix", () => {
    expect(formatModelName("some-model-2025-05-14")).toBe("Some Model");
  });

  it("handles model with no known prefix", () => {
    expect(formatModelName("llama-3-70b")).toBe("Llama 3 70b");
  });
});

describe("Dashboard", () => {
  const makeSummary = () => ({
    totalCost: 5.0,
    sessionCount: 3,
    totalMessages: 50,
    totalTokens: 10000,
    daysActive: 3,
    avgCostPerDay: 1.67,
    todayCost: 1.0,
    languages: [],
    models: [],
    projects: [],
    tools: [],
    dailySpend: [
      { date: "2026-06-06", cost: 1.0 },
      { date: "2026-06-07", cost: 2.0 },
      { date: "2026-06-08", cost: 2.0 },
    ],
  });

  it("renders all sections", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries);
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Overview");
    expect(text).toContain("1d");
    expect(text).toContain("7d");
    expect(text).toContain("Total Cost");
    expect(text).toContain("Esc/q close");
    expect(text).toContain("█");
  });

  it("shows 'No sessions found' when no session data exists", () => {
    const zeroSummary = { ...makeSummary(), totalCost: 0, sessionCount: 0, totalMessages: 0, totalTokens: 0, dailySpend: [] };
    const summaries = [zeroSummary, zeroSummary, zeroSummary, zeroSummary];
    const dash = new Dashboard(summaries);
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No sessions found");
  });

  it("shows 'No data for this time range' when current range is empty", () => {
    const dataSummary = { ...makeSummary(), totalCost: 5.00, sessionCount: 3 };
    const zeroSummary = { ...makeSummary(), totalCost: 0, sessionCount: 0, totalMessages: 0, totalTokens: 0, dailySpend: [] };
    // 1d range (index 0) empty, others have data
    const summaries = [zeroSummary, dataSummary, dataSummary, dataSummary];
    const dash = new Dashboard(summaries);
    // Default selected range is index 1 (7d), so we see data.
    // Switch to index 0 (1d) via range selector
    dash.handleInput("\x1b[A"); // up arrow — should move from index 1 to 0
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No data for this time range");
  });

  it("handles escape to close", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    let closed = false;
    const dash = new Dashboard(summaries, () => {
      closed = true;
    });
    dash.handleInput("\x1b");
    expect(closed).toBe(true);
  });

  it("handles q to close", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    let closed = false;
    const dash = new Dashboard(summaries, () => {
      closed = true;
    });
    dash.handleInput("q");
    expect(closed).toBe(true);
  });

  it("renders Languages tab with ranked table when active", () => {
    const summary = {
      ...makeSummary(),
      languages: [
        { language: "TypeScript", lines: 1500, edits: 45 },
        { language: "Python", lines: 800, edits: 20 },
        { language: "JSON", lines: 300, edits: 5 },
      ],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries);

    // Switch to Languages tab (index 1)
    dash.handleInput("\x1b[C"); // right arrow
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
    expect(text).toContain("JSON");
    expect(text).toContain("1500");
    expect(text).toContain("800");
    expect(text).toContain("#");
    expect(text).toContain("Language");
    expect(text).toContain("Lines");
    expect(text).toContain("Edits");
  });

  it("Languages tab updates when time range changes", () => {
    const summary1d = {
      ...makeSummary(),
      languages: [{ language: "TypeScript", lines: 100, edits: 3 }],
    };
    const summary7d = {
      ...makeSummary(),
      languages: [
        { language: "TypeScript", lines: 1500, edits: 45 },
        { language: "Go", lines: 200, edits: 8 },
      ],
    };
    const summaries = [summary1d, summary7d, summary7d, summary7d];
    const dash = new Dashboard(summaries);

    // Default range is 7d (index 1). Switch to 1d on Overview tab first
    dash.handleInput("\x1b[A"); // up to 1d on Overview
    // Switch to Languages tab
    dash.handleInput("\x1b[C"); // right to Languages
    let lines = dash.render(80);
    let text = lines.join("\n");
    // Range 1d, only 1 language
    expect(text).toContain("TypeScript");
    expect(text).not.toContain("Go");

    // Switch back to Overview, change to 7d, then back to Languages
    dash.handleInput("\x1b[D"); // left to Overview
    dash.handleInput("\x1b[B"); // down to 7d
    dash.handleInput("\x1b[C"); // right to Languages
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("Go");
  });

  it("Languages tab shows empty state when no language data", () => {
    const summary = { ...makeSummary(), languages: [] };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries);

    dash.handleInput("\x1b[C"); // right to Languages
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No language data");
  });

  // ---- Models tab ----

  it("renders Models tab with header and data rows", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "claude-sonnet-4-20250514", cost: 12.34, calls: 150 },
        { model: "deepseek-v4-pro", cost: 5.67, calls: 80 },
        { model: "gemini-2.0-flash", cost: 1.23, calls: 40 },
      ],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries);

    // Switch to Models tab (index 2)
    dash.handleInput("\x1b[C"); // right to Languages
    dash.handleInput("\x1b[C"); // right to Models
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("#");
    expect(text).toContain("Model");
    expect(text).toContain("Cost");
    expect(text).toContain("Calls");
    expect(text).toContain("Sonnet 4");
    expect(text).toContain("12.34");
    expect(text).toContain("150");
  });

  it("formats model names in Models tab", () => {
    const summary = {
      ...makeSummary(),
      models: [{ model: "claude-sonnet-4-20250514", cost: 1.0, calls: 10 }],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries);

    // Navigate to Models tab
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Sonnet 4");
    expect(text).not.toContain("claude-sonnet-4-20250514");
  });

  it("Models tab shows empty state when no model data", () => {
    const summary = { ...makeSummary(), models: [] };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries);

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No model data");
  });

  it("Models tab updates when time range changes", () => {
    const summary1d = {
      ...makeSummary(),
      models: [{ model: "claude-sonnet-4-20250514", cost: 1.0, calls: 5 }],
    };
    const summary7d = {
      ...makeSummary(),
      models: [
        { model: "claude-sonnet-4-20250514", cost: 12.0, calls: 150 },
        { model: "deepseek-v4-pro", cost: 5.0, calls: 80 },
      ],
    };
    const summaries = [summary1d, summary7d, summary7d, summary7d];
    const dash = new Dashboard(summaries);

    // Change range to 1d on Overview, then navigate to Models
    dash.handleInput("\x1b[A"); // up to 1d on Overview
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    let lines = dash.render(80);
    let text = lines.join("\n");
    // Range 1d, only 1 model
    expect(text).toContain("Sonnet 4");
    expect(text).not.toContain("V4 Pro");

    // Switch back to Overview, change to 7d, then back to Models
    dash.handleInput("\x1b[D"); // left to Languages
    dash.handleInput("\x1b[D"); // left to Overview
    dash.handleInput("\x1b[B"); // down to 7d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("V4 Pro");
  });

  it("Models tab scrolls with up/down", () => {
    const manyModels = Array.from({ length: 20 }, (_, i) => ({
      model: `model-${i}`,
      cost: 20 - i,
      calls: (20 - i) * 10,
    }));
    const summary = { ...makeSummary(), models: manyModels };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries);

    // Navigate to Models tab
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    let lines = dash.render(80);
    // lines[5] = table header, lines[6] = first data row (rank 1)
    expect(lines[6]).toContain("1");
    expect(lines[6]).toContain("Model 0");

    // Scroll down
    dash.handleInput("\x1b[B");
    lines = dash.render(80);
    expect(lines[6]).toContain("2");
    expect(lines[6]).toContain("Model 1");

    // Scroll back up
    dash.handleInput("\x1b[A");
    lines = dash.render(80);
    expect(lines[6]).toContain("1");
    expect(lines[6]).toContain("Model 0");
  });

  it("switches tabs with left/right arrows", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries);
    dash.handleInput("\x1b[C"); // right
    const lines = dash.render(80);
    expect(lines.join("\n")).toContain("Languages");
  });
});

describe("LoadingView", () => {
  it("renders with 0% progress", () => {
    const lv = new LoadingView();
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("Parsing session logs...");
    expect(lines.join("\n")).toContain("0%");
  });

  it("updates progress", () => {
    const lv = new LoadingView();
    lv.setProgress(50);
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("50%");
  });

  it("renders progress bar with block chars", () => {
    const lv = new LoadingView();
    lv.setProgress(75);
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("█");
    expect(lines.join("\n")).toContain("75%");
  });
});
