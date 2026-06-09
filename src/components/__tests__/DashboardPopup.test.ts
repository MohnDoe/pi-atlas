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

  it("re-renders after handleInput changes state (cache invalidation)", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    // Render once to populate caches
    popup.render(80);

    // Switch to Languages tab via handleInput
    popup.handleInput("\x1b[C"); // right arrow

    // Re-render should show the new tab (not cached Overview)
    const lines = popup.render(80);
    const text = lines.join("\n");
    // Languages tab shows column headers, not the Overview's "Total Cost"
    expect(text).toContain("Language");
    expect(text).not.toContain("Total Cost");
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

  // ---- Tab content pass-through ----

  it("renders Languages tab content through popup", () => {
    const summary = {
      ...makeSummary(),
      languages: [
        { language: "TypeScript", lines: 1500, edits: 45 },
        { language: "Python", lines: 800, edits: 20 },
      ],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    // Navigate to Languages tab
    popup.handleInput("\x1b[C"); // right arrow

    const lines = popup.render(80);
    const text = lines.join("\n");

    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
    expect(text).toContain("1500");
    expect(text).toContain("Language");
    expect(text).toContain("Lines");
    expect(text).toContain("Edits");
  });

  it("renders Models tab content through popup", () => {
    const summary = {
      ...makeSummary(),
      models: [{ model: "claude-sonnet-4-20250514", cost: 12.34, calls: 150 }],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    // Navigate to Models tab
    popup.handleInput("\x1b[C"); // → Languages
    popup.handleInput("\x1b[C"); // → Models

    const lines = popup.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Sonnet 4");
    expect(text).toContain("12.34");
    expect(text).toContain("150");
  });

  it("renders Projects+Tools tab content through popup", () => {
    const summary = {
      ...makeSummary(),
      projects: [{ project: "pi-usage", cost: 15.5, sessions: 42 }],
      tools: [{ tool: "bash", count: 150 }],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    // Navigate to Projects+Tools tab
    popup.handleInput("\x1b[C"); // → Languages
    popup.handleInput("\x1b[C"); // → Models
    popup.handleInput("\x1b[C"); // → Projects + Tools

    const lines = popup.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Project");
    expect(text).toContain("Tool");
    expect(text).toContain("pi-usage");
    expect(text).toContain("bash");
  });

  it("shows empty state through popup when no session data", () => {
    const zeroSummary = {
      ...makeSummary(),
      totalCost: 0,
      sessionCount: 0,
      totalMessages: 0,
      totalTokens: 0,
      dailySpend: [],
    };
    const summaries = [zeroSummary, zeroSummary, zeroSummary, zeroSummary];
    const dash = new Dashboard(summaries, testTheme());
    const popup = new DashboardPopup(dash);

    const lines = popup.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No sessions found");
  });
});
