import type { Theme } from "@earendil-works/pi-coding-agent";
import { type Component } from "@earendil-works/pi-tui";
import { DaySpend } from "../types";
import { BarChart } from "../components/BarChart";
import { KpiCards, KpiData } from "../components/KpiCards";

const KPI_CARDS_HEIGHT = 4 * 2;
const SPACER_HEIGHT = 1;
const BAR_CHART_MAX_HEIGHT = 18;

export class Overview implements Component {
  private kpiCards: KpiCards;
  private barChart: BarChart;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    kpis: KpiData,
    dailySpend: DaySpend[],
    rangeLabel: string,
    theme: Theme,
    maxHeight: number,
  ) {
    this.kpiCards = new KpiCards(kpis, theme);
    const chartHeight = Math.min(
      BAR_CHART_MAX_HEIGHT,
      maxHeight - KPI_CARDS_HEIGHT - SPACER_HEIGHT,
    );
    this.barChart = new BarChart(dailySpend, rangeLabel, chartHeight, theme);
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const kpiLines = this.kpiCards.render(width);
    const spacer = [""];
    const chartLines = this.barChart.render(width);
    this.cachedLines = [...kpiLines, ...spacer, ...chartLines];
    this.cachedWidth = width;
    return this.cachedLines;
  }

  handleInput(_data: string): void {
    // No-op — Overview has no interactive elements
  }

  invalidate(): void {
    this.kpiCards.invalidate();
    this.barChart.invalidate();
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
