import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { makeMockTUI, makeTheme, testPalette } from "../../__tests__/components.fixtures";
import { type ModelStat } from "../../types";
import { Models } from "../Models";

describe("Models", () => {
  const mockTui = makeMockTUI();

  const models: ModelStat[] = [
    { model: "claude-sonnet-4-20250514", provider: "anthropic", cost: 150.5, calls: 42 },
    { model: "gemini-2.5-pro", provider: "Google", cost: 85.25, calls: 28 },
    { model: "gpt-4o", provider: "OpenAI", cost: 0.75, calls: 5 },
  ];

  it("renders data rows with formatted model names and costs", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);

    const text = lines.join("\n");

    expect(lines[0]).toContain("Models");
    expect(lines[0]).toContain(models.length.toString());

    // formatModelName strips date suffix and capitalizes
    // Model column is 6-char fill at width 80 — truncated name visible
    expect(text).toContain("Claude");
    expect(text).toContain("anthropic");
    // Row 1 (Gemini) not focused — truncateToWidth shows "Gemin…"
    expect(text).toContain("Gemin");
    expect(text).toContain("Google");
    expect(text).toContain("Gpt 4o");
    expect(text).toContain("OpenAI");
    // formatCost
    expect(text).toContain("$150.5");
    expect(text).toContain("$0.75");
  });

  it("shows empty state when models is empty", () => {
    const tab = new Models([], makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(lines[0]).toContain("Models");
    // don't display 0 counter
    expect(lines[0]).not.toContain("0");
    expect(text).toContain("No model data for this time range");
  });

  it("renders within width", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(50);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(50);
    }
  });

  it("fill column adapts to width", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui, 10);

    // At width 18, fill column is small — full model name truncated
    const narrowLines = tab.render(18);
    const narrowText = narrowLines.join("\n");
    expect(narrowText).not.toContain("Claude Sonnet");

    // At width 80, fill column is spacious — full name visible
    const wideLines = tab.render(80);
    const wideText = wideLines.join("\n");
    expect(wideText).toContain("Claude Sonnet");
  });

  it("shows sort indicator on Cost column", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");
    // Cost column has sort: { column: 3, direction: "desc" } → ▼
    expect(text).toContain("Cost ▼");
  });

  it("invalidates render cache", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui, 10);
    tab.render(80); // cache at width 80
    tab.invalidate();
    const lines = tab.render(60); // should re-render at new width
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(60);
    }
  });

  it("supports re-render after invalidation (lifecycle path)", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui, 10);

    // First render cycle — creates table
    const lines1 = tab.render(80);
    expect(lines1.join("\n")).toContain("Claude");

    // Invalidate — simulates Dashboard.buildTabs() lifecycle cleanup
    tab.invalidate();

    // Second render cycle — creates new table from clean state
    const lines2 = tab.render(80);
    const text = lines2.join("\n");
    expect(text).toContain("Claude");
    expect(text).toContain("Cost ▼");
    for (const line of lines2) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(80);
    }
  });

  describe("marquee lifecycle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("clears marquee timers on invalidate (Models→SortedTable→cells chain)", () => {
      const longModels: ModelStat[] = [
        { model: "claude-sonnet-4-20250514", provider: "anthropic", cost: 150.5, calls: 42 },
      ];
      const tab = new Models(longModels, makeTheme(), testPalette(), mockTui, 10);

      // Render at narrow width where "Claude Sonnet 4 20250514" overflows fill column
      // → MarqueeCell starts timer on focused row
      tab.render(30);
      expect(vi.getTimerCount()).toBe(1);

      // Invalidate propagates: Models → SortedTable → cells → MarqueeCell → clearInterval
      tab.invalidate();
      expect(vi.getTimerCount()).toBe(0);

      // Re-render still produces clean output (fill col ~2 chars, provider ~7 chars at width 30)
      const lines = tab.render(30);
      const text = lines.join("\n");
      expect(text).toContain("C"); // first char of "Claude Sonnet 4"
      expect(text).toContain("anthr"); // provider truncated to ~5 chars at width 30
    });
  });
});
