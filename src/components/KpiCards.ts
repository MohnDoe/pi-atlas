import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component } from "@earendil-works/pi-tui";
import { BorderBox } from "@mohndoe/pi-tui-extras";
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
  private topRow: GridRow;
  private bottomRow: GridRow;

  constructor(kpis: KpiData, theme: Theme) {
    this.theme = theme;

    const colPcts = [33, 33, 34];
    const baseBorderBoxOptions = {
      borderStyle: "single" as const,
      borderFn: (s: string) => this.theme.fg("borderMuted", s),
      padding: { left: 1, right: 1 },
    };

    const totalCostBox = new BorderBox(baseBorderBoxOptions);
    totalCostBox.addChild(
      new StatCard(
        {
          label: { text: "Total cost" },
          value: {
            text: this.theme.bold(formatCost(kpis.totalCost)),
            color: "success",
          },
        },
        this.theme,
      ),
    );

    const sessionsBox = new BorderBox(baseBorderBoxOptions);
    sessionsBox.addChild(
      new StatCard(
        {
          label: { text: "Sessions" },
          value: {
            text: this.theme.bold(formatNumber(kpis.sessionCount)),
            color: "accent",
          },
        },
        this.theme,
      ),
    );

    const messagesBox = new BorderBox(baseBorderBoxOptions);
    messagesBox.addChild(
      new StatCard(
        {
          label: { text: "Messages" },
          value: {
            text: this.theme.bold(formatNumber(kpis.totalMessages)),
            color: "borderAccent",
          },
        },
        this.theme,
      ),
    );

    this.topRow = new GridRow([totalCostBox, sessionsBox, messagesBox], colPcts);

    const activeDaysBox = new BorderBox(baseBorderBoxOptions);
    activeDaysBox.addChild(
      new StatCard(
        {
          label: { text: "Active days" },
          value: {
            text: this.theme.bold(formatNumber(kpis.daysActive)),
            color: "warning",
          },
        },
        this.theme,
      ),
    );

    const avgDayBox = new BorderBox(baseBorderBoxOptions);
    avgDayBox.addChild(
      new StatCard(
        {
          label: { text: "Avg/Day" },
          value: {
            text: this.theme.bold(formatCost(kpis.avgCostPerDay)),
            color: "border",
          },
        },
        this.theme,
      ),
    );

    const tokensBox = new BorderBox(baseBorderBoxOptions);
    tokensBox.addChild(
      new StatCard(
        {
          label: { text: "Tokens" },
          value: {
            text: this.theme.bold(formatNumber(kpis.totalTokens)),
            color: "error",
          },
        },
        this.theme,
      ),
    );

    this.bottomRow = new GridRow([activeDaysBox, avgDayBox, tokensBox], colPcts);
  }

  render(width: number): string[] {
    return [...this.topRow.render(width), ...this.bottomRow.render(width)];
  }

  invalidate(): void {
    this.topRow.invalidate();
    this.bottomRow.invalidate();
  }
}
