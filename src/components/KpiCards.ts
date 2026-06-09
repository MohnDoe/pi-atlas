import { formatCost, formatNumber } from "../parser";
import { StatsTheme } from "../types";

interface CardDef {
  label: string;
  value: string;
}

export interface KpiData {
  totalCost: number;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  daysActive: number;
  avgCostPerDay: number;
}

export class KpiCards {
  private cards: CardDef[];
  private theme: StatsTheme;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(kpis: KpiData, theme: StatsTheme) {
    this.theme = theme;
    this.cards = [
      { label: "Total Cost", value: formatCost(kpis.totalCost) },
      { label: "Sessions", value: String(kpis.sessionCount) },
      { label: "Messages", value: formatNumber(kpis.totalMessages) },
      { label: "Total Tokens", value: formatNumber(kpis.totalTokens) },
      { label: "Days Active", value: String(kpis.daysActive) },
      { label: "Avg Cost/Day", value: formatCost(kpis.avgCostPerDay) },
    ];
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const gap = 2;
    const cardW = Math.max(12, Math.floor((width - gap * 2) / 3));
    const lines: string[] = [];

    for (let row = 0; row < 2; row++) {
      let line = "";
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        const c = this.cards[idx];
        // Build plain cell first, pad, then style — avoids style tags being sliced
        const plain = (c.label + ": " + c.value).slice(0, cardW).padEnd(cardW);
        const cell = this.theme.fg("text", plain);
        line += cell;
        if (col < 2) line += " ".repeat(gap);
      }
      lines.push(line);
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
