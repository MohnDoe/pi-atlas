import { type Component, visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { DaySpend, HourSpend, type TimeRange } from "../types";
import { MONTH_NAMES, formatCost } from "../format";

/** Number of hours displayed in a full day. */
const HOURS_PER_DAY = 24;

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

/** Space between bar columns in characters. */
const BAR_GAP = 1;

/** Auto-density: every row when barAreaH ≤ this. */
const DENSE_MAX_HEIGHT = 6;
/** Auto-density: every other row when barAreaH ≤ this. Otherwise every 3rd. */
const SPREAD_MAX_HEIGHT = 14;

/** Minimum number of bars — prevents degenerate chart at tiny widths. */
const MIN_BARS = 2;

/**
 * Aggregate data into at most `target` buckets by grouping consecutive items.
 * Costs are summed per bucket; the first item's other fields are preserved.
 */
function aggregate<T extends { cost: number }>(data: T[], target: number): T[] {
  if (data.length <= target) return data;
  const n = data.length;
  const q = Math.floor(n / target);
  const r = n % target;
  const result: T[] = [];
  let idx = 0;
  for (let i = 0; i < target; i++) {
    const size = i < r ? q + 1 : q;
    let cost = 0;
    for (let j = 0; j < size; j++) {
      cost += data[idx + j].cost;
    }
    result.push({ ...data[idx], cost });
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
  private hourlyData: HourSpend[];
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    data: DaySpend[],
    range: TimeRange,
    maxHeight: number,
    theme: Theme,
    yAxisSpacing?: number,
    hourlyData?: HourSpend[],
  ) {
    this.data = data;
    this.range = range;
    this.maxHeight = maxHeight;
    this.theme = theme;
    this.yAxisSpacing = yAxisSpacing;
    this.hourlyData = hourlyData ?? [];
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (this.data.length === 0 && this.hourlyData.length === 0) {
      this.cachedLines = [this.theme.fg("muted", "No data")];
      this.cachedWidth = width;
      return this.cachedLines;
    }

    let lines: string[] = [];
    if (this.range === "1d" && this.hourlyData.length === HOURS_PER_DAY) {
      lines = this.renderHourly(width);
    } else {
      lines = this.renderDaily(width);
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  private renderDaily(width: number): string[] {
    return this.renderBars(
      this.data,
      (plotData, _cellW) =>
        plotData.map((d, i) => formatDateLabel(d.date, i, plotData as DaySpend[], this.range)),
      (plotData, n) =>
        plotData.length === n ? "Daily" : "~" + (n / plotData.length).toFixed(1) + "d avg",
      width,
    );
  }

  /** Render per-hour bars for 1d range. */
  private renderHourly(width: number): string[] {
    return this.renderBars(
      this.hourlyData,
      (plotData, cellW) => {
        const interval = computeHourLabelInterval(plotData.length, cellW);
        return plotData.map((h, i) =>
          formatHourLabel(h.hour, i, plotData as HourSpend[], interval),
        );
      },
      (plotData, n) =>
        plotData.length === n ? "Hourly" : `~${(HOURS_PER_DAY / plotData.length).toFixed(1)}h avg`,
      width,
    );
  }

  /**
   * Shared bar-rendering engine. Handles layout, y-axis, bar drawing,
   * x-axis label line, and granularity footer.
   *
   * @param sourceData — raw data before potential downsampling
   * @param getLabels — computes x-axis labels from the (possibly downsampled) plotData and cell width
   * @param getGranularity — returns the granularity label string from (plotData, sourceLength)
   */
  private renderBars<T extends { cost: number }>(
    sourceData: T[],
    getLabels: (plotData: T[], cellWidth: number) => string[],
    getGranularity: (plotData: T[], sourceLength: number) => string,
    width: number,
  ): string[] {
    const barAreaH = Math.max(MIN_BAR_AREA, this.maxHeight - CHART_VERTICAL_PADDING);
    const maxCost = Math.max(...sourceData.map((d) => d.cost), COST_FLOOR);

    const step = this.yAxisSpacing != null ? Math.max(1, this.yAxisSpacing) : densityStep(barAreaH);
    const yLabelPad = computeLabelWidth(maxCost, barAreaH, step);
    const yAxisW = yLabelPad + Y_AXIS_SEPARATOR.length;

    const availW = width - yAxisW;
    const maxBars = Math.max(MIN_BARS, Math.floor(availW / (MIN_COL_WIDTH + BAR_GAP)));
    const plotData = sourceData.length > maxBars ? aggregate(sourceData, maxBars) : sourceData;

    const totalGaps = plotData.length * BAR_GAP;
    const colW = Math.max(MIN_COL_WIDTH, Math.floor((availW - totalGaps) / plotData.length));
    const cellW = colW + BAR_GAP;

    // Pre-compute bar heights once (not per-row)
    const barHeights = plotData.map((d) => (d.cost / maxCost) * barAreaH);
    const labels = getLabels(plotData, cellW);
    const granularityLabel = getGranularity(plotData, sourceData.length);

    const lines: string[] = [];

    for (let row = barAreaH - 1; row >= 0; row--) {
      let line = "";

      const isLabelRow = row === 0 || row % step === 0;
      if (isLabelRow) {
        const val = (row / (barAreaH - 1)) * maxCost;
        line += formatCost(val).padStart(yLabelPad) + Y_AXIS_SEPARATOR;
      } else {
        line += " ".repeat(yLabelPad) + Y_AXIS_SEPARATOR;
      }

      for (let bi = 0; bi < plotData.length; bi++) {
        const barH = barHeights[bi];
        if (barH > row + HALF_BLOCK_THRESHOLD) {
          line += "█".repeat(colW);
        } else if (barH > row) {
          line += "▄".repeat(colW);
        } else {
          line += " ".repeat(colW);
        }
        line += " ".repeat(BAR_GAP);
      }
      lines.push(line);
    }

    // X-axis labels with y-axis bottom corner
    let labelLine = " ".repeat(yLabelPad + 1) + "└─";
    for (let i = 0; i < plotData.length; i++) {
      const lbl = labels[i];
      const cellW = colW + BAR_GAP;
      if (lbl.length > 0) {
        if (lbl.length + 2 <= cellW) {
          const fill = cellW - lbl.length - 2;
          labelLine += " " + lbl + " " + "─".repeat(fill);
        } else {
          labelLine += lbl + "─".repeat(Math.max(0, cellW - lbl.length));
        }
      } else {
        labelLine += "─".repeat(cellW);
      }
    }
    lines.push(labelLine);

    // Granularity footer (right-aligned)
    const granularityText = this.theme.italic(granularityLabel);
    lines.push(
      this.theme.fg("dim", " ".repeat(width - visibleWidth(granularityText)) + granularityText),
    );

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

function formatDateLabel(
  dateStr: string,
  index: number,
  data: DaySpend[],
  range: TimeRange,
): string {
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

function computeHourLabelInterval(count: number, cellWidth: number): number {
  // Try intervals — pick the smallest that fits labels in cells
  const candidates = [4, 6, 12];
  for (const interval of candidates) {
    const labelsOnRow = Math.ceil(count / interval);
    // Rough estimate: each label needs cellWidth minus a gap for a space on each side
    const neededPerLabel = cellWidth;
    if (labelsOnRow * neededPerLabel <= count * cellWidth) {
      return interval;
    }
  }
  return candidates[candidates.length - 1];
}

function formatHourLabel(hour: number, index: number, data: HourSpend[], interval: number): string {
  if (index === 0 || index === data.length - 1 || hour % interval === 0) {
    return `${hour}h`;
  }
  return "";
}
