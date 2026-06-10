import chalk from "chalk";
import { StatsTheme } from "../types";
import { type Component } from "@earendil-works/pi-tui";
import { GridRow } from "./shared/GridRow";
import { StatCard } from "./StatCard";
import { formatCost, formatNumber } from "../parser";

export interface KpiData {
  totalCost: number;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  daysActive: number;
  avgCostPerDay: number;
}

export class KpiCards implements Component {
  private theme: StatsTheme;
  private topRow: GridRow;
  private bottomRow: GridRow;

  constructor(kpis: KpiData, theme: StatsTheme) {
    this.theme = theme;

    this.topRow = new GridRow(
      [
        new StatCard("Total", formatCost(kpis.totalCost), this.theme, chalk.green),
        new StatCard("Sessions", formatNumber(kpis.sessionCount), this.theme, chalk.blue),
        new StatCard("Messages", formatNumber(kpis.totalMessages), this.theme, chalk.magenta),
      ],
      [33, 33, 34],
    );

    this.bottomRow = new GridRow(
      [
        new StatCard("Active Days", formatNumber(kpis.daysActive), this.theme, chalk.yellow),
        new StatCard("Avg/Day", formatCost(kpis.avgCostPerDay), this.theme, chalk.cyan),
        //TODO:
        new StatCard("Today", "todo", this.theme, chalk.red),
      ],
      [33, 33, 34],
    );
  }

  render(width: number): string[] {
    return [...this.topRow.render(width), ...this.bottomRow.render(width)];
  }

  invalidate(): void {
    this.topRow.invalidate();
    this.bottomRow.invalidate();
  }
}
