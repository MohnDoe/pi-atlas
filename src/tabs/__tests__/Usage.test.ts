import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeMockTUI, makeTheme } from "../../__tests__/components.fixtures";
import { Usage } from "../Usage";
import { ToolStat, StatsSummary } from "../../types";

describe("Usage", () => {
  const mockTui = makeMockTUI();

  const tokenUsage = {
    total: 10000,
    input: 5000,
    output: 4000,
    cacheRead: 500,
    cacheWrite: 500,
  };

  const tools: ToolStat[] = [
    { tool: "bash", count: 150 },
    { tool: "read", count: 120 },
    { tool: "edit", count: 45 },
  ];

  it("renders token section with StatCards", () => {
    const tab = new Usage(tools, tokenUsage, makeTheme(), mockTui, 10);
    const text = tab.render(80).join("\n");

    expect(text).toContain("Tokens");
    expect(text).toContain("10.0k");
    expect(text).toContain("Input");
    expect(text).toContain("5.0k");
    expect(text).toContain("Output");
    expect(text).toContain("4.0k");
    expect(text).toContain("Cache Read");
    expect(text).toContain("500");
    expect(text).toContain("Cache Write");
  });

  it("renders tool table with formatted data", () => {
    const tab = new Usage(tools, tokenUsage, makeTheme(), mockTui, 10);
    const text = tab.render(80).join("\n");

    // Headers
    expect(text).toContain("Tool");
    expect(text).toContain("Calls");
    expect(text).toContain("Share %");

    // Tool names
    expect(text).toContain("bash");
    expect(text).toContain("read");
    expect(text).toContain("edit");

    // Call counts
    expect(text).toContain("150");
    expect(text).toContain("120");
    expect(text).toContain("45");
  });

  it("does NOT show 'Tool Calls' title", () => {
    const tab = new Usage(tools, tokenUsage, makeTheme(), mockTui, 10);
    const text = tab.render(80).join("\n");

    expect(text).not.toContain("Tool Calls");
  });

  it("shows empty state when tools is empty", () => {
    const tab = new Usage([], tokenUsage, makeTheme(), mockTui, 10);
    const text = tab.render(80).join("\n");
    expect(text).toContain("No tools data for this time range");
  });

  it("renders tool names with control characters as single lines", () => {
    const dirtyTools: ToolStat[] = [
      { tool: "ls -la agent/\n</parameter", count: 2 },
      { tool: "bash", count: 100 },
    ];
    const tab = new Usage(dirtyTools, tokenUsage, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    // Every line should be a single-line render — no extra lines from \n
    const text = lines.join("\n");
    // Tool column is ~20 chars wide — the \n is stripped, leaving truncated "ls -la agent/</param…"
    expect(text).not.toContain("agent/\n");
    expect(text).toContain("bash");
    // Verify no broken rows (each rendered line is a single table row)
    for (const line of lines) {
      // Each line should be a continuous visible string without embedded newlines
      expect(line).not.toContain("\n");
    }
  });

  it("renders within width", () => {
    const tab = new Usage(tools, tokenUsage, makeTheme(), mockTui, 10);
    const lines = tab.render(50);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(50);
    }
  });

  it("shows cursor on first tool row", () => {
    const tab = new Usage(tools, tokenUsage, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    // Find the first line with a cursor — should be in the tool table section
    const cursorLine = lines.find((l) => l.startsWith("▶"));
    expect(cursorLine).toBeDefined();
    expect(cursorLine).toContain("bash");
  });

  it("shows sort indicator on Calls column", () => {
    const tab = new Usage(tools, tokenUsage, makeTheme(), mockTui, 10);
    const lines = tab.render(80);
    const text = lines.join("\n");
    expect(text).toContain("Calls ▼");
  });

  it("invalidates render cache", () => {
    const tab = new Usage(tools, tokenUsage, makeTheme(), mockTui, 10);
    tab.render(80);
    tab.invalidate();
    const lines = tab.render(60);
    for (const line of lines) {
      const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
      expect(visLen).toBeLessThanOrEqual(60);
    }
  });

  it("supports re-render after invalidation (lifecycle path)", () => {
    const tab = new Usage(tools, tokenUsage, makeTheme(), mockTui, 10);

    const lines1 = tab.render(80);
    expect(lines1.join("\n")).toContain("bash");

    tab.invalidate();

    const lines2 = tab.render(80);
    const text = lines2.join("\n");
    expect(text).toContain("bash");
    expect(text).toContain("Tool");
    expect(text).toContain("Calls ▼");
    // Token section still intact
    expect(text).toContain("5.0k");
    expect(text).toContain("4.0k");
    const cursorLine = lines2.find((l) => l.startsWith("▶"));
    expect(cursorLine).toBeDefined();
    expect(cursorLine).toContain("bash");
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
      const longTool: ToolStat[] = [
        { tool: "a-very-long-tool-name-x", count: 150 },
      ];
      const tab = new Usage(longTool, tokenUsage, makeTheme(), mockTui, 10);

      tab.render(30);
      expect(vi.getTimerCount()).toBe(1);

      tab.invalidate();
      expect(vi.getTimerCount()).toBe(0);

      const lines = tab.render(80);
      const text = lines.join("\n");
      expect(text).toContain("a-very-long-tool");
      const cursorLine = lines.find((l) => l.startsWith("▶"));
      expect(cursorLine).toBeDefined();
      expect(cursorLine).toContain("a-very-long-tool");
    });
  });
});
