import { describe, expect, it } from "vitest";
import { makeMockTUI, makeTheme } from "../../__tests__/components.fixtures";
import { Dashboard } from "../Dashboard";
import { DashboardPopup } from "../DashboardPopup";
import { makeSummary } from "../../__tests__/compute.fixtures";
import { ALL_SUMMARIES, allRanges, mapAllSummaries } from "./Dashboard.test";

const mockTui = makeMockTUI();

describe("DashboardPopup", () => {
  it("renders box-drawing border around content", () => {
    const dash = new Dashboard(ALL_SUMMARIES, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

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
    const dash = new Dashboard(ALL_SUMMARIES, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

    const lines = popup.render(80);

    // Every line should be exactly 80 chars visible width
    for (const line of lines) {
      const stripped = line.replace(/\x1b\[[0-9;]*m/g, "");
      expect(stripped.length).toBe(80);
    }
  });

  it("renders content at inner width (width - 2)", () => {
    const dash = new Dashboard(ALL_SUMMARIES, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

    // Render at 60: inner content gets 58
    const lines = popup.render(60);
    const text = lines.join("\n");

    // Dashboard content (Overview, KPIs) should still appear
    expect(text).toContain("Overview");
    expect(text).toContain("Total");
    expect(text).toContain("Esc/q close");
  });

  // ---- Delegation ----

  it("delegates handleInput to inner Dashboard", () => {
    let closed = false;
    const dash = new Dashboard(ALL_SUMMARIES, makeTheme(), false, null, mockTui, () => {
      closed = true;
    });
    const popup = new DashboardPopup(dash, makeTheme());

    popup.handleInput("\x1b"); // escape
    expect(closed).toBe(true);
  });

  it("re-renders after handleInput changes state (cache invalidation)", () => {
    const dash = new Dashboard(ALL_SUMMARIES, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

    // Render once to populate caches
    popup.render(80);

    // Switch to Languages tab via handleInput
    popup.handleInput("\x1b[C"); // right arrow

    // Re-render should show the new tab (not cached Overview)
    const lines = popup.render(80);
    const text = lines.join("\n");
    // Languages tab shows column headers, not the Overview's "Total"
    expect(text).toContain("Language");
    expect(text).not.toContain("Total");
  });

  it("delegates invalidate to inner Dashboard", () => {
    const dash = new Dashboard(ALL_SUMMARIES, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

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
    const dash = new Dashboard(ALL_SUMMARIES, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

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
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

    // Navigate to Languages tab
    popup.handleInput("\x1b[C"); // right arrow

    const lines = popup.render(80);
    const text = lines.join("\n");

    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
    expect(text).toContain("1.5k");
  });

  it("renders Models tab content through popup", () => {
    const summary = {
      ...makeSummary(),
      models: [{ model: "claude-sonnet-4-20250514", cost: 12.34, calls: 150 }],
    };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

    // Navigate to Models tab
    popup.handleInput("\x1b[C"); // → Languages
    popup.handleInput("\x1b[C"); // → Models

    const lines = popup.render(80);
    const text = lines.join("\n");

    // Model column narrow in popup — only prefix visible
    expect(text).toContain("Clau");
    expect(text).toContain("12.34");
    expect(text).toContain("150");
  });

  it("renders Projects tab content through popup", () => {
    const summary = {
      ...makeSummary(),
      projects: [{ project: "pi-usage", cost: 15.5, sessions: 42 }],
    };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

    // Navigate to Projects+Tools tab
    popup.handleInput("\x1b[C"); // → Languages
    popup.handleInput("\x1b[C"); // → Models
    popup.handleInput("\x1b[C"); // → Projects + Tools

    const lines = popup.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Projects");
    expect(text).toContain("$15.50");
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
    const summaries = mapAllSummaries(allRanges, zeroSummary);
    const dash = new Dashboard(summaries, makeTheme(), false, null, mockTui);
    const popup = new DashboardPopup(dash, makeTheme());

    const lines = popup.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No sessions found");
  });
});
