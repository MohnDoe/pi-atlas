import { Container, Spacer, visibleWidth, Text } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette.js";
import { formatCost, formatNumber } from "../parser";
import { ModelStat, StatsTheme } from "../types";
import { UsageRow } from "../components/UsageRow.js";

const EMPTY_MESSAGE = "No model data for this time range";

export class Models extends Container {
  private isEmpty: boolean;
  private theme: StatsTheme;

  constructor(
    private models: ModelStat[],
    theme: StatsTheme,
    private palette: ColorPalette,
  ) {
    super();
    this.theme = theme;
    this.isEmpty = models.length === 0;
  }

  render(width: number): string[] {
    this.clear();
    if (!this.isEmpty) {
      const title = this.theme.bold("Models");
      const subtitle = this.theme.fg("muted", "by cost");
      const gap = " ".repeat(Math.max(0, width - visibleWidth(title) - visibleWidth(subtitle)));
      this.addChild(new Text(title + gap + subtitle, 0, 0));
      this.addChild(new Spacer(1));

      const totalCost = this.models.reduce((prev, curr) => prev + curr.cost, 0);
      const highestPct = (this.models[0]!.cost * 100) / totalCost;
      for (const modelStat of this.models) {
        const pct = (modelStat.cost * 100) / totalCost;
        const barPct = (pct * 100) / highestPct;
        const row = new UsageRow(
          {
            name: modelStat.model,
            mainValueText: formatCost(modelStat.cost),
            secondaryValueText: formatNumber(modelStat.calls) + " calls",
            pct,
            barPct,
          },
          this.palette.getColor(modelStat.model),
        );
        this.addChild(row);
      }
    } else {
      this.addChild(new Text(this.theme.fg("muted", EMPTY_MESSAGE)));
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
