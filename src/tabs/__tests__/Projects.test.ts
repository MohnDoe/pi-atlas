import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { makeMockTUI, makeTheme } from "../../__tests__/components.fixtures";
import { type ProjectStat } from "../../types";
import { Projects } from "../Projects";

describe("Projects", () => {
  const mockTui = makeMockTUI();

  const projects: ProjectStat[] = [
    { project: "pi-atlas", cost: 15.5, sessions: 42 },
    { project: "dotfiles", cost: 8.2, sessions: 20 },
    { project: "sandbox", cost: 1.25, sessions: 5 },
  ];

  it("renders data rows with formatted costs", () => {
    const tab = new Projects(projects, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(lines[0]).toContain("Projects");

    // Headers
    expect(text).toContain("Name");
    expect(text).toContain("Sessions");
    expect(text).toContain("Cost");
    expect(text).toContain("Share %");

    // Project names
    expect(text).toContain("pi-atlas");
    expect(text).toContain("dotfiles");
    expect(text).toContain("sandbox");

    // Sessions
    expect(text).toContain("42");
    expect(text).toContain("20");
    expect(text).toContain("5");

    // Costs formatted
    expect(text).toContain("$15.5");
    expect(text).toContain("$8.2");
    expect(text).toContain("$1.25");
  });

  it("shows empty state when projects is empty", () => {
    const tab = new Projects([], makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(lines[0]).toContain("Projects");
    expect(text).toContain("No projects data for this time range");
  });

  it("renders within width", () => {
    const tab = new Projects(projects, makeTheme(), mockTui, 10);
    const lines = tab.render(50);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(50);
    }
  });

  it("fill column adapts to width", () => {
    const tab = new Projects(projects, makeTheme(), mockTui, 10);

    // At width 30, columns shrink — no line exceeds render width
    const narrowLines = tab.render(30);
    for (const line of narrowLines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(30);
    }

    const wideLines = tab.render(80);
    const wideText = wideLines.join("\n");
    expect(wideText).toContain("pi-atlas");
  });

  it("shows sort indicator on Cost column", () => {
    const tab = new Projects(projects, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Cost ▼");
  });

  it("invalidates render cache", () => {
    const tab = new Projects(projects, makeTheme(), mockTui, 10);
    tab.render(80);
    tab.invalidate();
    const lines = tab.render(60);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(60);
    }
  });

  it("supports re-render after invalidation (lifecycle path)", () => {
    const tab = new Projects(projects, makeTheme(), mockTui, 10);

    const lines1 = tab.render(80);
    expect(lines1.join("\n")).toContain("pi-atlas");

    tab.invalidate();

    const lines2 = tab.render(80);
    const text = lines2.join("\n");
    expect(text).toContain("pi-atlas");
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

    it("clears marquee timers on invalidate", () => {
      const longProjects: ProjectStat[] = [
        { project: "a-very-long-project", cost: 15.5, sessions: 42 },
      ];
      const tab = new Projects(longProjects, makeTheme(), mockTui, 10);

      tab.render(30);
      expect(vi.getTimerCount()).toBe(1);

      tab.invalidate();
      expect(vi.getTimerCount()).toBe(0);

      const lines = tab.render(80);
      const text = lines.join("\n");
      expect(text).toContain("a-very-long-project");
    });
  });
});
