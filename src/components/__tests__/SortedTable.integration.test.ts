/**
 * Integration test: Dashboard → Models → SortedTable keyboard interaction.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockTUI, makeTheme } from "../../__tests__/components.fixtures";
import { makeSummary } from "../../__tests__/compute.fixtures";
import { Dashboard } from "../Dashboard";

const mockTui = makeMockTUI();

const strip = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, "");

describe("Dashboard → Models → SortedTable arrow key integration", () => {
  /** Check if any line contains "▶" and a model name substring. */
  function cursorOnModel(lines: string[], model: string): boolean {
    return lines.some((l) => l.includes("▶") && l.includes(model));
  }

  it("initial cursor on first model", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "alpha-model", cost: 10, calls: 100, provider: "p1" },
        { model: "beta-model", cost: 5, calls: 50, provider: "p2" },
      ],
    };
    const dash = new Dashboard(
      [summary, summary, summary, summary],
      makeTheme(), false, null, mockTui,
    );

    // Navigate to Models tab
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);

    // formatModelName: "alpha-model" → "Alpha Model"
    expect(cursorOnModel(lines, "Alpha Model")).toBe(true);
    expect(cursorOnModel(lines, "Beta Model")).toBe(false);
  });

  it("down arrow moves cursor to next row via Dashboard dispatch", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "alpha-model", cost: 10, calls: 100, provider: "p1" },
        { model: "beta-model", cost: 5, calls: 50, provider: "p2" },
        { model: "gamma-model", cost: 1, calls: 10, provider: "p3" },
      ],
    };
    const dash = new Dashboard(
      [summary, summary, summary, summary],
      makeTheme(), false, null, mockTui,
    );

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.render(80);

    // Press down
    dash.handleInput("\x1b[B");
    const lines = dash.render(80);
    // Cursor moves from row 0 to row 1
    expect(cursorOnModel(lines, "Beta Model")).toBe(true);
    expect(cursorOnModel(lines, "Alpha Model")).toBe(false);
  });

  it("up arrow moves cursor up", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "alpha-model", cost: 10, calls: 100, provider: "p1" },
        { model: "beta-model", cost: 5, calls: 50, provider: "p2" },
        { model: "gamma-model", cost: 1, calls: 10, provider: "p3" },
      ],
    };
    const dash = new Dashboard(
      [summary, summary, summary, summary],
      makeTheme(), false, null, mockTui,
    );

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.render(80);

    // Move down twice, then back up once
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[A");
    const lines = dash.render(80);

    expect(cursorOnModel(lines, "Beta Model")).toBe(true);
    expect(cursorOnModel(lines, "Alpha Model")).toBe(false);
    expect(cursorOnModel(lines, "Gamma Model")).toBe(false);
  });

  it("arrow keys work across range switches", () => {
    const summary1d = {
      ...makeSummary(),
      models: [{ model: "alpha-model", cost: 1, calls: 10, provider: "p1" }],
    };
    const summaryAll = {
      ...makeSummary(),
      models: [
        { model: "alpha-model", cost: 10, calls: 100, provider: "p1" },
        { model: "beta-model", cost: 5, calls: 50, provider: "p2" },
        { model: "gamma-model", cost: 1, calls: 10, provider: "p3" },
      ],
    };
    const dash = new Dashboard(
      [summary1d, summaryAll, summaryAll, summaryAll],
      makeTheme(), false, null, mockTui,
    );

    // Navigate to Models, switch to 1d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("r");      // All → 1d
    let lines = dash.render(80);
    // 1d: only Alpha Model
    expect(cursorOnModel(lines, "Alpha Model")).toBe(true);

    // Switch back to All
    // Current range index = 0 (1d), need to cycle to 3 (All)
    // r → 1, r → 2, r → 3
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

    expect(cursorOnModel(lines, "Gamma Model")).toBe(true);
  });

  describe("marquee animation persists across render cycles", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Extract the full visible text of the focused (▶) row. */
    function focusedRowText(lines: string[]): string {
      for (const line of lines) {
        if (line.includes("▶")) {
          return strip(line);
        }
      }
      return "";
    }

    it("marquee advances on successive renders (not stuck at offset 0)", () => {
      // A model name long enough to overflow the ~27-char Model column at width=80
      const longModel = "A-Very-Long-Model-Name-That-Overflows-And-Should-Scroll";
      const summary = {
        ...makeSummary(),
        models: [
          { model: longModel, cost: 10, calls: 100, provider: "p1" },
        ],
      };
      const dash = new Dashboard(
        [summary, summary, summary, summary],
        makeTheme(), false, null, mockTui,
      );

      // Navigate to Models tab
      dash.handleInput("\x1b[C"); // → Languages
      dash.handleInput("\x1b[C"); // → Models

      // First render — marquee starts at offset 0
      let lines = dash.render(80);
      const render1 = focusedRowText(lines);
      expect(render1).toContain("A Very Long");

      // Advance 150ms = 1 timer tick → marquee text should scroll
      vi.advanceTimersByTime(150);
      lines = dash.render(80);
      const render2 = focusedRowText(lines);
      expect(render2).not.toBe("");

      // Content must have scrolled — slice differs from render1
      expect(render2).not.toBe(render1);

      // Advance another 150ms = 2nd tick → should scroll again
      vi.advanceTimersByTime(150);
      lines = dash.render(80);
      const render3 = focusedRowText(lines);
      expect(render3).not.toBe("");
      expect(render3).not.toBe(render1);
      expect(render3).not.toBe(render2);
    });
  });
});
