import { Container, Spacer, Text, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { UsageRow } from "../components/UsageRow";
import { formatNumber } from "../parser";
import type { StatsTheme, ToolStat } from "../types";

export class Usage extends Container {
  constructor(
    private tools: ToolStat[],
    private theme: StatsTheme,
  ) {
    super();
  }

  render(width: number): string[] {
    this.clear();
    if (this.tools.length > 0) {
      //TODO: create a component for that.
      const title = this.theme.bold("Tool Calls");
      const totalToolCall = this.tools.reduce((prev, curr) => prev + curr.count, 0);
      const subtitle = this.theme.fg("muted", totalToolCall.toString());
      const gap = " ".repeat(Math.max(0, width - visibleWidth(title) - visibleWidth(subtitle)));
      this.addChild(new Text(title + gap + subtitle, 0, 0));
      this.addChild(new Spacer(1));
      const highestPct = (this.tools[0]!.count * 100) / totalToolCall;
      for (const toolStat of this.tools) {
        const pct = (toolStat.count * 100) / totalToolCall;
        const barPct = (pct * 100) / highestPct;
        const row = new UsageRow(
          {
            name: toolStat.tool,
            mainValueText: formatNumber(toolStat.count),
            pct,
            barPct,
          },
          chalk.white,
        );
        this.addChild(row);
      }
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
