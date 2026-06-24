import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component } from "@earendil-works/pi-tui";
import { formatCost, formatNumber } from "../format";
import { GridRow } from "./shared/GridRow";
import { StatCard } from "./StatCard";

export interface KpiData {
  totalCost: number;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  daysActive: number;
  avgCostPerDay: number;
}

export class KpiCards implements Component {
  private theme: Theme;
  private row: GridRow;

  constructor(kpis: KpiData, theme: Theme) {
    this.theme = theme;

    const colPcts = [17, 17, 17, 17, 17, 15];

    const totalCostCard = new StatCard(
      {
        label: { text: "Total cost" },
        value: {
          text: this.theme.bold(formatCost(kpis.totalCost)),
          color: "success",
        },
      },
      this.theme,
    );

    const sessionsCard = new StatCard(
      {
        label: { text: "Sessions" },
        value: {
          text: this.theme.bold(formatNumber(kpis.sessionCount)),
          color: "accent",
        },
      },
      this.theme,
    );

    const messagesCard = new StatCard(
      {
        label: { text: "Messages" },
        value: {
          text: this.theme.bold(formatNumber(kpis.totalMessages)),
          color: "borderAccent",
        },
      },
      this.theme,
    );

    const activeDaysCard = new StatCard(
      {
        label: { text: "Active days" },
        value: {
          text: this.theme.bold(formatNumber(kpis.daysActive)),
          color: "warning",
        },
      },
      this.theme,
    );

    const avgDayCard = new StatCard(
      {
        label: { text: "Avg/Day" },
        value: {
          text: this.theme.bold(formatCost(kpis.avgCostPerDay)),
          color: "border",
        },
      },
      this.theme,
    );

    const tokensCard = new StatCard(
      {
        label: { text: "Tokens" },
        value: {
          text: this.theme.bold(formatNumber(kpis.totalTokens)),
          color: "error",
        },
      },
      this.theme,
    );

    this.row = new GridRow(
      [totalCostCard, tokensCard, messagesCard, sessionsCard, activeDaysCard, avgDayCard],
      colPcts,
    );
  }

  render(width: number): string[] {
    return [...this.row.render(width)];
  }

  invalidate(): void {
    this.row.invalidate();
  }
}
