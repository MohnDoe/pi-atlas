import { matchesKey } from "@earendil-works/pi-tui";
import type { DaySpend } from "./types.js";

// ---- TabBar ----

export class TabBar {
  private tabs: string[];
  activeIndex: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(tabs: string[], activeIndex = 0) {
    this.tabs = tabs;
    this.activeIndex = activeIndex;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const parts: string[] = [];
    for (let i = 0; i < this.tabs.length; i++) {
      const label = this.tabs[i];
      if (i === this.activeIndex) {
        parts.push(`\x1b[7m ${label} \x1b[27m`);
      } else {
        parts.push(`\x1b[2m ${label} \x1b[22m`);
      }
    }

    let line = parts.join(" ");
    const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").length;
    if (visLen > width) line = line.slice(0, width);

    this.cachedLines = [line];
    this.cachedWidth = width;
    return this.cachedLines;
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "left")) {
      if (this.activeIndex > 0) { this.activeIndex--; this.invalidate(); }
      return true;
    }
    if (matchesKey(data, "right")) {
      if (this.activeIndex < this.tabs.length - 1) { this.activeIndex++; this.invalidate(); }
      return true;
    }
    return false;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}

// ---- RangeSelector ----

export class RangeSelector {
  private ranges: string[];
  selectedIndex: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(ranges: string[] = ["1d", "7d", "30d", "All"], selectedIndex = 0) {
    this.ranges = ranges;
    this.selectedIndex = selectedIndex;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const parts: string[] = [];
    for (let i = 0; i < this.ranges.length; i++) {
      const label = this.ranges[i];
      if (i === this.selectedIndex) {
        parts.push(`\x1b[7m[${label}]\x1b[27m`);
      } else {
        parts.push(` [${label}] `);
      }
    }

    this.cachedLines = [parts.join("")];
    this.cachedWidth = width;
    return this.cachedLines;
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "up")) {
      if (this.selectedIndex > 0) { this.selectedIndex--; this.invalidate(); }
      return true;
    }
    if (matchesKey(data, "down")) {
      if (this.selectedIndex < this.ranges.length - 1) { this.selectedIndex++; this.invalidate(); }
      return true;
    }
    if (matchesKey(data, "enter")) return true;
    return false;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}

// ---- KPI Cards ----

export interface KpiData {
  totalCost: number;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  daysActive: number;
  avgCostPerDay: number;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

function fmtCost(n: number): string {
  return "$" + n.toFixed(2);
}

interface CardDef { label: string; value: string }

export class KpiCards {
  private cards: CardDef[];
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(kpis: KpiData) {
    this.cards = [
      { label: "Total Cost", value: fmtCost(kpis.totalCost) },
      { label: "Sessions", value: String(kpis.sessionCount) },
      { label: "Messages", value: fmtNum(kpis.totalMessages) },
      { label: "Total Tokens", value: fmtNum(kpis.totalTokens) },
      { label: "Days Active", value: String(kpis.daysActive) },
      { label: "Avg Cost/Day", value: fmtCost(kpis.avgCostPerDay) },
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
        const cell = (c.label + ": " + c.value).slice(0, cardW).padEnd(cardW);
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

// ---- Bar Chart ----

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export class BarChart {
  private data: DaySpend[];
  private range: string;
  private maxHeight: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(data: DaySpend[], range: string, maxHeight: number) {
    this.data = data;
    this.range = range;
    this.maxHeight = maxHeight;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (this.data.length === 0) {
      this.cachedLines = ["No data"];
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
          line += "█".repeat(colW);
        } else if (barH > row) {
          line += "▌".repeat(colW);
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
      labelLine += lbl.padEnd(cellW).slice(0, cellW);
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
