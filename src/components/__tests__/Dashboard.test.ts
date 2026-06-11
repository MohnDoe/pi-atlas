import { describe, expect, it } from "vitest";
import { testTheme } from "../../__tests__/components.fixtures";
import { Dashboard } from "../Dashboard";

describe("Dashboard", () => {
  const makeSummary = () => ({
    totalCost: 5.0,
    sessionCount: 3,
    totalMessages: 50,
    totalTokens: 10000,
    daysActive: 3,
    avgCostPerDay: 1.67,
    todayCost: 1.0,
    languages: [],
    models: [],
    projects: [],
    tools: [],
    dailySpend: [
      { date: "2026-06-06", cost: 1.0 },
      { date: "2026-06-07", cost: 2.0 },
      { date: "2026-06-08", cost: 2.0 },
    ],
  });

  it("renders all sections", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme(), 24);
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Overview");
    expect(text).toContain("1d");
    expect(text).toContain("7d");
    expect(text).toContain("Total");
    expect(text).toContain("Esc/q close");
    expect(text).toContain("█");
  });

  it("uses theme.fg('borderMuted') for separators", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme(), 24);
    const lines = dash.render(80);
    // Separator lines are "─" repeated
    const sepLines = lines.filter((l) => l.includes("─"));
    expect(sepLines.length).toBeGreaterThan(0);
    for (const line of sepLines) {
      expect(line).toContain("<fg:borderMuted>");
    }
  });

  it("uses theme.fg('dim') for footer", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme(), 24);
    const lines = dash.render(80);
    const footer = lines[lines.length - 1];
    expect(footer).toContain("<fg:dim>");
  });

  it("shows 'No sessions found' when no session data exists", () => {
    const zeroSummary = {
      ...makeSummary(),
      totalCost: 0,
      sessionCount: 0,
      totalMessages: 0,
      totalTokens: 0,
      dailySpend: [],
    };
    const summaries = [zeroSummary, zeroSummary, zeroSummary, zeroSummary];
    const dash = new Dashboard(summaries, testTheme(), 24);
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No sessions found");
  });

  it("shows 'No data for this time range' when current range is empty", () => {
    const dataSummary = { ...makeSummary(), totalCost: 5.0, sessionCount: 3 };
    const zeroSummary = {
      ...makeSummary(),
      totalCost: 0,
      sessionCount: 0,
      totalMessages: 0,
      totalTokens: 0,
      dailySpend: [],
    };
    // 1d range (index 0) empty, others have data
    const summaries = [zeroSummary, dataSummary, dataSummary, dataSummary];
    const dash = new Dashboard(summaries, testTheme(), 24);
    // Default range is All (index 3). r key cycles: All→1d
    dash.handleInput("r");
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No data for this time range");
  });

  it("handles escape to close", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    let closed = false;
    const dash = new Dashboard(summaries, testTheme(), 24, () => {
      closed = true;
    });
    dash.handleInput("\x1b");
    expect(closed).toBe(true);
  });

  it("handles q to close", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    let closed = false;
    const dash = new Dashboard(summaries, testTheme(), 24, () => {
      closed = true;
    });
    dash.handleInput("q");
    expect(closed).toBe(true);
  });

  it("renders Languages tab when active", () => {
    const summary = {
      ...makeSummary(),
      languages: [
        { language: "TypeScript", lines: 1500, edits: 45 },
        { language: "Python", lines: 800, edits: 20 },
        { language: "JSON", lines: 300, edits: 5 },
      ],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Switch to Languages tab (index 1)
    dash.handleInput("\x1b[C"); // right arrow
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Languages");
    expect(text).toContain("by lines written");

    expect(text).toContain("TypeScript");
    expect(text).toContain("Python");
    expect(text).toContain("JSON");
    expect(text).toContain("1.5k ln");
    expect(text).toContain("800 ln");
  });

  it("Languages tab updates when time range changes", () => {
    const summary1d = {
      ...makeSummary(),
      languages: [{ language: "TypeScript", lines: 100, edits: 3 }],
    };
    const summary7d = {
      ...makeSummary(),
      languages: [
        { language: "TypeScript", lines: 1500, edits: 45 },
        { language: "Go", lines: 200, edits: 8 },
      ],
    };
    const summaries = [summary1d, summary7d, summary7d, summary7d];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Default range is All (index 3 = summary7d). r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    // Switch to Languages tab
    dash.handleInput("\x1b[C"); // right to Languages
    let lines = dash.render(80);
    let text = lines.join("\n");
    // Range 1d, only 1 language
    expect(text).toContain("TypeScript");
    expect(text).not.toContain("Go");

    // Switch back to Overview, r to 7d, then back to Languages
    dash.handleInput("\x1b[D"); // left to Overview
    dash.handleInput("r"); // 1d → 7d
    dash.handleInput("\x1b[C"); // right to Languages
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("Go");
  });

  it("Languages tab shows empty state when no language data", () => {
    const summary = { ...makeSummary(), languages: [] };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    dash.handleInput("\x1b[C"); // right to Languages
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No language data");
  });

  // ---- Models tab ----

  it("renders Models tab with header and data rows", () => {
    const summary = {
      ...makeSummary(),
      models: [
        { model: "claude-sonnet-4-20250514", cost: 12.34, calls: 150 },
        { model: "deepseek-v4-pro", cost: 5.67, calls: 80 },
        { model: "gemini-2.0-flash", cost: 1.23, calls: 40 },
      ],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Switch to Models tab (index 2)
    dash.handleInput("\x1b[C"); // right to Languages
    dash.handleInput("\x1b[C"); // right to Models
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("#");
    expect(text).toContain("Model");
    expect(text).toContain("Cost");
    expect(text).toContain("Calls");
    expect(text).toContain("Sonnet 4");
    expect(text).toContain("12.34");
    expect(text).toContain("150");
  });

  it("formats model names in Models tab", () => {
    const summary = {
      ...makeSummary(),
      models: [{ model: "claude-sonnet-4-20250514", cost: 1.0, calls: 10 }],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Navigate to Models tab
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Sonnet 4");
    expect(text).not.toContain("claude-sonnet-4-20250514");
  });

  it("Models tab shows empty state when no model data", () => {
    const summary = { ...makeSummary(), models: [] };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    const lines = dash.render(80);
    const text = lines.join("\n");
    expect(text).toContain("No model data");
  });

  it("Models tab updates when time range changes", () => {
    const summary1d = {
      ...makeSummary(),
      models: [{ model: "claude-sonnet-4-20250514", cost: 1.0, calls: 5 }],
    };
    const summary7d = {
      ...makeSummary(),
      models: [
        { model: "claude-sonnet-4-20250514", cost: 12.0, calls: 150 },
        { model: "deepseek-v4-pro", cost: 5.0, calls: 80 },
      ],
    };
    const summaries = [summary1d, summary7d, summary7d, summary7d];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Default range is All (index 3 = summary7d). r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    let lines = dash.render(80);
    let text = lines.join("\n");
    // Range 1d, only 1 model
    expect(text).toContain("Sonnet 4");
    expect(text).not.toContain("V4 Pro");

    // Switch back to Overview, r to 7d, then back to Models
    dash.handleInput("\x1b[D"); // left to Languages
    dash.handleInput("\x1b[D"); // left to Overview
    dash.handleInput("r"); // 1d → 7d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("V4 Pro");
  });

  it("Models tab scrolls with up/down", () => {
    const manyModels = Array.from({ length: 20 }, (_, i) => ({
      model: `model-${i}`,
      cost: 20 - i,
      calls: (20 - i) * 10,
    }));
    const summary = { ...makeSummary(), models: manyModels };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Navigate to Models tab
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    let lines = dash.render(80);
    // With new tab architecture: header(2) + spacer + sep + tabbar + sep = 6
    // lines[6] = table header, lines[7] = first data row (rank 1)
    expect(lines[7]).toContain("1");
    expect(lines[7]).toContain("Model 0");

    // Scroll down
    dash.handleInput("\x1b[B");
    lines = dash.render(80);
    expect(lines[7]).toContain("2");
    expect(lines[7]).toContain("Model 1");

    // Scroll back up
    dash.handleInput("\x1b[A");
    lines = dash.render(80);
    expect(lines[7]).toContain("1");
    expect(lines[7]).toContain("Model 0");
  });

  it("switches tabs with left/right arrows", () => {
    const summaries = [makeSummary(), makeSummary(), makeSummary(), makeSummary()];
    const dash = new Dashboard(summaries, testTheme(), 24);
    dash.handleInput("\x1b[C"); // right
    const lines = dash.render(80);
    expect(lines.join("\n")).toContain("Languages");
  });

  // ---- Projects + Tools tab ----

  it("renders Projects+Tools tab with side-by-side tables", () => {
    const summary = {
      ...makeSummary(),
      projects: [
        { project: "pi-usage", cost: 15.5, sessions: 42 },
        { project: "dotfiles", cost: 8.2, sessions: 20 },
      ],
      tools: [
        { tool: "bash", count: 150 },
        { tool: "read", count: 120 },
      ],
    };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Navigate to Projects+Tools tab (index 3)
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects + Tools
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("Project");
    expect(text).toContain("Tool");
    expect(text).toContain("pi-usage");
    expect(text).toContain("bash");
    expect(text).toContain("$15.50");
    expect(text).toContain("150");
    expect(text).not.toContain("Coming soon");
  });

  it("Projects+Tools tab shows empty states when no data", () => {
    const summary = { ...makeSummary(), projects: [], tools: [] };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects + Tools
    const lines = dash.render(80);
    const text = lines.join("\n");

    expect(text).toContain("No project data");
    expect(text).toContain("No tool data");
  });

  it("Projects+Tools tab updates when time range changes", () => {
    const summary1d = {
      ...makeSummary(),
      projects: [{ project: "pi-usage", cost: 1.0, sessions: 5 }],
      tools: [{ tool: "bash", count: 10 }],
    };
    const summary7d = {
      ...makeSummary(),
      projects: [
        { project: "pi-usage", cost: 15.5, sessions: 42 },
        { project: "dotfiles", cost: 8.2, sessions: 20 },
      ],
      tools: [
        { tool: "bash", count: 150 },
        { tool: "read", count: 120 },
      ],
    };
    const summaries = [summary1d, summary7d, summary7d, summary7d];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Default range is All (index 3 = summary7d). r key cycles: All→1d
    dash.handleInput("r"); // All → 1d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects + Tools
    let lines = dash.render(80);
    let text = lines.join("\n");
    // 1d range: only pi-usage and bash
    expect(text).toContain("pi-usage");
    expect(text).toContain("bash");
    expect(text).not.toContain("dotfiles");
    expect(text).not.toContain("read");

    // Switch back to Overview, r to 7d, then back to Projects+Tools
    dash.handleInput("\x1b[D"); // ← Models
    dash.handleInput("\x1b[D"); // ← Languages
    dash.handleInput("\x1b[D"); // ← Overview
    dash.handleInput("r"); // 1d → 7d
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects + Tools
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("dotfiles");
    expect(text).toContain("read");
  });

  it("Projects+Tools tab scrolls with up/down", () => {
    const manyProjects = Array.from({ length: 20 }, (_, i) => ({
      project: `proj-${i}`,
      cost: 20 - i,
      sessions: (20 - i) * 10,
    }));
    const manyTools = Array.from({ length: 25 }, (_, i) => ({
      tool: `tool-${i}`,
      count: 30 - i,
    }));
    const summary = { ...makeSummary(), projects: manyProjects, tools: manyTools };
    const summaries = [summary, summary, summary, summary];
    const dash = new Dashboard(summaries, testTheme(), 24);

    // Navigate to Projects+Tools
    dash.handleInput("\x1b[C"); // → Languages
    dash.handleInput("\x1b[C"); // → Models
    dash.handleInput("\x1b[C"); // → Projects + Tools
    let lines = dash.render(80);
    let text = lines.join("\n");
    expect(text).toContain("proj-0");
    expect(text).toContain("tool-0");

    // Scroll down
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[B");
    dash.handleInput("\x1b[B");
    lines = dash.render(80);
    text = lines.join("\n");
    expect(text).toContain("proj-3");
    expect(text).toContain("tool-3");
  });
});
