import { type Component } from "@earendil-works/pi-tui";
import { formatCost, formatNumber } from "../parser";
import { StatsTheme } from "../types";
import { RankedTable, ColumnDef } from "./RankedTable";

export class ProjectsToolsView implements Component {
  private projectsTable: RankedTable | null;
  private toolsTable: RankedTable | null;
  private maxHeight: number;
  private theme: StatsTheme;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    projects: { project: string; cost: number; sessions: number }[],
    tools: { tool: string; count: number }[],
    maxHeight: number,
    theme: StatsTheme,
  ) {
    this.maxHeight = maxHeight;
    this.theme = theme;

    if (projects.length > 0) {
      const projCols: ColumnDef[] = [
        { header: "Project", width: 8 },
        { header: "Cost", width: 6 },
        { header: "Sessions", width: 8 },
      ];
      const projRows = projects.map((p) => [
        p.project.slice(0, 8),
        formatCost(p.cost),
        formatNumber(p.sessions),
      ]);
      this.projectsTable = new RankedTable(projCols, projRows, maxHeight, theme);
    } else {
      this.projectsTable = null;
    }

    if (tools.length > 0) {
      const toolCols: ColumnDef[] = [
        { header: "Tool", width: 10 },
        { header: "Count", width: 8 },
      ];
      const toolRows = tools.map((t) => [t.tool.slice(0, 10), formatNumber(t.count)]);
      this.toolsTable = new RankedTable(toolCols, toolRows, maxHeight, theme);
    } else {
      this.toolsTable = null;
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const gap = 3;
    const halfW = Math.floor((width - gap) / 2);

    const leftLines = this.projectsTable
      ? this.projectsTable.render(halfW)
      : [this.theme.fg("muted", "  No project data")];
    const rightLines = this.toolsTable
      ? this.toolsTable.render(halfW)
      : [this.theme.fg("muted", "  No tool data")];

    const maxLen = Math.max(leftLines.length, rightLines.length);
    const lines: string[] = [];

    for (let i = 0; i < maxLen; i++) {
      const left = (leftLines[i] ?? "").padEnd(halfW);
      const right = rightLines[i] ?? "";
      let row = left;
      if (right) row += " │ " + right;
      const visLen = row.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
      if (visLen > width) row = row.slice(0, width);
      lines.push(row);
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): void {
    // Up/down scroll both tables together
    if (data === "\x1b[A" || data === "\x1b[B") {
      if (this.projectsTable) this.projectsTable.handleInput(data);
      if (this.toolsTable) this.toolsTable.handleInput(data);
      this.invalidate();
    }
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
    if (this.projectsTable) this.projectsTable.invalidate();
    if (this.toolsTable) this.toolsTable.invalidate();
  }
}
