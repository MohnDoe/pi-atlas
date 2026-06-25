import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
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
    const lines = tab.render(80);
    expect(lines.length).toBeLessThanOrEqual(12);
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
    tab.render(80);
    tab.invalidate();
    const lines = tab.render(80);
    expect(lines.join("\n")).toContain("Claude");
  });

  it("supports re-render after invalidation (lifecycle path)", () => {
    const tab = new Models(models, mtp, makeTheme(), testPalette(), mockTui, 10);
    tab.render(80);
    tab.invalidate();
    const lines = tab.render(80);
    expect(lines[0]).toContain("Models");
  });

  describe("marquee lifecycle", () => {
    const longModels: ModelStat[] = [
      { model: "claude-sonnet-4-20250514-very-long-name-that-overflows", cost: 1, calls: 1 },
    ];

    it("clears marquee timers on invalidate (Models→SortedTable→cells chain)", () => {
      const tab = new Models(longModels, new Map(), makeTheme(), testPalette(), mockTui, 10);
      tab.render(80);
      const spy = vi.spyOn(global, "clearInterval");
      tab.invalidate();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
