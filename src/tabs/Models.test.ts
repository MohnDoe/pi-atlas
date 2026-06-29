import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { makeMockTUI, makeTheme, testPalette } from "../components/components.fixtures";
import { type ModelStat } from "../types";
import { Models } from "./Models";

describe("Models", () => {
  const mockTui = makeMockTUI();

  const models: ModelStat[] = [
    { model: "claude-sonnet-4-20250514", cost: 150.5, calls: 42 },
    { model: "gemini-2.5-pro", cost: 85.25, calls: 28 },
    { model: "gpt-4o", cost: 0.75, calls: 5 },
  ];
  const mtp = new Map([
    ["claude-sonnet-4-20250514", "anthropic"],
    ["gemini-2.5-pro", "Google"],
    ["gpt-4o", "OpenAI"],
  ]);

  it("renders data rows with formatted model names and costs", () => {
    const tab = new Models(models, mtp, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");
    expect(lines[0]).toContain("Models");
    expect(text).toContain("Claude");
    expect(text).toContain("anthropic");
    expect(text).toContain("Gemin");
    expect(text).toContain("Google");
    expect(text).toContain("Gpt 4o");
    expect(text).toContain("OpenAI");
    expect(text).toContain("$150.5");
    expect(text).toContain("$0.75");
  });

  it("shows empty state when models is empty", () => {
    const tab = new Models([], mtp, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);
    expect(lines.join("\n")).toContain("No model data");
  });

  it("renders within width", () => {
    const tab = new Models(models, mtp, makeTheme(), testPalette(), mockTui, 10);
    const width = 50;
    const lines = tab.render(width);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(width);
    }
  });

  it("fill column adapts to width", () => {
    const tab = new Models(models, mtp, makeTheme(), testPalette(), mockTui, 10);
    const lines80 = tab.render(80);
    const text80 = lines80.join("\n");
    expect(text80).toContain("$150.5");
    const lines40 = tab.render(50);
    const text40 = lines40.join("\n");
    // At narrow width cost is truncated — the bar column takes precedence
    expect(text40).toContain("$150.");
  });

  it("shows sort indicator on Cost column", () => {
    const tab = new Models(models, mtp, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);
    expect(lines.join("\n")).toContain("▼");
  });

  it("invalidates render cache", () => {
    const tab = new Models(models, mtp, makeTheme(), testPalette(), mockTui, 10);
    tab.render(80); // cache at width 80
    tab.invalidate();
    const lines = tab.render(50); // should re-render at new width
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(50);
    }
  });

  it("supports re-render after invalidation (lifecycle path)", () => {
    const tab = new Models(models, mtp, makeTheme(), testPalette(), mockTui, 10);

    // First render cycle
    const lines1 = tab.render(80);
    expect(lines1.join("\n")).toContain("Claude");

    // Invalidate — simulates Dashboard.buildTabs() lifecycle cleanup
    tab.invalidate();

    // Second render cycle — creates new table from clean state
    const lines2 = tab.render(80);
    const text = lines2.join("\n");
    expect(text).toContain("Claude");
    expect(text).toContain("▼");
    for (const line of lines2) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(80);
    }
  });

  describe("marquee lifecycle", () => {
    const modelName = "claude-sonnet-4-20250514-very-long-name-that-overflows";
    const longModels: ModelStat[] = [
      { model: modelName, cost: 1, calls: 1 },
    ];

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("creates marquee timer on narrow render and clears on invalidate", () => {
      const tab = new Models(longModels, new Map(), makeTheme(), testPalette(), mockTui, 10);

      // Render at narrow width where long model name overflows fill column
      // → MarqueeCell starts a timer on the focused row
      tab.render(30);
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      // Invalidate propagates: Models → SortedTable → cells → MarqueeCell → clearInterval
      const spy = vi.spyOn(global, "clearInterval");
      tab.invalidate();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();

      // Re-render still produces clean output
      const lines = tab.render(30);
      const text = lines.join("\n");
      expect(text).toContain("C"); // first char of model name still visible
    });
  });
});
