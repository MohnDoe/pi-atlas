import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer } from "@earendil-works/pi-tui";
import { DaySpend, type TimeRange } from "../types";
import { BarChart } from "../components/BarChart";
import { KpiCards, KpiData } from "../components/KpiCards";

const KPI_CARDS_HEIGHT = 4 * 2;
const SPACER_HEIGHT = 1;
const BAR_CHART_MAX_HEIGHT = 18;

export class Overview extends Container {
  private kpiCards: KpiCards;
  private barChart: BarChart;
  private spacer: Spacer;

  constructor(
    kpis: KpiData,
    dailySpend: DaySpend[],
    rangeKey: TimeRange,
    theme: Theme,
    maxHeight: number,
  ) {
    super();
    this.kpiCards = new KpiCards(kpis, theme);
    const chartHeight = Math.min(
      BAR_CHART_MAX_HEIGHT,
      maxHeight - KPI_CARDS_HEIGHT - SPACER_HEIGHT,
    );
    this.barChart = new BarChart(dailySpend, rangeKey, chartHeight, theme);
    this.spacer = new Spacer(1);
  }

  render(width: number): string[] {
    this.clear();
    this.addChild(this.kpiCards);
    this.addChild(this.spacer);
    this.addChild(this.barChart);
    return super.render(width);
  }

  invalidate(): void {
    super.invalidate();
    this.kpiCards.invalidate();
    this.barChart.invalidate();
  }
}
