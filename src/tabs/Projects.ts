import { Container, Spacer, Text, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { RankedBarList } from "../components/RankedBarList";
import { formatCost, formatNumber } from "../parser";
import type { ProjectStat, StatsTheme } from "../types";

export class Projects extends Container {
  constructor(
    private projects: ProjectStat[],
    private theme: StatsTheme,
  ) {
    super();
  }

  render(width: number): string[] {
    this.clear();
    if (this.projects.length > 0) {
      const title = this.theme.bold("Projects");
      const subtitle = this.theme.fg("muted", "by cost");
      const gap = " ".repeat(Math.max(0, width - visibleWidth(title) - visibleWidth(subtitle)));
      this.addChild(new Text(title + gap + subtitle, 0, 0));
      this.addChild(new Spacer(1));
      this.addChild(new RankedBarList(
        this.projects.map((p) => ({
          name: p.project,
          primaryValue: p.cost,
          mainValueText: formatCost(p.cost),
          secondaryValueText: formatNumber(p.sessions) + " sessions",
          color: chalk.white,
        })),
      ));
    } else {
      this.addChild(new Text(this.theme.fg("muted", "No projects data for this time range.")));
    }

    return super.render(width);
  }

  handleInput(_data: string): void {
    this.invalidate();
  }

  invalidate(): void {
    super.invalidate();
  }
}
