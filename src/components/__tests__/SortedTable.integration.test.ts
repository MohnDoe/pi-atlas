import { describe, expect, it } from "bun:test";
import type { DayAgg, ModelToProvider } from "../../types";
import { makeMockTUI, makeRangeSelector, makeTheme } from "../components.fixtures";
import { Dashboard } from "../Dashboard";
import { SortedTable } from "../SortedTable";
import { emptyDay } from "../../parser";

const CURSOR = SortedTable.DEFAULT_CURSOR_CHAR;
const mockTui = makeMockTUI();

function modelDays(models: Array<{ model: string; cost: number; calls: number; provider: string }>): { days: DayAgg[]; modelToProvider: ModelToProvider } {
  const today = new Date().toISOString().slice(0, 10);
  const days: DayAgg[] = [];
  const modelToProvider: ModelToProvider = new Map();

  for (const m of models) {
    modelToProvider.set(m.model, m.provider);
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

describe("Dashboard → Models → SortedTable arrow key integration", () => {
  /** Check if any line contains cursor and a model name substring. */
  function cursorOnModel(lines: string[], model: string): boolean {
    return lines.some((l) => l.includes(CURSOR) && l.includes(model));
  }

  it("initial cursor on first model", () => {
    const { days, modelToProvider } = modelDays([
      { model: "alpha-model", cost: 10, calls: 100, provider: "p1" },
      { model: "beta-model", cost: 5, calls: 50, provider: "p2" },
    ]);
    const dash = new Dashboard(
      days,
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

    // Model column is 6-char fill at width 80 — only first word visible
    expect(cursorOnModel(lines, "Alpha")).toBe(true);
    expect(cursorOnModel(lines, "Beta")).toBe(false);
  });

  it("down arrow moves cursor to next row via Dashboard dispatch", () => {
    const { days, modelToProvider } = modelDays([
      { model: "alpha-model", cost: 10, calls: 100, provider: "p1" },
      { model: "beta-model", cost: 5, calls: 50, provider: "p2" },
      { model: "gamma-model", cost: 1, calls: 10, provider: "p3" },
    ]);
    const dash = new Dashboard(
      days,
      modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.render(80);

    // Press down
    dash.handleInput("\x1b[B");
    const lines = dash.render(80);
    // Cursor moves from row 0 to row 1
    expect(cursorOnModel(lines, "Beta")).toBe(true);
    expect(cursorOnModel(lines, "Alpha")).toBe(false);
  });

  it("up arrow moves cursor up", () => {
    const { days, modelToProvider } = modelDays([
      { model: "alpha-model", cost: 10, calls: 100, provider: "p1" },
      { model: "beta-model", cost: 5, calls: 50, provider: "p2" },
      { model: "gamma-model", cost: 1, calls: 10, provider: "p3" },
    ]);
    const dash = new Dashboard(
      days,
      modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.render(80);

    // Move down twice, then back up once
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[A");
    const lines = dash.render(80);

    expect(cursorOnModel(lines, "Beta")).toBe(true);
    expect(cursorOnModel(lines, "Alpha")).toBe(false);
    expect(cursorOnModel(lines, "Gamma")).toBe(false);
  });

  it("arrow keys work across range switches", () => {
    const today = new Date().toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
    const modelToProvider: ModelToProvider = new Map([
      ["alpha-model", "p1"],
      ["beta-model", "p2"],
      ["gamma-model", "p3"],
    ]);

    // Today: only alpha-model
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
    dToday.modelCost = { "alpha-model": 1.0 };
    dToday.modelCount = { "alpha-model": 10 };

    // Past: beta and gamma
    const dPast1 = emptyDay(twoDaysAgo);
    dPast1.cost = 5.0;
    dPast1.sessionIds = new Set(["s2"]);
    dPast1.userMsgs = 1;
    dPast1.asstMsgs = 1;
    dPast1.toolResults = 1;
    dPast1.inTok = 10;
    dPast1.outTok = 10;
    dPast1.langLines = { TypeScript: 100 };
    dPast1.langEdits = { TypeScript: 1 };
    dPast1.modelCost = { "beta-model": 5.0 };
    dPast1.modelCount = { "beta-model": 50 };

    const dPast2 = emptyDay(twoDaysAgo);
    dPast2.cost = 1.0;
    dPast2.sessionIds = new Set(["s3"]);
    dPast2.userMsgs = 1;
    dPast2.asstMsgs = 1;
    dPast2.toolResults = 1;
    dPast2.inTok = 10;
    dPast2.outTok = 10;
    dPast2.langLines = { TypeScript: 100 };
    dPast2.langEdits = { TypeScript: 1 };
    dPast2.modelCost = { "gamma-model": 1.0 };
    dPast2.modelCount = { "gamma-model": 10 };

    const dash = new Dashboard(
      [dToday, dPast1, dPast2],
      modelToProvider,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );

    // Navigate to Models, switch to 1d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("r"); // All → 1d
    let lines = dash.render(80);
    // 1d: only Alpha Model
    expect(cursorOnModel(lines, "Alpha")).toBe(true);

    // Switch back to All (cycle: 1d→7d→30d→All)
    dash.handleInput("r");
    dash.handleInput("r");
    dash.handleInput("r");

    // tabIndex is still 2 (Models) — no need to re-navigate.
    // buildTabs was called on each r, creating a new SortedTable with cursor at row 0.
    lines = dash.render(80);

    // 3 models now. Move down twice.
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[B");
    lines = dash.render(80);

    expect(cursorOnModel(lines, "Gamma")).toBe(true);
  });
});
