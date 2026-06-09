import { describe, expect, it } from "vitest";
import { testTheme } from "../../__tests__/components.fixtures";
import { Dashboard } from "../Dashboard";
import { DashboardPopup } from "../DashboardPopup";

describe("DashboardPopup", () => {
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

  it("renders box-drawing border around content", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    const lines = popup.render(80);

    // First line: top border ╭───╮
    expect(lines[0]).toContain("╭");
    expect(lines[0]).toContain("╮");
    expect(lines[0]).toContain("─");

    // Last line: bottom border ╰───╯
    expect(lines[lines.length - 1]).toContain("╰");
    expect(lines[lines.length - 1]).toContain("╯");
    expect(lines[lines.length - 1]).toContain("─");

    // Content lines: side borders │...│
    const contentLines = lines.slice(1, -1);
    expect(contentLines.length).toBeGreaterThan(0);
    for (const line of contentLines) {
      expect(line).toContain("│");
    }
  });

  it("all lines have same width", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    const lines = popup.render(80);

    // Every line should be exactly 80 chars visible width
    for (const line of lines) {
      // Strip theme tags to check visible width
      const stripped = line.replace(/<[/]?(?:b|fg:[^>]+|bg:[^>]+)>/g, "");
      expect(stripped.length).toBe(80);
    }
  });

  it("renders content at inner width (width - 2)", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    // Render at 60: inner content gets 58
    const lines = popup.render(60);
    const text = lines.join("\n");

    // Dashboard content (Overview, KPIs) should still appear
    expect(text).toContain("Overview");
    expect(text).toContain("Total Cost");
    expect(text).toContain("Esc/q close");
  });
});
