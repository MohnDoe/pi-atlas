import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, visibleWidth, Text } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette.js";
import { formatCost, formatNumber, formatModelName } from "../format";
import { ModelStat } from "../types";
import { RankedBarList } from "../components/RankedBarList";

const EMPTY_MESSAGE = "No model data for this time range";

export class Models extends Container {
  private isEmpty: boolean;
  private theme: Theme;

  constructor(
    private models: ModelStat[],
    theme: Theme,
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

      this.addChild(
        new RankedBarList(
          this.models.map((m) => ({
            name: formatModelName(m.model),
            primaryValue: m.cost,
            mainValueText: formatCost(m.cost),
            secondaryValueText: formatNumber(m.calls) + " calls",
            color: this.palette.getColor(m.provider || ""),
          })),
          this.theme,
        ),
      );
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
