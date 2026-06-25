import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { BorderBox } from "@mohndoe/pi-tui-extras";
import { langPalette, modelPalette } from "../colorPalette";
import { BarChart } from "../components/BarChart";
import { KpiCards, type KpiData } from "../components/KpiCards";
import { GridRow } from "../components/shared/GridRow";
import { StatCard } from "../components/StatCard";
import { formatCost, formatModelName, formatNumber } from "../format";
import { type StatsSummary, type ModelToProvider, type TimeRange } from "../types";

const SPACER_HEIGHT = 1;
const BAR_CHART_MAX_HEIGHT = 18;

export class Overview extends Container {
  private kpiCards: KpiCards;
  private barChart: BarChart;
  private topCards: GridRow;

  constructor(
    private summary: StatsSummary,
    rangeKey: TimeRange,
    private modelToProvider: ModelToProvider,
    private theme: Theme,
    maxHeight: number,
  ) {
    super();
    const kpis: KpiData = {
      totalCost: this.summary.totalCost,
      sessionCount: this.summary.sessionCount,
      totalMessages: this.summary.totalMessages,
      totalTokens: this.summary.totalTokens,
      daysActive: this.summary.daysActive,
      avgCostPerDay: this.summary.avgCostPerDay,
    };
    this.kpiCards = new KpiCards(kpis, this.theme);

    const topLanguage = summary.languages[0];
    const topModel = summary.models[0];
    const topProject = summary.projects[0];

    const langBox = new BorderBox({
      borderStyle: "heavy",
      titles: [{ text: this.theme.bold("Top Language"), align: "left" }],
      footers: topLanguage
        ? [
            {
              text: this.theme.fg("muted", formatNumber(topLanguage.lines) + " ln"),
              align: "right",
            },
          ]
        : [],
      padding: { left: 1, right: 1 },
      borderFn: topLanguage
        ? langPalette.getColor(topLanguage.language)
        : (s: string) => this.theme.fg("borderMuted", s),
    });
    langBox.addChild(
      new Text(
        topLanguage ? this.theme.fg("text", topLanguage.language) : this.theme.fg("dim", "No data"),
        0,
        0,
      ),
    );

    const modelBox = new BorderBox({
      borderStyle: "heavy",
      titles: [{ text: this.theme.bold("Top model"), align: "left" }],
      footers: topModel
        ? [
            {
              text: this.theme.fg("muted", formatCost(topModel.cost)),
              align: "right",
            },
          ]
        : [],
      padding: { left: 1, right: 1 },
      borderFn: topModel
        ? modelPalette.getColor(this.modelToProvider.get(topModel.model) ?? "")
        : (s: string) => this.theme.fg("borderMuted", s),
    });
    modelBox.addChild(
      new Text(
        topModel
          ? this.theme.fg("text", formatModelName(topModel.model))
          : this.theme.fg("dim", "No data"),
        0,
        0,
      ),
    );

    const projectBox = new BorderBox({
      borderStyle: "heavy",
      titles: [{ text: this.theme.bold("Top project"), align: "left" }],
      footers: topProject
        ? [
            {
              text: this.theme.fg("muted", formatCost(topProject.cost)),
              align: "right",
            },
          ]
        : [],
      padding: { left: 1, right: 1 },
      borderFn: (s: string) => this.theme.fg("text", s),
    });

    projectBox.addChild(
      new Text(
        topProject ? this.theme.fg("text", topProject.project) : this.theme.fg("dim", "No data"),
        0,
        0,
      ),
    );

    this.topCards = new GridRow([langBox, modelBox, projectBox], [33, 33, 34]);

    const kpiCardsHeight = this.kpiCards.render(80).length;
    const topCardsHeight = this.topCards.render(80).length;

    const chartHeight = Math.min(
      BAR_CHART_MAX_HEIGHT,
      maxHeight - kpiCardsHeight - topCardsHeight - SPACER_HEIGHT * 0,
    );
    this.barChart = new BarChart(
      this.summary.dailySpend,
      rangeKey,
      chartHeight,
      this.theme,
      undefined,
      this.summary.hourlySpend,
    );
  }

  override render(width: number): string[] {
    this.clear();
    const kpiBorderBox = new BorderBox({
      borderStyle: "singleRounded",
      padding: { left: 1, right: 1 },
    });
    kpiBorderBox.addChild(this.kpiCards);
    this.addChild(kpiBorderBox);

    const costBarChartBox = new BorderBox({
      borderStyle: "singleRounded",
      titles: [{ text: this.theme.bold("Cost overtime"), align: "left" }],
      borderFn: (s: string) => this.theme.fg("border", s),
      padding: { left: 1, right: 1, top: 1 },
    });
    costBarChartBox.addChild(this.barChart);
    this.addChild(costBarChartBox);

    this.addChild(this.topCards);

    return super.render(width);
  }

  override invalidate(): void {
    super.invalidate();
    this.kpiCards.invalidate();
    this.barChart.invalidate();
    this.topCards.invalidate();
    this.children.forEach((c) => c.invalidate?.());
  }
}
