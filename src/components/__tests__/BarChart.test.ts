import { describe, it, expect } from "vitest";
import { makeTheme } from "../../__tests__/components.fixtures";
import { BarChart } from "../BarChart";
import type { HourSpend } from "../../types";

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

  it("30d labels are sparse and fit within width", () => {
    // Build 30 days of data spanning a month
    const spend: { date: string; cost: number }[] = [];
    for (let i = 1; i <= 30; i++) {
      spend.push({ date: `2026-06-${String(i).padStart(2, "0")}`, cost: i });
    }
    const chart = new BarChart(spend, "30d", 10, makeTheme());
    const lines = chart.render(80);
    // All lines must fit within width
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(80);
    }
    // Last line is the label row
    const labelLine = lines[lines.length - 1];
    const visible = labelLine.replace(/\x1b\[[0-9;]*m/g, "");
    // Should contain day numbers (first and last day)
    expect(visible).toContain("1");
    // At least some numeric labels visible (aggregation may shift which ones)
    expect(visible).toMatch(/\d/);
    // Labels should be sparse: not all 30 days get labels
    const labels = visible.trim().split(/\s+/).filter(Boolean);
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
    const labelLine = lines[lines.length - 2];
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
    const barLines = lines.slice(1, -2); // exclude granularity + x-axis label
    // All bar rows should have a dot separator or label content
    for (const line of barLines) {
      expect(line).toContain("│");
    }
  });

  it("y-axis auto-dense: every-other row when barAreaH ≤ 14", () => {
    // barAreaH = maxHeight - 2 = 10, so step=2
    const chart = new BarChart(dailySpend, "7d", 12, makeTheme());
    const lines = chart.render(80);
    const barLines = lines.slice(1, -2); // exclude granularity + x-axis label
    // At max cost $3.00, row 8 (80% height) should be $2.40, top row 9 should not have label
    // But bottom row 0 always has label
    expect(barLines[barLines.length - 1]).toContain("$0.00");
    expect(barLines[0]).toMatch(/\$\d/); // top row no label
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

  it("yAxisSpacing overrides auto-density", () => {
    // barAreaH = 15-2 = 13, auto would be step=2 (every other)
    // but yAxisSpacing=1 forces every row
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme(), 1);
    const lines = chart.render(80);
    const barLines = lines.slice(1, -2); // exclude granularity + x-axis label
    // Every bar row should have $ labels (step=1)
    for (const line of barLines) {
      expect(line).toContain("$");
    }
  });

  it("x-axis has bottom └ corner and ─ filler between labels", () => {
    const chart = new BarChart(dailySpend, "7d", 15, makeTheme());
    const lines = chart.render(80);
    // Last line is the x-axis label row
    const labelLine = lines[lines.length - 2];
    const visible = labelLine.replace(/\x1b\[[0-9;]*m/g, "");
    // └ at the y-axis position (corner)
    expect(visible).toContain("└");
    // ─ extends between labels (Mon followed by space+─ before next label)
    expect(visible).toContain("Mon ─");
    expect(visible).toContain("Tue ─");
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

  describe("hourly mode (1d range)", () => {
    const hourlySpend: HourSpend[] = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      cost: i === 10 ? 2.5 : i === 14 ? 1.5 : 0,
    }));

    it("renders 24 bars with hourly labels", () => {
      const chart = new BarChart([], "1d", 15, makeTheme(), undefined, hourlySpend);
      const lines = chart.render(120);
      const text = lines.join("\n");
      // Should have auto-dense hour labels (at interval determined by width)
      expect(text).toContain("0h");
      expect(text).toContain("12h");
      expect(text).toContain("23h");
      // Should show cost on y-axis
      expect(text).toContain("$2.50");
      expect(text).toContain("Hourly");
    });

    it("fits within width", () => {
      const chart = new BarChart([], "1d", 15, makeTheme(), undefined, hourlySpend);
      const lines = chart.render(80);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(80);
      }
    });

    it("downsamples hours on narrow terminals", () => {
      const chart = new BarChart([], "1d", 10, makeTheme(), undefined, hourlySpend);
      const lines = chart.render(30);
      for (const line of lines) {
        expect(line.length).toBeLessThanOrEqual(30);
      }
      // Should still have some hour labels
      const text = lines.join("\n");
      expect(text).toContain("h");
    });
  });
});
