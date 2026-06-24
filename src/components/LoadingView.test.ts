import { describe, expect, it } from "bun:test";
import { makeTheme } from "./components.fixtures";
import { LoadingView } from "./LoadingView";

const theme = makeTheme();

describe("LoadingView", () => {
  it("renders with 0% progress", () => {
    const lv = new LoadingView("Parsing session logs...", theme);
    lv.setProgress({ total: 100, done: 0, pct: 0 });
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("Parsing session logs...");
    expect(lines.join("\n")).toContain("0/100");
  });

  it("updates progress", () => {
    const lv = new LoadingView("Parsing session logs...", theme);
    lv.setProgress({ total: 20, done: 10, pct: 50 });
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("10/20");
  });

  it("renders progress bar with block chars", () => {
    const lv = new LoadingView("Parsing session logs...", theme);
    lv.setProgress({ total: 20, done: 15, pct: 75 });
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("15/20");
    expect(lines.join("\n")).toContain("█");
  });

  it("does not show remaining time when not provided", () => {
    const lv = new LoadingView("Parsing session logs...", theme);
    lv.setProgress({ total: 20, done: 0, pct: 0 });
    const lines = lv.render(80);
    // Progress line is the second content line (index 2); title also contains · so check specific line
    expect(lines[2]).toContain("0/20");
    expect(lines[2]).not.toContain("·");
  });

  it("shows remaining time in seconds", () => {
    const lv = new LoadingView("Parsing session logs...", theme);
    lv.setProgress({ total: 20, done: 5, pct: 25, remainingTimeMs: 5210 });
    const lines = lv.render(80);
    expect(lines[2]).toContain("~5.21s remaining · 5/20");
  });

  it("shows remaining time in minutes and seconds", () => {
    const lv = new LoadingView("Parsing session logs...", theme);
    lv.setProgress({ total: 20, done: 5, pct: 25, remainingTimeMs: 90000 });
    const lines = lv.render(80);
    expect(lines[2]).toContain("~1m 30s remaining · 5/20");
  });

  it("shows remaining time in ms when under 1s", () => {
    const lv = new LoadingView("Parsing session logs...", theme);
    lv.setProgress({ total: 20, done: 19, pct: 95, remainingTimeMs: 500 });
    const lines = lv.render(80);
    expect(lines[2]).toContain("~0.5s remaining · 19/20");
  });

  it("shows 0ms remaining when done", () => {
    const lv = new LoadingView("Parsing session logs...", theme);
    lv.setProgress({ total: 20, done: 20, pct: 100, remainingTimeMs: 0 });
    const lines = lv.render(80);
    expect(lines[2]).toContain("~0s remaining · 20/20");
  });
});
