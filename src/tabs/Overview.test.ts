import { visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "bun:test";
import { makeTheme } from "../components/components.fixtures";
import { makeSummary } from "../compute.fixtures";
import { type StatsSummary } from "../types";
import { Overview } from "./Overview";

describe("Overview", () => {
  const mockSummary: StatsSummary = {
    ...makeSummary(),
    totalCost: 12.34,
    sessionCount: 42,
    totalMessages: 1500,
    totalTokens: 250000,
    daysActive: 7,
    avgCostPerDay: 1.76,
    dailySpend: [
      { date: "2026-06-01", cost: 1.0 },
      { date: "2026-06-02", cost: 0.0 },
      { date: "2026-06-03", cost: 2.5 },
      { date: "2026-06-04", cost: 0.5 },
      { date: "2026-06-05", cost: 0.0 },
      { date: "2026-06-06", cost: 1.2 },
      { date: "2026-06-07", cost: 3.0 },
    ],
  };

  it("renders KpiCards followed by BarChart", () => {
    const overview = new Overview(mockSummary, "7d", new Map(), makeTheme(), 15);
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

    // Chart content (█ or label) should appear after the KPIs
    const chartIdx = lines.findIndex(
      (l) => l.includes("█") || l.includes("No data") || l.includes("Mon"),
    );
    expect(chartIdx).toBeGreaterThan(kpiCostIdx);
  });

  it("adapts bar chart height to available space after KpiCards", () => {
    // Use a small maxHeight to verify chart still renders
    const overview = new Overview(mockSummary, "7d", new Map(), makeTheme(), 10);
    const lines = overview.render(80);

    // Chart should still render (not zero lines)
    const text = lines.join("\n");
    expect(text).toContain("█");
  });

  it("shows 'No data' when daily spend is empty", () => {
    const summary: StatsSummary = {
      ...mockSummary,
      dailySpend: [],
    };
    const overview = new Overview(summary, "7d", new Map(), makeTheme(), 15);
    const lines = overview.render(80);

    const text = lines.join("\n");
    expect(text).toContain("No data");
    // KPI cards still render
    expect(text).toContain("Total");
  });

  it("invalidate clears cache and re-renders at new width", () => {
    const overview = new Overview(mockSummary, "7d", new Map(), makeTheme(), 15);

    const linesBefore = overview.render(80);
    for (const line of linesBefore) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(80);
      expect(visibleWidth(line)).toBeGreaterThanOrEqual(78);
    }
    overview.invalidate();

    const lines = overview.render(60);
    for (const line of lines) {
      expect(visibleWidth(line)).toBeLessThanOrEqual(60);
      expect(visibleWidth(line)).toBeGreaterThanOrEqual(58);
    }
  });
});
