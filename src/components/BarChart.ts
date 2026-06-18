import { type Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { DaySpend } from "../types";
import { MONTH_NAMES, formatCost } from "../format";

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Minimum bar area height (rows) — prevents degenerate chart at tiny maxHeight. */
const MIN_BAR_AREA = 3;
/** Padding rows subtracted from maxHeight: 1 for x-axis labels + 1 for top padding. */
const CHART_VERTICAL_PADDING = 2;
/** Minimum column width per bar — prevents invisible bars on narrow terminals. */
const MIN_COL_WIDTH = 2;
/** Floor cost to avoid divide-by-zero when computing bar proportions. */
const COST_FLOOR = 0.01;
/** Threshold for half-block character: barH extension beyond integer row. */
const HALF_BLOCK_THRESHOLD = 0.5;
/** Y-axis separator string " │ " — space, box-drawing line, space. */
const Y_AXIS_SEPARATOR = " │ ";
/** Y-axis separator width in characters. */
const Y_SEP_WIDTH = 3;
/** Space between bar columns in characters. */
const BAR_GAP = 1;

/** Auto-density: every row when barAreaH ≤ this. */
const DENSE_MAX_HEIGHT = 6;
/** Auto-density: every other row when barAreaH ≤ this. Otherwise every 3rd. */
const SPREAD_MAX_HEIGHT = 14;

export class BarChart implements Component {
  private data: DaySpend[];
  private range: string;
  private maxHeight: number;
  private theme: Theme;
  private yAxisSpacing: number | undefined;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    data: DaySpend[],
    range: string,
    maxHeight: number,
    theme: Theme,
    yAxisSpacing?: number,
  ) {
    this.data = data;
    this.range = range;
    this.maxHeight = maxHeight;
    this.theme = theme;
    this.yAxisSpacing = yAxisSpacing;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (this.data.length === 0) {
      this.cachedLines = [this.theme.fg("muted", "No data")];
      this.cachedWidth = width;
      return this.cachedLines;
    }

    const barAreaH = Math.max(MIN_BAR_AREA, this.maxHeight - CHART_VERTICAL_PADDING);
    const maxCost = Math.max(...this.data.map((d) => d.cost), COST_FLOOR);

    const step = this.yAxisSpacing != null ? Math.max(1, this.yAxisSpacing) : densityStep(barAreaH);
    const yLabelPad = computeLabelWidth(maxCost, barAreaH, step);
    const yAxisW = yLabelPad + Y_SEP_WIDTH;

    // Available width for bars
    const availW = width - yAxisW;
    const totalGaps = this.data.length * BAR_GAP;
    const colW = Math.max(MIN_COL_WIDTH, Math.floor((availW - totalGaps) / this.data.length));

    const lines: string[] = [];

    for (let row = barAreaH - 1; row >= 0; row--) {
      let line = "";

      // Y-axis: right-aligned cost label + │ separator
      const isLabelRow = row === 0 || row % step === 0;
      if (isLabelRow) {
        const val = (row / (barAreaH - 1)) * maxCost;
        line += formatCost(val).padStart(yLabelPad) + Y_AXIS_SEPARATOR;
      } else {
        line += " ".repeat(yLabelPad) + Y_AXIS_SEPARATOR;
      }

      for (const d of this.data) {
        const barH = maxCost > 0 ? (d.cost / maxCost) * barAreaH : 0;
        if (barH > row + HALF_BLOCK_THRESHOLD) {
          line += this.theme.fg("accent", "█".repeat(colW));
        } else if (barH > row) {
          line += this.theme.fg("accent", "▌".repeat(colW));
        } else {
          line += " ".repeat(colW);
        }
        line += " ".repeat(BAR_GAP);
      }
      lines.push(line);
    }

    // X-axis labels with y-axis padding
    let labelLine = " ".repeat(yAxisW);
    for (let i = 0; i < this.data.length; i++) {
      const lbl = formatLabel(this.data[i].date, i, this.data, this.range);
      const cellW = colW + BAR_GAP;
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

function densityStep(barAreaH: number): number {
  if (barAreaH <= DENSE_MAX_HEIGHT) return 1;
  if (barAreaH <= SPREAD_MAX_HEIGHT) return 2;
  return 3;
}

function computeLabelWidth(maxCost: number, barAreaH: number, step: number): number {
  let maxW = 0;
  for (let row = 0; row < barAreaH; row += step) {
    const val = (row / (barAreaH - 1)) * maxCost;
    maxW = Math.max(maxW, formatCost(val).length);
  }
  // Baseline $0.00 is always shown but already covered by row=0
  return maxW;
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
