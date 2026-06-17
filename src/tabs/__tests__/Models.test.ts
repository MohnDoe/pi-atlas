import { describe, expect, it } from "vitest";
import { makeMockTUI, testPalette, makeTheme } from "../../__tests__/components.fixtures";
import { Models } from "../Models";
import { ModelStat } from "../../types";

describe("Models", () => {
  const mockTui = makeMockTUI();

  const models: ModelStat[] = [
    { model: "claude-sonnet-4-20250514", provider: "anthropic", cost: 150.5, calls: 42 },
    { model: "gemini-2.5-pro", provider: "Google", cost: 85.25, calls: 28 },
    { model: "gpt-4o", provider: "OpenAI", cost: 0.75, calls: 5 },
  ];

  it("renders data rows with formatted model names and costs", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui);
    const lines = tab.render(80);

    const text = lines.join("\n");
    // formatModelName strips date suffix and capitalizes
    expect(text).toContain("Claude Sonnet 4");
    expect(text).toContain("anthropic");
    expect(text).toContain("Gemini 2.5 Pro");
    expect(text).toContain("Google");
    expect(text).toContain("Gpt 4o");
    expect(text).toContain("OpenAI");
    // formatCost
    expect(text).toContain("$150.5");
    expect(text).toContain("$0.75");
  });

  it("shows empty state when models is empty", () => {
    const tab = new Models([], makeTheme(), testPalette(), mockTui);
    const text = tab.render(80).join("\n");
    expect(text).toContain("No model data for this time range");
  });

  it("renders within width", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui);
    const lines = tab.render(50);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(50);
    }
  });

  it("fill column adapts to width", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui);

    // At width 30, fill column is ~1-2 chars — model name truncated
    const narrowLines = tab.render(30);
    const narrowText = narrowLines.join("\n");
    expect(narrowText).not.toContain("Claude");

    // At width 80, fill column is ~51 chars — full model name visible
    const wideLines = tab.render(80);
    const wideText = wideLines.join("\n");
    expect(wideText).toContain("Claude Sonnet 4");
  });

  it("shows cursor on first row", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui);
    const lines = tab.render(80);
    // First data row (line 1, after header) should start with cursor
    expect(lines[1]).toMatch(/^▶/);
  });

  it("shows sort indicator on Cost column", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui);
    const lines = tab.render(80);
    const text = lines.join("\n");
    // Cost column has sort: { column: 3, direction: "desc" } → ▼
    expect(text).toContain("Cost ▼");
  });

  it("invalidates render cache", () => {
    const tab = new Models(models, makeTheme(), testPalette(), mockTui);
    tab.render(80); // cache at width 80
    tab.invalidate();
    const lines = tab.render(60); // should re-render at new width
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(60);
    }
  });
});
