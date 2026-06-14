import { describe, it, expect } from "vitest";
import { KpiCards } from "../KpiCards";
import type { StatCardTheme } from "../StatCard";

const identityTheme: StatCardTheme = {
  fg: (_, text) => text,
};

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
    const cards = new KpiCards(kpis, identityTheme);
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
    const cards = new KpiCards(kpis, identityTheme);
    const lines = cards.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Total");
    expect(text).toContain("Sessions");
    expect(text).toContain("Messages");
    expect(text).toContain("Tokens");
    expect(text).toContain("Active");
    expect(text).toContain("Avg/Day");
  });

  it("renders within width", () => {
    const cards = new KpiCards(kpis, identityTheme);
    const lines = cards.render(50);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(50);
    }
  });

  it("formats large token numbers", () => {
    const cards = new KpiCards({ ...kpis, totalTokens: 1500000 }, identityTheme);
    const lines = cards.render(80);
    expect(lines.join("\n")).toContain("1.50M");
  });

  it("formats large costs with compact notation", () => {
    const cards = new KpiCards({ ...kpis, totalCost: 5432.1 }, identityTheme);
    const lines = cards.render(80);
    expect(lines.join("\n")).toContain("$5.4k");
  });

  it("formats very large costs with M notation", () => {
    const cards = new KpiCards({ ...kpis, totalCost: 2_500_000 }, identityTheme);
    const lines = cards.render(80);
    expect(lines.join("\n")).toContain("$2.5M");
  });

  it("keeps exact notation for small costs", () => {
    const cards = new KpiCards(kpis, identityTheme);
    const lines = cards.render(80);
    expect(lines.join("\n")).toContain("$12.34");
  });

  it("invalidates cache", () => {
    const cards = new KpiCards(kpis, identityTheme);
    cards.render(80);
    cards.invalidate();
    const lines = cards.render(60);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(60);
    }
  });
});
