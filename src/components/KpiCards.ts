import { type Component } from "@earendil-works/pi-tui";
import { GridRow } from "./shared/GridRow";
import { StatCard, type StatCardTheme } from "./StatCard";
import { formatCost, formatNumber } from "../format";

export interface KpiData {
  totalCost: number;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  daysActive: number;
  avgCostPerDay: number;
}

export class KpiCards implements Component {
  private theme: StatCardTheme;
  private topRow: GridRow;
  private bottomRow: GridRow;

  constructor(kpis: KpiData, theme: StatCardTheme) {
    this.theme = theme;

    const colPcts = [33, 33, 34];

    this.topRow = new GridRow(
      [
        new StatCard("Total", formatCost(kpis.totalCost), this.theme, "success"),
        new StatCard("Sessions", formatNumber(kpis.sessionCount), this.theme, "accent"),
        new StatCard("Messages", formatNumber(kpis.totalMessages), this.theme, "borderAccent"),
      ],
      colPcts,
    );

    this.bottomRow = new GridRow(
      [
        new StatCard("Active", formatNumber(kpis.daysActive), this.theme, "warning"),
        new StatCard("Avg/Day", formatCost(kpis.avgCostPerDay), this.theme, "border"),
        new StatCard("Tokens", formatNumber(kpis.totalTokens), this.theme, "error"),
      ],
      colPcts,
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
