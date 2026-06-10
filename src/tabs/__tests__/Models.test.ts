import { describe, expect, it } from "vitest";
import { testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { Models } from "../Models";

describe("Models", () => {
  const models = [
    { model: "claude-sonnet-4-20250514", cost: 150.5, calls: 42 },
    { model: "gemini-2.5-pro", cost: 85.25, calls: 28 },
    { model: "gpt-4o", cost: 0.75, calls: 5 },
  ];

  it("renders header row with Model, Cost, Calls columns", () => {
    const tab = new Models(models, testTheme(), 10);
    const lines = tab.render(80);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const header = lines[0];
    expect(header).toContain("Model");
    expect(header).toContain("Cost");
    expect(header).toContain("Calls");
  });

  it("renders data rows with formatted model names and costs", () => {
    const tab = new Models(models, testTheme(), 10);
    const lines = tab.render(80);
    // formatModelName strips date suffix and capitalizes
    expect(lines[1]).toContain("Claude Sonnet 4");
    expect(lines[2]).toContain("Gemini 2.5 Pro");
    // formatCost
    expect(lines[1]).toContain("$150.50");
    expect(lines[3]).toContain("$0.75");
  });

  it("renders data rows with rank numbers", () => {
    const tab = new Models(models, testTheme(), 10);
    const lines = tab.render(80);
    expect(lines[1]).toContain("1");
    expect(lines[1]).toContain("Claude Sonnet 4");
    expect(lines[2]).toContain("2");
    expect(lines[2]).toContain("Gemini 2.5 Pro");
    expect(lines[3]).toContain("3");
    expect(lines[3]).toContain("Gpt 4o");
  });

  it("shows empty state when models is empty", () => {
    const tab = new Models([], testTheme(), 10);
    const lines = tab.render(80);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("No model data for this time range");
  });

  it("renders within width", () => {
    const tab = new Models(models, testTheme(), 10);
    const lines = tab.render(50);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(50);
    }
  });

  it("scrolls down with handleInput", () => {
    const manyModels = Array.from({ length: 20 }, (_, i) => ({
      model: `model-${i}`,
      cost: i * 10,
      calls: i * 5,
    }));
    const tab = new Models(manyModels, testTheme(), 6);
    let lines = tab.render(80);
    expect(lines[1]).toContain("Model 0");

    tab.handleInput("\x1b[B"); // down arrow
    lines = tab.render(80);
    expect(lines[1]).toContain("Model 1");
  });

  it("scrolls up with handleInput", () => {
    const manyModels = Array.from({ length: 20 }, (_, i) => ({
      model: `model-${i}`,
      cost: i * 10,
      calls: i * 5,
    }));
    const tab = new Models(manyModels, testTheme(), 6);

    tab.handleInput("\x1b[B");
    tab.handleInput("\x1b[B");
    let lines = tab.render(80);
    expect(lines[1]).toContain("Model 2");

    tab.handleInput("\x1b[A"); // up arrow
    lines = tab.render(80);
    expect(lines[1]).toContain("Model 1");
  });

  it("does not scroll past start", () => {
    const tab = new Models(models, testTheme(), 10);
    tab.handleInput("\x1b[A");
    const lines = tab.render(80);
    expect(lines[1]).toContain("Claude Sonnet 4"); // still first row
  });

  it("does not scroll past end", () => {
    const manyModels = Array.from({ length: 5 }, (_, i) => ({
      model: `model-${i}`,
      cost: i * 10,
      calls: i * 5,
    }));
    const tab = new Models(manyModels, testTheme(), 6); // 5 data rows visible
    // Scroll way past end
    for (let i = 0; i < 10; i++) tab.handleInput("\x1b[B");
    const lines = tab.render(80);
    expect(lines[lines.length - 1]).toContain("Model 4"); // still last row
  });

  it("ignores non-scroll keys", () => {
    const tab = new Models(models, testTheme(), 10);
    const before = tab.render(80);
    tab.handleInput("x");
    tab.handleInput("\r"); // enter
    tab.handleInput("\x1b[C"); // right arrow
    expect(tab.render(80)).toEqual(before);
  });

  it("invalidates render cache", () => {
    const tab = new Models(models, testTheme(), 10);
    tab.render(80); // cache at width 80
    tab.invalidate();
    const lines = tab.render(60); // should re-render at new width
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }
  });
});
