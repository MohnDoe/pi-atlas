import { describe, expect, it } from "bun:test";
import { makeMockTUI, makeTheme } from "../../__tests__/components.fixtures";
import { makeSummary } from "../../__tests__/compute.fixtures";
import type { StatsSummary, TimeRange } from "../../types";
import { Dashboard } from "../Dashboard";

const mockTui = makeMockTUI();
export const allRanges: TimeRange[] = ["1d", "7d", "30d", "All"];

export function mapAllSummaries(ranges: TimeRange[], summary: ReturnType<typeof makeSummary>) {
  return new Map(ranges.map((r) => [r, { ...summary }]));
}

export const ALL_SUMMARIES = mapAllSummaries(allRanges, makeSummary());

describe("Dashboard", () => {
  it("renders all sections", () => {
    const summaries = ALL_SUMMARIES;
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Overview");
    expect(text).toContain("All time");
    expect(text).toContain("Total");
    expect(text).toContain("Esc/q close");
    expect(text).toContain("█");
  });

  it("shows 'No sessions found' when no session data exists", () => {
    const zeroSummary = {
      ...makeSummary(),
      totalCost: 0,
      sessionCount: 0,
      totalMessages: 0,
      totalTokens: 0,
      dailySpend: [],
    };
    const summaries = mapAllSummaries(allRanges, zeroSummary);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No sessions found");
  });

  it("shows 'No data for this time range' when current range is empty", () => {
    const dataSummary = { ...makeSummary(), totalCost: 5.0, sessionCount: 3 };
    const zeroSummary = {
      ...makeSummary(),
      totalCost: 0,
      sessionCount: 0,
      totalMessages: 0,
      totalTokens: 0,
      dailySpend: [],
    };
    // 1d range empty, others have data
    const summaries: Map<TimeRange, StatsSummary> = new Map([
      ["1d", zeroSummary],
      ["7d", dataSummary],
      ["30d", dataSummary],
      ["All", dataSummary],
    ]);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);
    // Default range is All. r key cycles: All→1d
    dash.handleInput("r");
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No data for this time range");
  });

  it("handles escape to close", () => {
    const summaries = ALL_SUMMARIES;
    let closed = false;
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null, () => {
      closed = true;
    });
    dash.handleInput("\x1b");
    expect(closed).toBe(true);
  });

  it("handles q to close", () => {
    const summaries = ALL_SUMMARIES;
    let closed = false;
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null, () => {
      closed = true;
    });
    dash.handleInput("q");
    expect(closed).toBe(true);
  });

  it("renders Languages tab when active", () => {
    const summary = {
      ...makeSummary(),
      languages: [
        { language: "TypeScript", lines: 1500, edits: 45 },
        { language: "Python", lines: 800, edits: 20 },
        { language: "JSON", lines: 300, edits: 5 },
      ],
    };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    // Switch to Languages tab (index 1)
    dash.handleInput("\x1b[C"); // right arrow
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Languages");
    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
    expect(text).toContain("JSON");
    expect(text).toContain("1.5k");
    expect(text).toContain("800");
  });

  it("Languages tab updates when time range changes", () => {
    const summary1d = {
      ...makeSummary(),
      languages: [{ language: "TypeScript", lines: 100, edits: 3 }],
    };
    const summary7d = {
      ...makeSummary(),
      languages: [
        { language: "TypeScript", lines: 1500, edits: 45 },
        { language: "Go", lines: 200, edits: 8 },
      ],
    };
    const summaries: Map<TimeRange, StatsSummary> = new Map([
      ["1d", summary1d],
      ["7d", summary7d],
      ["30d", summary7d],
      ["All", summary7d],
    ]);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    // Default range is All (= summary7d). r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    // Switch to Languages tab
    dash.handleInput("\x1b[C"); // right to Languages
    let lines = dash.render(80);
    let text = lines.join("\n");
    // Range 1d, only 1 language
    expect(text).toContain("TypeScript");
    expect(text).not.toContain("Go");

    // Switch back to Overview, r to 7d, then back to Languages
    dash.handleInput("\x1b[D"); // left to Overview
    dash.handleInput("r"); // 1d → 7d
    dash.handleInput("\x1b[C"); // right to Languages
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("Go");
  });

  it("Languages tab shows empty state when no language data", () => {
    const summary = { ...makeSummary(), languages: [] };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    dash.handleInput("\x1b[C"); // right to Languages
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No language data");
  });

  // ---- Models tab ----

  it("renders Models tab", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "claude-sonnet-4-20250514", cost: 12.34, calls: 150 },
        { model: "deepseek-v4-pro", cost: 5.67, calls: 80 },
        { model: "gemini-2.0-flash", cost: 1.23, calls: 40 },
      ],
    };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    // Switch to Models tab (index 2)
    dash.handleInput("\x1b[C"); // right to Languages
    dash.handleInput("\x1b[C"); // right to Models
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Model");
    expect(text).toContain("Provider");
  });

  it("formats model names in Models tab", () => {
    const summary = {
      ...makeSummary(),
      models: [{ model: "claude-sonnet-4-20250514", cost: 1.0, calls: 10 }],
    };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    // Navigate to Models tab
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Claude");
    expect(text).not.toContain("claude-sonnet-4-20250514");
  });

  it("Models tab shows empty state when no model data", () => {
    const summary = { ...makeSummary(), models: [] };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No model data");
  });

  it("Models tab updates when time range changes", () => {
    const summary1d = {
      ...makeSummary(),
      models: [{ model: "claude-sonnet-4-20250514", cost: 1.0, calls: 5 }],
    };
    const summary7d = {
      ...makeSummary(),
      models: [
        { model: "claude-sonnet-4-20250514", cost: 12.0, calls: 150 },
        { model: "deepseek-v4-pro", cost: 5.0, calls: 80 },
      ],
    };
    const summaries: Map<TimeRange, StatsSummary> = new Map([
      ["1d", summary1d],
      ["7d", summary7d],
      ["30d", summary7d],
      ["All", summary7d],
    ]);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    // Default range is All (= summary7d). r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    let lines = dash.render(80);
    let text = lines.join("\n");
    // Range 1d, only 1 model
    expect(text).toContain("Claude");
    // deepseek-v4-pro → "Deeps…" visible truncated name in 7d range
    expect(text).not.toContain("Deeps");

    // Switch back to Overview, r to 7d, then back to Models
    dash.handleInput("\x1b[D"); // left to Languages
    dash.handleInput("\x1b[D"); // left to Overview
    dash.handleInput("r"); // 1d → 7d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("Deeps");
  });

  it("switches tabs with left/right arrows", () => {
    const summaries = ALL_SUMMARIES;
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);
    dash.handleInput("\x1b[C"); // right
    const lines = dash.render(80);
    expect(lines.join("\n")).toContain("Languages");
  });

  // ---- Projects tab ----

  it("renders Project tab", () => {
    const summary = {
      ...makeSummary(),
      projects: [
        { project: "pi-atlas", cost: 15.5, sessions: 42 },
        { project: "dotfiles", cost: 8.2, sessions: 20 },
      ],
      tools: [
        { name: "bash", count: 150 },
        { name: "read", count: 120 },
      ],
    };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    // Navigate to Projects+Tools tab (index 3)
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects + Tools
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Projects");
  });

  it("Projects tab shows empty states when no data", () => {
    const summary = { ...makeSummary(), projects: [], tools: [] };
    const summaries = mapAllSummaries(allRanges, summary);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects + Tools
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No projects data");
  });

  it("Projects tab updates when time range changes", () => {
    const summary1d = {
      ...makeSummary(),
      projects: [{ project: "pi-atlas", cost: 1.0, sessions: 5 }],
    };
    const summary7d = {
      ...makeSummary(),
      projects: [
        { project: "pi-atlas", cost: 15.5, sessions: 42 },
        { project: "dotfiles", cost: 8.2, sessions: 20 },
      ],
    };
    const summaries: Map<TimeRange, StatsSummary> = new Map([
      ["1d", summary1d],
      ["7d", summary7d],
      ["30d", summary7d],
      ["All", summary7d],
    ]);
    const dash = new Dashboard(summaries, makeTheme(), mockTui, null);

    // Default range is All (= summary7d). r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects
    let lines = dash.render(80);
    let text = lines.join("\n");
    // 1d range: only pi-atlas
    expect(text).toContain("pi-atlas");
    expect(text).not.toContain("dotfiles");

    // Switch back to Overview, r to 7d, then back to Projects+Tools
    dash.handleInput("\x1b[D"); // ← Models
    dash.handleInput("\x1b[D"); // ← Languages
    dash.handleInput("\x1b[D"); // ← Overview
    dash.handleInput("r"); // 1d → 7d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects + Tools
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("dotfiles");
    expect(text).toContain("pi-atlas");
  });
});
