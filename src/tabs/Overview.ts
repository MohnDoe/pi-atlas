import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer } from "@earendil-works/pi-tui";
import { DaySpend, type TimeRange } from "../types";
import { BarChart } from "../components/BarChart";
import { KpiCards, KpiData } from "../components/KpiCards";
import { BorderBox } from "../components/BorderBox";

const KPI_CARDS_HEIGHT = 4 * 2;
const SPACER_HEIGHT = 1;
const BAR_CHART_MAX_HEIGHT = 18;

export class Overview extends Container {
  private kpiCards: KpiCards;
  private barChart: BarChart;

  constructor(
    kpis: KpiData,
    dailySpend: DaySpend[],
    rangeKey: TimeRange,
    private theme: Theme,
    maxHeight: number,
  ) {
    super();
    this.kpiCards = new KpiCards(kpis, this.theme);
    const chartHeight = Math.min(
      BAR_CHART_MAX_HEIGHT,
      maxHeight - KPI_CARDS_HEIGHT - SPACER_HEIGHT,
    );
    this.barChart = new BarChart(dailySpend, rangeKey, chartHeight, this.theme);
  }

  render(width: number): string[] {
    this.clear();
    this.addChild(this.kpiCards);
    this.addChild(new Spacer(1));
    this.addChild(
      new BorderBox(
        {
          title: this.theme.bold("Usage overtime"),
          child: this.barChart,
          paddingX: 1,
          paddingY: 1,
        },
        this.theme,
      ),
    );
    return super.render(width);
  }

  invalidate(): void {
    super.invalidate();
    this.kpiCards.invalidate();
    this.barChart.invalidate();
    this.children.forEach((c) => c.invalidate?.());
  }
}
