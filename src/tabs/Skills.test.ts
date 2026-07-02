import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { makeMockTUI, makeTheme } from "../components/components.fixtures";
import { type SkillStat } from "../types";
import { Skills } from "./Skills";

describe("Skills", () => {
  const mockTui = makeMockTUI();

  const skills: SkillStat[] = [
    { name: "tdd", calls: 120, sessions: 15, cost: 15.5, tokens: 50000 },
    { name: "grill-me", calls: 80, sessions: 10, cost: 8.2, tokens: 30000 },
    { name: "handoff", calls: 20, sessions: 3, cost: 1.25, tokens: 5000 },
  ];

  it("renders empty state when no skills", () => {
    const tab = new Skills([], makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(lines[0]).toContain("Skills");
    expect(text).toContain("No skill usage data for this time range");
  });

  it("renders data rows with formatted values", () => {
    const tab = new Skills(skills, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(lines[0]).toContain("Skills");

    // Headers
    expect(text).toContain("Skill");
    expect(text).toContain("Invocations");
    expect(text).toContain("Sessions");
    expect(text).toContain("Cost");
    expect(text).toContain("Tokens");

    // Skill names
    expect(text).toContain("tdd");
    expect(text).toContain("grill-me");
    expect(text).toContain("handoff");

    // Costs formatted
    expect(text).toContain("$15.5");
    expect(text).toContain("$8.2");
    expect(text).toContain("$1.25");
  });

  it("sorts by cost descending by default", () => {
    const tab = new Skills(skills, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    // tdd ($15.5) should appear before grill-me ($8.2)
    const tddIdx = text.indexOf("tdd");
    const grillIdx = text.indexOf("grill-me");
    expect(tddIdx).toBeLessThan(grillIdx);
  });

  it("shows sort indicator on Cost column", () => {
    const tab = new Skills(skills, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Cost ▼");
  });

  it("renders within width constraints", () => {
    const tab = new Skills(skills, makeTheme(), mockTui, 10);
    const lines = tab.render(50);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(50);
    }
  });

  it("invalidates render cache", () => {
    const tab = new Skills(skills, makeTheme(), mockTui, 10);
    tab.render(80);
    tab.invalidate();
    const lines = tab.render(60);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(60);
    }
  });

  it("supports re-render after invalidation (lifecycle path)", () => {
    const tab = new Skills(skills, makeTheme(), mockTui, 10);

    const lines1 = tab.render(80);
    expect(lines1.join("\n")).toContain("tdd");

    tab.invalidate();

    const lines2 = tab.render(80);
    const text = lines2.join("\n");
    expect(text).toContain("tdd");
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
      const longSkills: SkillStat[] = [
        { name: "a-very-long-skill-name-here", calls: 10, sessions: 2, cost: 5, tokens: 1000 },
      ];
      const tab = new Skills(longSkills, makeTheme(), mockTui, 10);

      tab.render(30);
      expect(vi.getTimerCount()).toBe(1);

      tab.invalidate();
      expect(vi.getTimerCount()).toBe(0);

      const lines = tab.render(80);
      const text = lines.join("\n");
      expect(text).toContain("a-very-long-skill-name-here");
    });
  });
});
