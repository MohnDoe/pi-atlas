import { describe, expect, it } from "bun:test";
import { makeMockTUI, makeTheme } from "../components/components.fixtures";
import type { SkillStat } from "../types";
import { Skills } from "./Skills";

describe("Skills", () => {
  const mockTui = makeMockTUI();

  const skills: SkillStat[] = [
    {
      name: "tdd",
      cost: 1.23,
      invocations: 42,
      tokens: 251300,
      toolCalls: { total: 150, avg: 3.57, calls: { bash: 100, read: 50 } },
    },
    {
      name: "improve-codebase-architecture",
      cost: 0.89,
      invocations: 18,
      tokens: 120000,
      toolCalls: { total: 85, avg: 4.72, calls: { read: 45, edit: 40 } },
    },
    {
      name: "prototype",
      cost: 0.45,
      invocations: 7,
      tokens: 50000,
      toolCalls: { total: 30, avg: 4.29, calls: { bash: 20, write: 10 } },
    },
  ];

  it("renders column headers and skill data", () => {
    const tab = new Skills(skills, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Name");
    expect(text).toContain("Invocations");
    expect(text).toContain("Cost");
    expect(text).toContain("Tokens");
    expect(text).toContain("Tool calls");

    expect(text).toContain("tdd");
    expect(text).toContain("improve-codebase-");
    expect(text).toContain("prototype");

    expect(text).toContain("42");
    expect(text).toContain("18");
    expect(text).toContain("7");
    expect(text).toContain("$1.23");
    expect(text).toContain("$0.89");
    expect(text).toContain("$0.45");
    expect(text).toContain("251.3k");
    expect(text).toContain("120k");
    expect(text).toContain("50k");
    expect(text).toContain("150 (~4 avg)");
    expect(text).toContain("85 (~5 avg)");
    expect(text).toContain("30 (~4 avg)");

  });

  it("shows sort indicator on Cost column", () => {
    const tab = new Skills(skills, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Cost ▼");
  });

  it("shows empty state when skills is empty", () => {
    const tab = new Skills([], makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No skills data for this time range");
  });

  it("renders within width", () => {
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
    expect(text).toContain("Skill");
    expect(text).toContain("Cost ▼");
    expect(text).toContain("$1.23");
    expect(text).toContain("251.3k");

    for (const line of lines2) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(80);
    }
  });
});
