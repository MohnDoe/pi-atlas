import { Container, Spacer, Text, visibleWidth } from "@earendil-works/pi-tui";
import type { ProjectStat, StatsTheme } from "../types";
import { UsageRow } from "../components/UsageRow";
import { formatModelName, formatCost, formatNumber } from "../parser";
import chalk from "chalk";

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
      //TODO: create a component for that.
      const title = this.theme.bold("Projects");
      const subtitle = this.theme.fg("muted", "by cost");
      const gap = " ".repeat(Math.max(0, width - visibleWidth(title) - visibleWidth(subtitle)));
      this.addChild(new Text(title + gap + subtitle, 0, 0));
      this.addChild(new Spacer(1));
      const totalCost = this.projects.reduce((prev, curr) => prev + curr.cost, 0);
      const highestPct = (this.projects[0]!.cost * 100) / totalCost;
      for (const projectStat of this.projects) {
        const pct = (projectStat.cost * 100) / totalCost;
        const barPct = (pct * 100) / highestPct;
        const row = new UsageRow(
          {
            name: projectStat.project,
            mainValueText: formatCost(projectStat.cost),
            secondaryValueText: formatNumber(projectStat.sessions) + " sessions",
            pct,
            barPct,
          },
          chalk.white,
        );
        this.addChild(row);
      }
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
