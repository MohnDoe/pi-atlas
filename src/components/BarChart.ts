import { type Component, visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { DaySpend, type TimeRange } from "../types";
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

/** Minimum number of bars — prevents degenerate chart at tiny widths. */
const MIN_BARS = 2;

/**
 * Aggregate data into at most `target` buckets by grouping consecutive days.
 * Costs are summed per bucket; date is set to the first day in each group.
 */
function aggregateDays(data: DaySpend[], target: number): DaySpend[] {
  if (data.length <= target) return data;
  const n = data.length;
  const q = Math.floor(n / target);
  const r = n % target;
  const result: DaySpend[] = [];
  let idx = 0;
  for (let i = 0; i < target; i++) {
    const size = i < r ? q + 1 : q;
    let cost = 0;
    for (let j = 0; j < size; j++) {
      cost += data[idx + j].cost;
    }
    result.push({ date: data[idx].date, cost });
    idx += size;
  }
  return result;
}

export class BarChart implements Component {
  private data: DaySpend[];
  private range: TimeRange;
  private maxHeight: number;
  private theme: Theme;
  private yAxisSpacing: number | undefined;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    data: DaySpend[],
    range: TimeRange,
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

    // Downsample if too many bars for the available width
    const maxBars = Math.max(MIN_BARS, Math.floor(availW / (MIN_COL_WIDTH + BAR_GAP)));
    const plotData = this.data.length > maxBars ? aggregateDays(this.data, maxBars) : this.data;

    const totalGaps = plotData.length * BAR_GAP;
    const colW = Math.max(MIN_COL_WIDTH, Math.floor((availW - totalGaps) / plotData.length));

    const lines: string[] = [];

    for (let row = barAreaH - 1; row >= 0; row--) {
      let line = "";

      // Y-axis: right-aligned cost label + │ separator
      const isLabelRow = row === 0 || row % step === 0;
      if (isLabelRow) {
        // Compute the actual cost value for this Y-axis label row
        const val = (row / (barAreaH - 1)) * maxCost;
        line += formatCost(val).padStart(yLabelPad) + Y_AXIS_SEPARATOR;
      } else {
        line += " ".repeat(yLabelPad) + Y_AXIS_SEPARATOR;
      }

      for (const d of plotData) {
        // Normalised bar height on the 0..barAreaH scale
        const barH = maxCost > 0 ? (d.cost / maxCost) * barAreaH : 0;
        if (barH > row + HALF_BLOCK_THRESHOLD) {
          // Bar fills this row entirely — use full block
          line += "█".repeat(colW);
        } else if (barH > row) {
          // Bar partially fills this row — use half block
          line += "▄".repeat(colW);
        } else {
          // No bar at this row
          line += " ".repeat(colW);
        }
        line += " ".repeat(BAR_GAP);
      }
      lines.push(line);
    }

    // X-axis labels with y-axis bottom corner
    let labelLine = " ".repeat(yLabelPad + 1) + "└─";
    for (let i = 0; i < plotData.length; i++) {
      const lbl = formatLabel(plotData[i].date, i, plotData, this.range);
      const cellW = colW + BAR_GAP;
      if (lbl.length > 0) {
        if (lbl.length + 2 <= cellW) {
          // Standard: space + label + space + filler dashes
          const fill = cellW - lbl.length - 2;
          labelLine += " " + lbl + " " + "─".repeat(fill);
        } else {
          // Tight: label trimmed to fit with remaining filler
          labelLine += lbl + "─".repeat(Math.max(0, cellW - lbl.length));
        }
      } else {
        // Empty label: continuous ─ baseline
        labelLine += "─".repeat(cellW);
      }
    }
    lines.push(labelLine);

    // Granularity: text at top left showing aggregation level
    const granularityText = this.theme.italic(
      this.data.length === plotData.length
        ? "Daily"
        : "~" + (this.data.length / plotData.length).toFixed(1) + "d avg",
    );
    lines.push(
      this.theme.fg(
        "dim",
        " ".repeat(width - Math.max(0, visibleWidth(granularityText))) + granularityText,
      ),
    );

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

function formatLabel(dateStr: string, index: number, data: DaySpend[], range: TimeRange): string {
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
