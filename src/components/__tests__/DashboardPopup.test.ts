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

  // ---- Delegation ----

  it("delegates handleInput to inner Dashboard", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    let closed = false;
    const dash = new Dashboard(summaries, testTheme(), () => {
      closed = true;
    });
    const popup = new DashboardPopup(dash);

    popup.handleInput("\x1b"); // escape
    expect(closed).toBe(true);
  });

  it("delegates invalidate to inner Dashboard", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    // Render once to populate cache
    popup.render(80);

    // Switch to Languages tab to change state
    popup.handleInput("\x1b[C"); // right arrow
    popup.invalidate();

    // Re-render should show Languages tab
    const lines = popup.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Languages");
  });

  it("caches rendered output and invalidates on width change", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    const lines80 = popup.render(80);
    const lines60 = popup.render(60);

    // Different widths produce different output
    expect(lines80[0]).not.toBe(lines60[0]);
  });
});
