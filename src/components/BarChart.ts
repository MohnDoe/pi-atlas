import { type Component } from "@earendil-works/pi-tui";
import { DaySpend, StatsTheme } from "../types";
import { MONTH_NAMES } from "../format";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export class BarChart implements Component {
  private data: DaySpend[];
  private range: string;
  private maxHeight: number;
  private theme: StatsTheme;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(data: DaySpend[], range: string, maxHeight: number, theme: StatsTheme) {
    this.data = data;
    this.range = range;
    this.maxHeight = maxHeight;
    this.theme = theme;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (this.data.length === 0) {
      this.cachedLines = [this.theme.fg("muted", "No data")];
      this.cachedWidth = width;
      return this.cachedLines;
    }

    const barAreaH = Math.max(3, this.maxHeight - 2);
    const colW = Math.max(2, Math.floor((width - this.data.length) / this.data.length));
    const maxCost = Math.max(...this.data.map((d) => d.cost), 0.01);

    const lines: string[] = [];

    for (let row = barAreaH - 1; row >= 0; row--) {
      let line = "";
      for (const d of this.data) {
        const barH = maxCost > 0 ? (d.cost / maxCost) * barAreaH : 0;
        if (barH > row + 0.5) {
          line += this.theme.fg("accent", "█".repeat(colW));
        } else if (barH > row) {
          line += this.theme.fg("accent", "▌".repeat(colW));
        } else {
          line += " ".repeat(colW);
        }
        line += " ";
      }
      lines.push(line);
    }

    // X-axis labels
    let labelLine = "";
    for (let i = 0; i < this.data.length; i++) {
      const lbl = formatLabel(this.data[i].date, i, this.data, this.range);
      const cellW = colW + 1;
      labelLine += this.theme.fg("dim", lbl.padEnd(cellW).slice(0, cellW));
    }
    lines.push(labelLine);

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}

function formatLabel(dateStr: string, index: number, data: DaySpend[], range: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  //FIX: fix range text
  if (range === "1d" || range === "7d") {
    return DAY_NAMES[d.getUTCDay()];
  }
  if (range === "30d") {
    const day = d.getUTCDate();
    if (day === 1 || day % 5 === 0 || index === 0 || index === data.length - 1) {
      return String(day);
    }
    return "";
  }
  // All — show month when it changes or first entry
  const month = MONTH_NAMES[d.getUTCMonth()];
  if (index === 0) return month;
  const prevD = new Date(data[index - 1].date + "T00:00:00Z");
  if (prevD.getUTCMonth() !== d.getUTCMonth()) return month;
  return "";
}
