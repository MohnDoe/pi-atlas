import { describe, expect, it } from "bun:test";
import { makeMockTUI, makeRangeSelector, makeTheme } from "./components.fixtures";
import { makeDayAggs } from "../compute.fixtures";
import { emptyDay } from "../parser";
import type { DayAgg, ModelToProvider, TimeRange } from "../types";
import { Dashboard } from "./Dashboard";

const mockTui = makeMockTUI();
export const allRanges: TimeRange[] = ["1d", "7d", "30d", "All"];

const BASE_DAYS = makeDayAggs();

describe("Dashboard", () => {
  it("renders all sections", () => {
    const { days, modelToProvider } = makeDayAggs();
    const dash = new Dashboard(
      days,
      modelToProvider,
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
    const dash = new Dashboard(
      [],
      new Map(),
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
    // Create days from the past so no range matches
    const d = emptyDay("2025-01-01");
    d.cost = 5.0;
    d.sessionIds = new Set(["s1"]);
    const dash = new Dashboard(
      [d],
      new Map(),
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
    // Default range is All (has data). r key cycles: All→1d (empty)
    dash.handleInput("r");
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No data for this time range");
  });

  it("handles escape to close", () => {
    let closed = false;
    const dash = new Dashboard(
      BASE_DAYS.days,
      BASE_DAYS.modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
      () => {
        closed = true;
      },
    );
    dash.handleInput("\x1b");
    expect(closed).toBe(true);
  });

  it("handles q to close", () => {
    let closed = false;
    const dash = new Dashboard(
      BASE_DAYS.days,
      BASE_DAYS.modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
      () => {
        closed = true;
      },
    );
    dash.handleInput("q");
    expect(closed).toBe(true);
  });

  // ---- Languages tab ----

  it("renders Languages tab when active", () => {
    const today = new Date().toISOString().slice(0, 10);
    const d = emptyDay(today);
    d.cost = 5.0;
    d.sessionIds = new Set(["s1"]);
    d.userMsgs = 1;
    d.asstMsgs = 1;
    d.toolResults = 1;
    d.inTok = 10;
    d.outTok = 10;
    d.langLines = { TypeScript: 1500, Python: 800, JSON: 300 };
    d.langEdits = { TypeScript: 45, Python: 20, JSON: 5 };
    d.modelCost = { "dummy": 1.0 };
    d.modelCount = { "dummy": 1 };

    const dash = new Dashboard(
      [d],
      new Map(),
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

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
    const today = new Date().toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    // Day from today (1d range) — only TypeScript
    const dToday = emptyDay(today);
    dToday.cost = 1.0;
    dToday.sessionIds = new Set(["s1"]);
    dToday.userMsgs = 1;
    dToday.asstMsgs = 1;
    dToday.toolResults = 1;
    dToday.inTok = 10;
    dToday.outTok = 10;
    dToday.langLines = { TypeScript: 100 };
    dToday.langEdits = { TypeScript: 3 };
    dToday.modelCost = { "dummy": 1.0 };
    dToday.modelCount = { "dummy": 1 };

    // Day from past (7d range) — adds Python
    const dPast = emptyDay(twoDaysAgo);
    dPast.cost = 1.0;
    dPast.sessionIds = new Set(["s2"]);
    dPast.userMsgs = 1;
    dPast.asstMsgs = 1;
    dPast.toolResults = 1;
    dPast.inTok = 10;
    dPast.outTok = 10;
    dPast.langLines = { TypeScript: 1400, Go: 200 };
    dPast.langEdits = { TypeScript: 42, Go: 8 };
    dPast.modelCost = { "dummy": 1.0 };
    dPast.modelCount = { "dummy": 1 };

    const dash = new Dashboard(
      [dToday, dPast],
      new Map(),
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    // Default range is All (= both days). r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    // Switch to Languages tab
    dash.handleInput("\x1b[C"); // right to Languages
    let lines = dash.render(80);
    let text = lines.join("\n");
    // Range 1d, only TypeScript
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
    const today = new Date().toISOString().slice(0, 10);
    const d = emptyDay(today);
    d.cost = 5.0;
    d.sessionIds = new Set(["s1"]);
    d.userMsgs = 1;
    d.asstMsgs = 1;
    d.modelCost = { "dummy": 1.0 };
    d.modelCount = { "dummy": 1 };

    const dash = new Dashboard(
      [d],
      new Map(),
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    dash.handleInput("\x1b[C"); // right to Languages
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No language data");
  });

  // ---- Models tab ----

  function makeModelDays(): { days: DayAgg[]; modelToProvider: ModelToProvider } {
    const today = new Date().toISOString().slice(0, 10);
    const days: DayAgg[] = [];
    const modelToProvider: ModelToProvider = new Map([
      ["claude-sonnet-4-20250514", "anthropic"],
      ["deepseek-v4-pro", "deepseek"],
      ["gemini-2.0-flash", "google"],
    ]);

    const models = [
      { model: "claude-sonnet-4-20250514", cost: 12.34, calls: 150 },
      { model: "deepseek-v4-pro", cost: 5.67, calls: 80 },
      { model: "gemini-2.0-flash", cost: 1.23, calls: 40 },
    ];
    for (const m of models) {
      const d = emptyDay(today);
      d.cost = m.cost;
      d.sessionIds = new Set([`s-${m.model}`]);
      d.userMsgs = 1;
      d.asstMsgs = 1;
      d.toolResults = 1;
      d.inTok = 10;
      d.outTok = 10;
      d.langLines = { TypeScript: 100 };
      d.langEdits = { TypeScript: 1 };
      d.modelCost = { [m.model]: m.cost };
      d.modelCount = { [m.model]: m.calls };
      days.push(d);
    }

    return { days, modelToProvider };
  }

  it("renders Models tab", () => {
    const { days, modelToProvider } = makeModelDays();
    const dash = new Dashboard(
      days,
      modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    // Switch to Models tab (index 2)
    dash.handleInput("\x1b[C"); // right to Languages
    dash.handleInput("\x1b[C"); // right to Models
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Model");
    expect(text).toContain("Provider");
  });

  it("formats model names in Models tab", () => {
    const today = new Date().toISOString().slice(0, 10);
    const d = emptyDay(today);
    d.cost = 1.0;
    d.sessionIds = new Set(["s1"]);
    d.userMsgs = 1;
    d.asstMsgs = 1;
    d.toolResults = 1;
    d.inTok = 10;
    d.outTok = 10;
    d.langLines = { TypeScript: 100 };
    d.langEdits = { TypeScript: 1 };
    d.modelCost = { "claude-sonnet-4-20250514": 1.0 };
    d.modelCount = { "claude-sonnet-4-20250514": 10 };

    const modelToProvider: ModelToProvider = new Map([
      ["claude-sonnet-4-20250514", "anthropic"],
    ]);

    const dash = new Dashboard(
      [d],
      modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    // Navigate to Models tab
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Claude");
    expect(text).not.toContain("claude-sonnet-4-20250514");
  });

  it("Models tab shows empty state when no model data", () => {
    const today = new Date().toISOString().slice(0, 10);
    const d = emptyDay(today);
    d.cost = 5.0;
    d.sessionIds = new Set(["s1"]);
    d.userMsgs = 1;
    d.asstMsgs = 1;
    d.toolResults = 1;
    d.inTok = 10;
    d.outTok = 10;

    const dash = new Dashboard(
      [d],
      new Map(),
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No model data");
  });

  it("Models tab updates when time range changes", () => {
    const today = new Date().toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const modelToProvider: ModelToProvider = new Map([
      ["claude-sonnet-4-20250514", "anthropic"],
      ["deepseek-v4-pro", "deepseek"],
    ]);

    // Today: only claude
    const dToday = emptyDay(today);
    dToday.cost = 1.0;
    dToday.sessionIds = new Set(["s1"]);
    dToday.userMsgs = 1;
    dToday.asstMsgs = 1;
    dToday.toolResults = 1;
    dToday.inTok = 10;
    dToday.outTok = 10;
    dToday.langLines = { TypeScript: 100 };
    dToday.langEdits = { TypeScript: 1 };
    dToday.modelCost = { "claude-sonnet-4-20250514": 1.0 };
    dToday.modelCount = { "claude-sonnet-4-20250514": 5 };

    // Past: adds deepseek
    const dPast = emptyDay(twoDaysAgo);
    dPast.cost = 5.0;
    dPast.sessionIds = new Set(["s2"]);
    dPast.userMsgs = 1;
    dPast.asstMsgs = 1;
    dPast.toolResults = 1;
    dPast.inTok = 10;
    dPast.outTok = 10;
    dPast.langLines = { TypeScript: 100 };
    dPast.langEdits = { TypeScript: 1 };
    dPast.modelCost = { "deepseek-v4-pro": 5.0 };
    dPast.modelCount = { "deepseek-v4-pro": 80 };

    const dash = new Dashboard(
      [dToday, dPast],
      modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    // Default range is All. r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    let lines = dash.render(80);
    let text = lines.join("\n");
    // Range 1d, only Claude
    expect(text).toContain("Claude");
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
    const { days, modelToProvider } = makeDayAggs();
    const dash = new Dashboard(
      days,
      modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
    dash.handleInput("\x1b[C"); // right
    const lines = dash.render(80);
    expect(lines.join("\n")).toContain("Languages");
  });

  // ---- Projects tab ----

  it("renders Project tab", () => {
    const today = new Date().toISOString().slice(0, 10);
    const d = emptyDay(today);
    d.cost = 15.5;
    d.sessionIds = new Set(["s1"]);
    d.userMsgs = 1;
    d.asstMsgs = 1;
    d.toolResults = 1;
    d.inTok = 10;
    d.outTok = 10;
    d.langLines = { TypeScript: 100 };
    d.langEdits = { TypeScript: 1 };
    d.modelCost = { "dummy": 1.0 };
    d.modelCount = { "dummy": 1 };
    d.toolCount = { bash: 150, read: 120 };
    d.projectCost = { "pi-atlas": 15.5, dotfiles: 8.2 };
    d.projectSessions = { "pi-atlas": new Set(["s1"]), dotfiles: new Set(["s1"]) };

    const dash = new Dashboard(
      [d],
      new Map(),
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    // Navigate to Projects tab (index 3)
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Projects");
  });

  it("Projects tab shows empty states when no data", () => {
    const today = new Date().toISOString().slice(0, 10);
    const d = emptyDay(today);
    d.cost = 5.0;
    d.sessionIds = new Set(["s1"]);
    d.userMsgs = 1;
    d.asstMsgs = 1;
    d.toolResults = 1;
    d.inTok = 10;
    d.outTok = 10;
    d.modelCost = { "dummy": 1.0 };
    d.modelCount = { "dummy": 1 };

    const dash = new Dashboard(
      [d],
      new Map(),
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No projects data");
  });

  it("Projects tab updates when time range changes", () => {
    const today = new Date().toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    // Today: only pi-atlas
    const dToday = emptyDay(today);
    dToday.cost = 1.0;
    dToday.sessionIds = new Set(["s1"]);
    dToday.userMsgs = 1;
    dToday.asstMsgs = 1;
    dToday.toolResults = 1;
    dToday.inTok = 10;
    dToday.outTok = 10;
    dToday.modelCost = { "dummy": 1.0 };
    dToday.modelCount = { "dummy": 1 };
    dToday.projectCost = { "pi-atlas": 1.0 };
    dToday.projectSessions = { "pi-atlas": new Set(["s1"]) };

    // Past: adds dotfiles
    const dPast = emptyDay(twoDaysAgo);
    dPast.cost = 8.2;
    dPast.sessionIds = new Set(["s2"]);
    dPast.userMsgs = 1;
    dPast.asstMsgs = 1;
    dPast.toolResults = 1;
    dPast.inTok = 10;
    dPast.outTok = 10;
    dPast.modelCost = { "dummy": 1.0 };
    dPast.modelCount = { "dummy": 1 };
    dPast.projectCost = { dotfiles: 8.2 };
    dPast.projectSessions = { dotfiles: new Set(["s2"]) };

    const dash = new Dashboard(
      [dToday, dPast],
      new Map(),
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    // Default range is All. r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects
    let lines = dash.render(80);
    let text = lines.join("\n");
    // 1d range: only pi-atlas
    expect(text).toContain("pi-atlas");
    expect(text).not.toContain("dotfiles");

    // Switch back to Overview, r to 7d, then back to Projects
    dash.handleInput("\x1b[D"); // ← Models
    dash.handleInput("\x1b[D"); // ← Languages
    dash.handleInput("\x1b[D"); // ← Overview
    dash.handleInput("r"); // 1d → 7d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("dotfiles");
    expect(text).toContain("pi-atlas");
  });
});
