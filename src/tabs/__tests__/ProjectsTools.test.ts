import { describe, it, expect } from "vitest";
import { testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { ProjectsTools } from "../ProjectsTools";
import type { ProjectStat, ToolStat } from "../../types";

describe("ProjectsTools", () => {
  const projects: ProjectStat[] = [
    { project: "pi-usage", cost: 15.5, sessions: 42 },
    { project: "dotfiles", cost: 8.2, sessions: 20 },
    { project: "my-app", cost: 3.0, sessions: 5 },
  ];

  const tools: ToolStat[] = [
    { tool: "bash", count: 150 },
    { tool: "read", count: 120 },
    { tool: "edit", count: 80 },
    { tool: "write", count: 45 },
  ];

  it("renders side-by-side projects and tools tables (both sides)", () => {
    const tab = new ProjectsTools(projects, tools, testTheme(), 15);
    const lines = tab.render(80);

    const text = lines.join("\n");

    // Both tables present with headers
    expect(text).toContain("Project");
    expect(text).toContain("Tool");
    expect(text).toContain("Cost");
    expect(text).toContain("Sessions");
    expect(text).toContain("Count");

    // Data from both tables
    expect(text).toContain("pi-usage");
    expect(text).toContain("bash");
  });

  it("renders projects table with empty tools state", () => {
    const tab = new ProjectsTools(projects, [], testTheme(), 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No tool data");
    expect(text).toContain("pi-usage");
  });

  it("renders tools table with empty projects state", () => {
    const tab = new ProjectsTools([], tools, testTheme(), 10);
    const lines = tab.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No project data");
    expect(text).toContain("bash");
  });

  it("scrolls both tables with up/down handleInput", () => {
    const projectCount = 20;
    const toolCount = 25;
    const manyProjects: ProjectStat[] = Array.from({ length: projectCount }, (_, i) => ({
      project: `proj-${i}`,
      cost: 20 - i,
      sessions: (20 - i) * 10,
    }));
    const manyTools: ToolStat[] = Array.from({ length: toolCount }, (_, i) => ({
      tool: `tool-${i}`,
      count: 30 - i,
    }));

    const maxTotalHeight = 6;
    const tab = new ProjectsTools(manyProjects, manyTools, testTheme(), maxTotalHeight); // 5 visible data rows

    let lines = tab.render(80);
    let text = lines.join("\n");

    for (let index = 0; index < maxTotalHeight - 1; index++) {
      expect(text).toContain(`proj-${index}`);
      expect(text).toContain(`tool-${index}`);
    }

    for (let index = maxTotalHeight; index < projectCount - maxTotalHeight; index++) {
      expect(text).not.toContain(`proj-${index}`);
    }

    for (let index = maxTotalHeight; index < toolCount - maxTotalHeight; index++) {
      expect(text).not.toContain(`tool-${toolCount}`);
    }

    // Scroll down 3 times
    tab.handleInput("\x1b[B");
    tab.handleInput("\x1b[B");
    tab.handleInput("\x1b[B");
    lines = tab.render(80);
    text = lines.join("\n");
    expect(text).not.toContain("proj-0");
    expect(text).not.toContain("tool-0");

    expect(text).toContain(`proj-${maxTotalHeight - 1 + 2}`);
    expect(text).toContain(`tool-${maxTotalHeight - 1 + 2}`);
  });

  it("caches render output and clears on invalidate", () => {
    const tab = new ProjectsTools(projects, tools, testTheme(), 10);

    const first = tab.render(80);
    const second = tab.render(80);
    // Same width returns cached array (same reference)
    expect(second).toBe(first);

    // Different width busts cache
    const third = tab.render(60);
    expect(third).not.toBe(first);
    for (const line of third) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }

    // Invalidate then re-render at same width should re-render (different reference)
    const afterInvalidate = tab.render(60);
    expect(afterInvalidate).toBe(third); // cached
    tab.invalidate();
    const postInvalidate = tab.render(60);
    expect(postInvalidate).not.toBe(afterInvalidate); // fresh render
    for (const line of postInvalidate) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }
  });
});
