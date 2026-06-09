import { describe, it, expect } from "vitest";
import { TabBar, RangeSelector, KpiCards, BarChart, Dashboard, LoadingView } from "../components";

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
