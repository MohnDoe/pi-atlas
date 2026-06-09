import { describe, it, expect } from "vitest";
import { testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { ProjectsToolsView } from "../ProjectToolsView";

describe("ProjectsToolsView", () => {
  const projects = [
    { project: "pi-usage", cost: 15.5, sessions: 42 },
    { project: "dotfiles", cost: 8.2, sessions: 20 },
    { project: "my-app", cost: 3.0, sessions: 5 },
  ];

  const tools = [
    { tool: "bash", count: 150 },
    { tool: "read", count: 120 },
    { tool: "edit", count: 80 },
    { tool: "write", count: 45 },
  ];

  it("renders two tables side-by-side within width", () => {
    const view = new ProjectsToolsView(projects, tools, 15, testTheme());
    const lines = view.render(80);

    expect(lines.length).toBeGreaterThan(0);
    const text = lines.join("\n");

    // Both tables present
    expect(text).toContain("Project");
    expect(text).toContain("Tool");
    expect(text).toContain("Cost");
    expect(text).toContain("Sessions");
    expect(text).toContain("Count");

    // Data from both tables
    expect(text).toContain("pi-usage");
    expect(text).toContain("bash");
  });

  it("each row stays within width", () => {
    const view = new ProjectsToolsView(projects, tools, 15, testTheme());
    const lines = view.render(60);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }
  });

  it("sorts projects by cost descending and tools by count descending", () => {
    const view = new ProjectsToolsView(projects, tools, 15, testTheme());
    const lines = view.render(80);
    const text = lines.join("\n");

    // Projects: pi-usage ($15.50) should appear before dotfiles ($8.20)
    const piIdx = text.indexOf("pi-usage");
    const dotIdx = text.indexOf("dotfiles");
    expect(piIdx).toBeLessThan(dotIdx);

    // Tools: bash (150) should appear before read (120)
    const bashIdx = text.indexOf("bash");
    const readIdx = text.indexOf("read");
    expect(bashIdx).toBeLessThan(readIdx);
  });

  it("both tables scroll independently with up/down", () => {
    const manyProjects = Array.from({ length: 20 }, (_, i) => ({
      project: `proj-${i}`,
      cost: 20 - i,
      sessions: (20 - i) * 10,
    }));
    const manyTools = Array.from({ length: 25 }, (_, i) => ({
      tool: `tool-${i}`,
      count: 30 - i,
    }));
    const view = new ProjectsToolsView(manyProjects, manyTools, 6, testTheme()); // 5 visible data rows

    let lines = view.render(80);
    let text = lines.join("\n");
    // Initially both show first items
    expect(text).toContain("proj-0");
    expect(text).toContain("tool-0");

    // Scroll down 3 times
    view.handleInput("\x1b[B");
    view.handleInput("\x1b[B");
    view.handleInput("\x1b[B");
    lines = view.render(80);
    text = lines.join("\n");
    // Both should show row 4 (offset 3)
    expect(text).toContain("proj-3");
    expect(text).toContain("tool-3");
    expect(text).not.toContain("proj-0");
    expect(text).not.toContain("tool-0");
  });

  it("shows empty state when no projects data", () => {
    const view = new ProjectsToolsView([], tools, 10, testTheme());
    const lines = view.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No project data");
    // Tools table should still be visible
    expect(text).toContain("bash");
  });

  it("shows empty state when no tools data", () => {
    const view = new ProjectsToolsView(projects, [], 10, testTheme());
    const lines = view.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No tool data");
    // Projects table should still be visible
    expect(text).toContain("pi-usage");
  });

  it("shows empty state when both are empty", () => {
    const view = new ProjectsToolsView([], [], 10, testTheme());
    const lines = view.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No project data");
    expect(text).toContain("No tool data");
  });

  it("invalidates render cache", () => {
    const view = new ProjectsToolsView(projects, tools, 10, testTheme());
    view.render(80);
    view.invalidate();
    const lines = view.render(60);
    for (const line of lines) {
      expect(visibleLength(line)).toBeLessThanOrEqual(60);
    }
  });
});
