import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component } from "@earendil-works/pi-tui";
import { GridRow } from "./shared/GridRow";
import { StatCard } from "./StatCard";
import { formatCost, formatNumber } from "../format";
import { BorderBox } from "./BorderBox";

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
  private topRow: GridRow;
  private bottomRow: GridRow;

  constructor(kpis: KpiData, theme: Theme) {
    this.theme = theme;

    const colPcts = [33, 33, 34];

    this.topRow = new GridRow(
      [
        new BorderBox(
          {
            rounded: false,
            color: "borderMuted",
            child: new StatCard(
              {
                label: {
                  text: "Total cost",
                  color: "text",
                },
                value: {
                  text: this.theme.bold(formatCost(kpis.totalCost)),
                  color: "success",
                },
              },
              this.theme,
            ),
          },
          this.theme,
        ),
        new BorderBox(
          {
            rounded: false,
            color: "borderMuted",
            child: new StatCard(
              {
                label: {
                  text: "Sessions",
                  color: "text",
                },
                value: {
                  text: this.theme.bold(formatNumber(kpis.sessionCount)),
                  color: "accent",
                },
              },
              this.theme,
            ),
          },
          this.theme,
        ),
        new BorderBox(
          {
            rounded: false,
            color: "borderMuted",
            child: new StatCard(
              {
                label: {
                  text: "Messages",
                  color: "text",
                },
                value: {
                  text: this.theme.bold(formatNumber(kpis.totalMessages)),
                  color: "borderAccent",
                },
              },
              this.theme,
            ),
          },
          this.theme,
        ),
      ],
      colPcts,
    );

    this.bottomRow = new GridRow(
      [
        new BorderBox(
          {
            rounded: false,
            color: "borderMuted",
            child: new StatCard(
              {
                label: {
                  text: "Active days",
                  color: "text",
                },
                value: {
                  text: this.theme.bold(formatNumber(kpis.daysActive)),
                  color: "warning",
                },
              },
              this.theme,
            ),
          },
          this.theme,
        ),
        new BorderBox(
          {
            rounded: false,
            color: "borderMuted",
            child: new StatCard(
              {
                label: {
                  text: "Avg/Day",
                  color: "text",
                },
                value: {
                  text: this.theme.bold(formatCost(kpis.avgCostPerDay)),
                  color: "border",
                },
              },
              this.theme,
            ),
          },
          this.theme,
        ),
        new BorderBox(
          {
            rounded: false,
            color: "borderMuted",
            child: new StatCard(
              {
                label: {
                  text: "Tokens",
                  color: "text",
                },
                value: {
                  text: this.theme.bold(formatNumber(kpis.totalTokens)),
                  color: "error",
                },
              },
              this.theme,
            ),
          },
          this.theme,
        ),
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
