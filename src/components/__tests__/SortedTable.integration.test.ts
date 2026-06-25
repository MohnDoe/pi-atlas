import { describe, expect, it } from "bun:test";
import { makeMockTUI, makeRangeSelector, makeTheme } from "../components.fixtures";
import { Dashboard } from "../Dashboard";
import { allRanges, mapAllSummaries } from "../Dashboard.test";
import { makeSummary } from "../../compute.fixtures";
import { SortedTable } from "../SortedTable";
import type { StatsSummary, TimeRange } from "../../types";

const CURSOR = SortedTable.DEFAULT_CURSOR_CHAR;
const mockTui = makeMockTUI();
const EMPTY_MTP = new Map<string, string>();

describe("Dashboard → Models → SortedTable arrow key integration", () => {
  function cursorOnModel(lines: string[], model: string): boolean {
    return lines.some((l) => l.includes(CURSOR) && l.includes(model));
  }

  it("initial cursor on first model", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "alpha-model", cost: 10, calls: 100 },
        { model: "beta-model", cost: 5, calls: 50 },
      ],
    };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    const lines = dash.render(80);
    expect(cursorOnModel(lines, "Alpha")).toBe(true);
    expect(cursorOnModel(lines, "Beta")).toBe(false);
  });

  it("down arrow moves cursor to next row via Dashboard dispatch", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "alpha-model", cost: 10, calls: 100 },
        { model: "beta-model", cost: 5, calls: 50 },
        { model: "gamma-model", cost: 1, calls: 10 },
      ],
    };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    dash.render(80);
    dash.handleInput("\x1b[B");
    const lines = dash.render(80);
    expect(cursorOnModel(lines, "Beta")).toBe(true);
    expect(cursorOnModel(lines, "Alpha")).toBe(false);
  });

  it("up arrow moves cursor up", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "alpha-model", cost: 10, calls: 100 },
        { model: "beta-model", cost: 5, calls: 50 },
        { model: "gamma-model", cost: 1, calls: 10 },
      ],
    };
    const dash = new Dashboard(mapAllSummaries(allRanges, summary), EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    dash.render(80);
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[A");
    const lines = dash.render(80);
    expect(cursorOnModel(lines, "Beta")).toBe(true);
    expect(cursorOnModel(lines, "Alpha")).toBe(false);
    expect(cursorOnModel(lines, "Gamma")).toBe(false);
  });

  it("arrow keys work across range switches", () => {
    const summary1d = { ...makeSummary(), models: [{ model: "alpha-model", cost: 1, calls: 10 }] };
    const summaryAll = {
      ...makeSummary(),
      models: [
        { model: "alpha-model", cost: 10, calls: 100 },
        { model: "beta-model", cost: 5, calls: 50 },
        { model: "gamma-model", cost: 1, calls: 10 },
      ],
    };
    const summaries: Map<TimeRange, StatsSummary> = new Map([["1d", summary1d], ["7d", summaryAll], ["30d", summaryAll], ["All", summaryAll]]);
    const dash = new Dashboard(summaries, EMPTY_MTP, makeTheme(), mockTui, null, makeRangeSelector(makeTheme()));
    dash.handleInput("\x1b[C");
    dash.handleInput("\x1b[C");
    dash.handleInput("r");
    let lines = dash.render(80);
    expect(cursorOnModel(lines, "Alpha")).toBe(true);
    dash.handleInput("r");
    dash.handleInput("r");
    dash.handleInput("r");
    lines = dash.render(80);
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[B");
    lines = dash.render(80);
    expect(cursorOnModel(lines, "Gamma")).toBe(true);
  });
});
