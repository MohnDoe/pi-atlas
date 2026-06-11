import { describe, expect, it } from "vitest";
import { testPalette, testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { Models } from "../Models";

describe("Models", () => {
  const models = [
    { model: "claude-sonnet-4-20250514", cost: 150.5, calls: 42 },
    { model: "gemini-2.5-pro", cost: 85.25, calls: 28 },
    { model: "gpt-4o", cost: 0.75, calls: 5 },
  ];

  it("renders data rows with formatted model names and costs", () => {
    const tab = new Models(models, testTheme(), testPalette());
    const lines = tab.render(80);

    const text = lines.join("\n");
    // formatModelName strips date suffix and capitalizes
    expect(text).toContain("Claude Sonnet 4");
    expect(text).toContain("Gemini 2.5 Pro");
    // formatCost
    expect(text).toContain("$150.50");
    expect(text).toContain("$0.75");
  });

  it("shows empty state when models is empty", () => {
    const tab = new Models([], testTheme(), testPalette());
    const text = tab.render(80).join("\n");
    expect(text).toContain("No model data for this time range");
  });

  it("renders within width", () => {
    const tab = new Models(models, testTheme(), testPalette());
    const lines = tab.render(50);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(50);
    }
  });

  it("invalidates render cache", () => {
    const tab = new Models(models, testTheme(), testPalette());
    tab.render(80); // cache at width 80
    tab.invalidate();
    const lines = tab.render(60); // should re-render at new width
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }
  });
});
