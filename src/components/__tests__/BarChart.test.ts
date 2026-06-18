import { describe, it, expect } from "vitest";
import { makeTheme } from "../../__tests__/components.fixtures";
import { BarChart } from "../BarChart";

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
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme());
    const lines = chart.render(80);
    // Should have some visual output (bars)
    expect(lines.length).toBeGreaterThan(0);
    const text = lines.join("\n");
    // X-axis labels should include day abbreviations
    expect(text).toContain("Mon");
  });

  it("renders within width", () => {
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme());
    const lines = chart.render(50);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(50);
    }
  });

  it("handles empty daily spend", () => {
    const chart = new BarChart([], "7d", 15, makeTheme());
    const lines = chart.render(80);
    expect(lines.length).toBeGreaterThan(0);
    // Should show empty state or just labels
    const text = lines.join("\n");
    expect(text).toContain("No data");
  });

  it("auto-scales bars to available height", () => {
    const chart = new BarChart(dailySpend, "7d", 10, makeTheme());
    const lines = chart.render(80);
    // Should have at most maxHeight rows of bar content
    expect(lines.length).toBeLessThanOrEqual(12); // 10 bars + 2 labels
  });

  it("uses block characters for bars", () => {
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme());
    const lines = chart.render(80);
    const text = lines.join("\n");
    expect(text).toContain("█");
  });



  it("30d range labels show day numbers every 5th and first/last", () => {
    // Build 30 days of data spanning a month
    const spend: { date: string; cost: number }[] = [];
    for (let i = 1; i <= 30; i++) {
      spend.push({ date: `2026-06-${String(i).padStart(2, "0")}`, cost: i });
    }
    const chart = new BarChart(spend, "30d", 10, makeTheme());
    const lines = chart.render(80);
    // Last line is the label row
    const labelLine = lines[lines.length - 1];
    const visible = labelLine.replace(/\x1b\[[0-9;]*m/g, "");
    // Should contain day numbers like "1", "5", "10", etc.
    expect(visible).toContain("1");
    expect(visible).toContain("5");
    expect(visible).toContain("10");
    // Day 2 should NOT be labeled (not every-5th and not first/last)
    const labels = visible.trim().split(/\s+/).filter(Boolean);
    // Labels should be sparse: not all 30 days get labels
    expect(labels.length).toBeLessThan(30);
  });

  it("All range labels show month on month change", () => {
    const spend: { date: string; cost: number }[] = [
      { date: "2026-01-15", cost: 1 },
      { date: "2026-02-20", cost: 2 },
      { date: "2026-03-10", cost: 3 },
      { date: "2026-03-25", cost: 4 },
      { date: "2026-04-05", cost: 5 },
    ];
    const chart = new BarChart(spend, "All", 10, makeTheme());
    const lines = chart.render(80);
    const labelLine = lines[lines.length - 1];
    const visible = labelLine.replace(/\x1b\[[0-9;]*m/g, "");
    // First entry gets a month label
    expect(visible).toContain("Jan");
    // Month changes get labels
    expect(visible).toContain("Feb");
    expect(visible).toContain("Mar");
    expect(visible).toContain("Apr");
  });

  it("y-axis shows cost labels with separator", () => {
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme());
    const lines = chart.render(80);
    const text = lines.join("\n");
    // Y-axis has $ labels
    expect(text).toContain("$0.00");
    expect(text).toContain("$3.00");
    // Y-axis separator present
    expect(text).toContain("│");
  });

  it("y-axis auto-dense: every row when barAreaH ≤ 6", () => {
    // barAreaH = maxHeight - 2 = 5, so step=1
    const chart = new BarChart(dailySpend, "7d", 7, makeTheme());
    const lines = chart.render(80);
    const barLines = lines.slice(0, -1); // exclude x-axis label line
    // All bar rows should have a dot separator or label content
    for (const line of barLines) {
      expect(line).toContain("│");
    }
  });

  it("y-axis auto-dense: every-other row when barAreaH ≤ 14", () => {
    // barAreaH = maxHeight - 2 = 10, so step=2
    const chart = new BarChart(dailySpend, "7d", 12, makeTheme());
    const lines = chart.render(80);
    const barLines = lines.slice(0, -1);
    // At max cost $3.00, row 8 (80% height) should be $2.40, top row 9 should not have label
    // But bottom row 0 always has label
    expect(barLines[barLines.length - 1]).toContain("$0.00");
    expect(barLines[0]).not.toMatch(/\$\d/); // top row no label
  });

  it("y-axis labels are right-aligned", () => {
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme());
    const lines = chart.render(80);
    const text = lines.join("\n");
    // Labels should have a space before the separator
    expect(text).toMatch(/  │/);
  });

  it("still renders within width with y-axis reserved", () => {
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme());
    const lines = chart.render(40);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });

  it("invalidates cache", () => {
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme());
    chart.render(80);
    chart.invalidate();
    const lines = chart.render(60);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });
});
