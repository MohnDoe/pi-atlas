import { type Component } from "@earendil-works/pi-tui";
import { DaySpend, StatsTheme } from "../types";
import { BarChart } from "../components/BarChart";
import { KpiCards, KpiData } from "../components/KpiCards";

const KPI_CARDS_HEIGHT = 4; // 2 rows × 2 lines (label + value)
const SPACER_HEIGHT = 1;

export class Overview implements Component {
  private kpiCards: KpiCards;
  private barChart: BarChart;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    kpis: KpiData,
    dailySpend: DaySpend[],
    rangeLabel: string,
    theme: StatsTheme,
    maxHeight: number,
  ) {
    this.kpiCards = new KpiCards(kpis, theme);
    const chartHeight = maxHeight - KPI_CARDS_HEIGHT - SPACER_HEIGHT;
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
