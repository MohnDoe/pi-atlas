import { type Component } from "@earendil-works/pi-tui";
import type { ProjectStat, ToolStat, StatsTheme } from "../types";
import { ProjectsToolsView } from "../components/ProjectToolsView";

export class ProjectsTools implements Component {
  private view: ProjectsToolsView;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    projects: ProjectStat[],
    tools: ToolStat[],
    theme: StatsTheme,
    maxHeight: number,
  ) {
    const projRows = projects.map((p) => ({
      project: p.project,
      cost: p.cost,
      sessions: p.sessions,
    }));
    const toolRows = tools.map((t) => ({
      tool: t.tool,
      count: t.count,
    }));
    this.view = new ProjectsToolsView(projRows, toolRows, maxHeight, theme);
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
    this.cachedLines = this.view.render(width);
    this.cachedWidth = width;
    return this.cachedLines;
  }

  handleInput(data: string): void {
    this.view.handleInput(data);
    this.cachedLines = null;
    this.cachedWidth = -1;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
    this.view.invalidate();
  }
}
