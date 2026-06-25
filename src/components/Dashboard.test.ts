import { describe, expect, it } from "bun:test";
import { makeMockTUI, makeRangeSelector, makeTheme } from "./components.fixtures";
import { makeSummary } from "../compute.fixtures";
import type { StatsSummary, TimeRange } from "../types";
import { Dashboard } from "./Dashboard";

const mockTui = makeMockTUI();
export const allRanges: TimeRange[] = ["1d", "7d", "30d", "All"];

export function mapAllSummaries(ranges: TimeRange[], summary: ReturnType<typeof makeSummary>) {
  return new Map(ranges.map((r) => [r, { ...summary }]));
}

export const ALL_SUMMARIES = mapAllSummaries(allRanges, makeSummary());
const EMPTY_MTP = new Map<string, string>();

describe("Dashboard", () => {
  it("renders all sections", () => {
    const dash = new Dashboard(
      ALL_SUMMARIES,
      EMPTY_MTP,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
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
    const dash = new Dashboard(
      mapAllSummaries(allRanges, zeroSummary),
      EMPTY_MTP,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
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
    const summaries: Map<TimeRange, StatsSummary> = new Map([
      ["1d", zeroSummary],
      ["7d", dataSummary],
      ["30d", dataSummary],
      ["All", dataSummary],
    ]);
    const dash = new Dashboard(
      summaries,
      EMPTY_MTP,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
    dash.handleInput("r");
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No data for this time range");
  });

  it("handles escape to close", () => {
    let closed = false;
    const dash = new Dashboard(
      ALL_SUMMARIES,
      EMPTY_MTP,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
      () => { closed = true; },
    );
    dash.handleInput("\x1b");
    expect(closed).toBe(true);
  });

  it("handles q to close", () => {
    let closed = false;
    const dash = new Dashboard(
      ALL_SUMMARIES,
      EMPTY_MTP,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
      () => { closed = true; },
    );
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
    const dash = new Dashboard(
      mapAllSummaries(allRanges, summary),
      EMPTY_MTP,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
    dash.handleInput("\x1b[C");
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
    const summary1d = { ...makeSummary(), languages: [{ language: "TypeScript", lines: 100, edits: 3 }] };
    const summary7d = { ...makeSummary(), languages: [{ language: "TypeScript", lines: 1500, edits: 45 }, { language: "Go", lines: 200, edits: 8 }] };
    const summaries: Map<TimeRange, StatsSummary> = new Map([
      ["1d", summary1d], ["7d", summary7d], ["30d", summary7d], ["All", summary7d],
    ]);
    const dash = new Dashboard(summaries, EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("r");
    dash.handleInput("\x1b[C");
    let lines = dash.render(80);
    expect(lines.join("\n")).toContain("TypeScript");
    expect(lines.join("\n")).not.toContain("Go");
    dash.handleInput("\x1b[D");
    dash.handleInput("r");
    dash.handleInput("\x1b[C");
    lines = dash.render(80);
    expect(lines.join("\n")).toContain("Go");
  });

  it("Languages tab shows empty state when no language data", () => {
    const summary = { ...makeSummary(), languages: [] };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    const lines = dash.render(80);
    expect(lines.join("\n")).toContain("No language data");
  });

  it("renders Models tab", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "claude-sonnet-4-20250514", cost: 12.34, calls: 150 },
        { model: "deepseek-v4-pro", cost: 5.67, calls: 80 },
        { model: "gemini-2.0-flash", cost: 1.23, calls: 40 },
      ],
    };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    const lines = dash.render(80);
    expect(lines.join("\n")).toContain("Model");
    expect(lines.join("\n")).toContain("Provider");
  });

  it("formats model names in Models tab", () => {
    const summary = { ...makeSummary(), models: [{ model: "claude-sonnet-4-20250514", cost: 1.0, calls: 10 }] };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    const lines = dash.render(80);
    expect(lines.join("\n")).toContain("Claude");
    expect(lines.join("\n")).not.toContain("claude-sonnet-4-20250514");
  });

  it("Models tab shows empty state when no model data", () => {
    const summary = { ...makeSummary(), models: [] };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    expect(dash.render(80).join("\n")).toContain("No model data");
  });

  it("Models tab updates when time range changes", () => {
    const summary1d = { ...makeSummary(), models: [{ model: "claude-sonnet-4-20250514", cost: 1.0, calls: 5 }] };
    const summary7d = { ...makeSummary(), models: [{ model: "claude-sonnet-4-20250514", cost: 12.0, calls: 150 }, { model: "deepseek-v4-pro", cost: 5.0, calls: 80 }] };
    const summaries: Map<TimeRange, StatsSummary> = new Map([
      ["1d", summary1d], ["7d", summary7d], ["30d", summary7d], ["All", summary7d],
    ]);
    const dash = new Dashboard(summaries, EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("r");
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    let lines = dash.render(80);
    expect(lines.join("\n")).toContain("Claude");
    expect(lines.join("\n")).not.toContain("Deeps");
    dash.handleInput("\x1b[D");
    dash.handleInput("\x1b[D");
    dash.handleInput("r");
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    lines = dash.render(80);
    expect(lines.join("\n")).toContain("Deeps");
  });

  it("switches tabs with left/right arrows", () => {
    const dash = new Dashboard(ALL_SUMMARIES, EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    expect(dash.render(80).join("\n")).toContain("Languages");
  });

  it("renders Project tab", () => {
    const summary = {
      ...makeSummary(),
      projects: [{ project: "pi-atlas", cost: 15.5, sessions: 42 }, { project: "dotfiles", cost: 8.2, sessions: 20 }],
      tools: [{ name: "bash", count: 150 }, { name: "read", count: 120 }],
    };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    expect(dash.render(80).join("\n")).toContain("Projects");
  });

  it("Projects tab shows empty states when no data", () => {
    const summary = { ...makeSummary(), projects: [], tools: [] };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    expect(dash.render(80).join("\n")).toContain("No projects data");
  });

  it("Projects tab updates when time range changes", () => {
    const summary1d = { ...makeSummary(), projects: [{ project: "pi-atlas", cost: 1.0, sessions: 5 }] };
    const summary7d = { ...makeSummary(), projects: [{ project: "pi-atlas", cost: 15.5, sessions: 42 }, { project: "dotfiles", cost: 8.2, sessions: 20 }] };
    const summaries: Map<TimeRange, StatsSummary> = new Map([
      ["1d", summary1d], ["7d", summary7d], ["30d", summary7d], ["All", summary7d],
    ]);
    const dash = new Dashboard(summaries, EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("r");
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    let lines = dash.render(80);
    expect(lines.join("\n")).toContain("pi-atlas");
    expect(lines.join("\n")).not.toContain("dotfiles");
    dash.handleInput("\x1b[D");
    dash.handleInput("\x1b[D");
    dash.handleInput("\x1b[D");
    dash.handleInput("r");
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    lines = dash.render(80);
    expect(lines.join("\n")).toContain("dotfiles");
    expect(lines.join("\n")).toContain("pi-atlas");
  });
});
