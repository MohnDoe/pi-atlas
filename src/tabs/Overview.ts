import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text } from "@earendil-works/pi-tui";
import { BorderBox } from "@mohndoe/pi-tui-extras";
import { langPalette, modelPalette } from "../colorPalette";
import { BarChart } from "../components/BarChart";
import { KpiCards, type KpiData } from "../components/KpiCards";
import { GridRow } from "../components/shared/GridRow";
import { StatCard } from "../components/StatCard";
import { formatCost, formatNumber } from "../format";
import { type StatsSummary, type TimeRange } from "../types";

const SPACER_HEIGHT = 1;
const BAR_CHART_MAX_HEIGHT = 18;

export class Overview extends Container {
  private kpiCards: KpiCards;
  private barChart: BarChart;
  private topCards: GridRow;

  constructor(
    private summary: StatsSummary,
    rangeKey: TimeRange,
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

    this.topCards = new GridRow(
      [
        new BorderBox(
          topLanguage
            ? new StatCard(
                {
                  label: {
                    text: topLanguage.language,
                  },
                  value: {
                    text: this.theme.bold(formatNumber(topLanguage.lines) + " lines"),
                    color: "text",
                  },
                },
                this.theme,
              )
            : new Text("No data"),
          {
            titles: [{ text: this.theme.bold("Top Language"), align: "left" }],
            padding: { left: 1, right: 1 },
            borderColor: topLanguage
              ? langPalette.getColor(topLanguage.language)
              : (s: string) => this.theme.fg("borderMuted", s),
          },
        ),
        new BorderBox(
          topModel
            ? new StatCard(
                {
                  label: {
                    text: topModel.model,
                  },
                  value: {
                    text: this.theme.bold(formatCost(topModel.cost)),
                    color: "text",
                  },
                },
                this.theme,
              )
            : new Text("No data."),
          {
            titles: [{ text: this.theme.bold("Top model"), align: "left" }],
            padding: { left: 1, right: 1 },
            borderColor: modelPalette.getColor(topModel?.provider || ""),
          },
        ),
        new BorderBox(
          topProject
            ? new StatCard(
                {
                  label: {
                    text: topProject.project,
                  },
                  value: {
                    text: this.theme.bold(formatCost(topProject.cost)),
                    color: "text",
                  },
                },
                this.theme,
              )
            : new Text("No data."),
          {
            titles: [{ text: this.theme.bold("Top project"), align: "left" }],
            padding: { left: 1, right: 1 },
            borderColor: (s: string) => this.theme.fg("borderMuted", s),
          },
        ),
      ],
      [33, 33, 34],
    );

    const kpiCardsHeight = this.kpiCards.render(80).length;
    const topCardsHeight = this.topCards.render(80).length;

    const chartHeight = Math.min(
      BAR_CHART_MAX_HEIGHT,
      maxHeight - kpiCardsHeight - topCardsHeight - SPACER_HEIGHT * 2,
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
    this.addChild(this.kpiCards);
    this.addChild(new Spacer(1));
    this.addChild(
      new BorderBox(this.barChart, {
        borderStyle: "singleRounded",
        titles: [{ text: this.theme.bold("Cost overtime"), align: "left" }],
        borderColor: (s: string) => this.theme.fg("border", s),
        padding: { left: 1, right: 1, top: 1 },
      }),
    );
    this.addChild(new Spacer(1));
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
