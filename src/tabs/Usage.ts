import { Container, Spacer, Text, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { RankedBarList } from "../components/RankedBarList";
import { formatNumber } from "../parser";
import type { StatsSummary, StatsTheme, ToolStat } from "../types";
import { GridRow } from "../components/shared/GridRow";
import { StatCard } from "../components/StatCard";

interface TokenUsageStat {
  total: StatsSummary["totalTokens"];
  input: StatsSummary["totalInputTokens"];
  output: StatsSummary["totalOutputTokens"];
  cacheRead: StatsSummary["totalCacheReadTokens"];
  cacheWrite: StatsSummary["totalCacheWriteTokens"];
}

export class Usage extends Container {
  constructor(
    private tools: ToolStat[],
    private tokenUsage: TokenUsageStat,
    private theme: StatsTheme,
  ) {
    super();
  }

  render(width: number): string[] {
    this.clear();

    const title = this.theme.bold("Tokens");
    const subtitle = this.theme.fg("muted", formatNumber(this.tokenUsage.total));
    const gap = " ".repeat(Math.max(0, width - visibleWidth(title) - visibleWidth(subtitle)));
    this.addChild(new Text(title + gap + subtitle, 0, 0));

    const row = new GridRow(
      [
        new StatCard(
          "Input",
          formatNumber(this.tokenUsage.input),
          this.theme,
          chalk.hex("#a0dcfd"),
        ),
        new StatCard(
          "Output",
          formatNumber(this.tokenUsage.output),
          this.theme,
          chalk.hex("#a0dcfd"),
        ),
        new StatCard(
          "Cache Read",
          formatNumber(this.tokenUsage.cacheRead),
          this.theme,
          chalk.hex("#a0dcfd"),
        ),
        new StatCard(
          "Cache Write",
          formatNumber(this.tokenUsage.cacheWrite),
          this.theme,
          chalk.hex("#a0dcfd"),
        ),
      ],
      [25, 25, 25, 25],
    );

    this.addChild(row);

    if (this.tools.length > 0) {
      this.addChild(new Spacer(1));
      const toolTitle = this.theme.bold("Tool Calls");
      const totalToolCall = this.tools.reduce((prev, curr) => prev + curr.count, 0);
      const toolSubtitle = this.theme.fg("muted", totalToolCall.toString());
      const toolGap = " ".repeat(Math.max(0, width - visibleWidth(toolTitle) - visibleWidth(toolSubtitle)));
      this.addChild(new Text(toolTitle + toolGap + toolSubtitle, 0, 0));
      this.addChild(new Spacer(1));
      this.addChild(new RankedBarList(
        this.tools.map((t) => ({
          name: t.tool,
          primaryValue: t.count,
          mainValueText: formatNumber(t.count),
          color: chalk.white,
        })),
      ));
    } else {
      this.addChild(new Text(this.theme.fg("muted", "No tools data for this time range.")));
    }

    return super.render(width);
  }

  handleInput(_data: string): void {
    this.invalidate();
  }

  invalidate(): void {
    super.invalidate();
  }
}
