import { describe, it, expect } from "vitest";
import { Overview } from "../Overview";
import type { BarChartTheme } from "../../components/BarChart";
import type { StatCardTheme } from "../../components/StatCard";

const identityTheme: StatCardTheme & BarChartTheme = {
  fg: (_, text) => text,
};

describe("Overview", () => {
  const kpis = {
    totalCost: 12.34,
    sessionCount: 42,
    totalMessages: 1500,
    totalTokens: 250000,
    daysActive: 7,
    avgCostPerDay: 1.76,
  };

  const dailySpend = [
    { date: "2026-06-01", cost: 1.0 },
    { date: "2026-06-02", cost: 0.0 },
    { date: "2026-06-03", cost: 2.5 },
    { date: "2026-06-04", cost: 0.5 },
    { date: "2026-06-05", cost: 0.0 },
    { date: "2026-06-06", cost: 1.2 },
    { date: "2026-06-07", cost: 3.0 },
  ];

  it("renders KpiCards followed by spacer followed by BarChart", () => {
    const overview = new Overview(kpis, dailySpend, "7d", identityTheme, 15);
    const lines = overview.render(80);

    // Should have KPI + spacer + chart
    expect(lines.length).toBeGreaterThanOrEqual(3);

    const text = lines.join("\n");
    // KPI metrics present
    expect(text).toContain("12.34");
    expect(text).toContain("42");
    // Chart bars present
    expect(text).toContain("█");

    // Verify order: KPI lines before spacer before chart bars
    // Find first occurrence of spacer (empty line) after KPI content
    const kpiCostIdx = lines.findIndex(
      (l) => l.includes("12.34") || l.includes("$12.34") || l.includes("Total"),
    );
    const spacerIdx = lines.findIndex((l) => l.trim() === "");
    expect(spacerIdx).toBeGreaterThan(kpiCostIdx);

    // Chart content (█ or label) should appear after the spacer
    const chartIdx = lines.findIndex(
      (l, i) => i > spacerIdx && (l.includes("█") || l.includes("No data") || l.includes("Mon")),
    );
    expect(chartIdx).toBeGreaterThan(spacerIdx);
  });

  it("adapts bar chart height to available space after KpiCards", () => {
    // Use a small maxHeight to verify chart still renders
    const overview = new Overview(kpis, dailySpend, "7d", identityTheme, 10);
    const lines = overview.render(80);

    // Chart should still render (not zero lines)
    const text = lines.join("\n");
    expect(text).toContain("█");
    // Should have spacer before chart
    expect(lines.some((l) => l.trim() === "")).toBe(true);
  });

  it("shows 'No data' when daily spend is empty", () => {
    const overview = new Overview(kpis, [], "7d", identityTheme, 15);
    const lines = overview.render(80);

    const text = lines.join("\n");
    expect(text).toContain("No data");
    // KPI cards still render
    expect(text).toContain("Total");
  });

  it("handleInput is a no-op", () => {
    const overview = new Overview(kpis, dailySpend, "7d", identityTheme, 15);
    const before = overview.render(80);

    overview.handleInput("up");
    overview.handleInput("down");
    overview.handleInput("enter");

    const after = overview.render(80);
    expect(after).toEqual(before);
  });

  it("invalidate clears cache and re-renders at new width", () => {
    const overview = new Overview(kpis, dailySpend, "7d", identityTheme, 15);
    overview.render(80);
    overview.invalidate();

    const lines = overview.render(60);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });
});
