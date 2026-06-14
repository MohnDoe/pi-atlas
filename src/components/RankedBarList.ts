import { type Component } from "@earendil-works/pi-tui";
import type { ChalkInstance } from "chalk";
import { UsageRow, type UsageRowTheme } from "./UsageRow";

export interface RankedBarItem {
  name: string;
  primaryValue: number;
  mainValueText: string;
  secondaryValueText?: string;
  color: ChalkInstance;
}

export class RankedBarList implements Component {
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(private items: RankedBarItem[], private theme: UsageRowTheme) {}

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines: string[] = [];

    if (this.items.length === 0) {
      this.cachedLines = [];
      this.cachedWidth = width;
      return [];
    }

    const total = this.items.reduce((sum, item) => sum + item.primaryValue, 0);

    const highestItem = total > 0
      ? (this.items[0].primaryValue * 100) / total
      : 0;

    for (const item of this.items) {
      let pct = 0;
      let barPct = 0;
      if (total > 0) {
        pct = (item.primaryValue * 100) / total;
        barPct = (pct * 100) / highestItem;
      }

      const row = new UsageRow(
        {
          name: item.name,
          mainValueText: item.mainValueText,
          secondaryValueText: item.secondaryValueText,
          pct,
          barPct,
        },
        item.color,
        this.theme,
      );
      lines.push(...row.render(width));
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
