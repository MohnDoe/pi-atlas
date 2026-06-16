import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette.js";
import { SortedTable } from "../components/SortedTable.js";
import { formatCost, formatModelName, formatNumber } from "../format";
import { ModelStat } from "../types";

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
      this.addChild(
        new SortedTable(
          [
            {
              header: "Model",
              width: 30,
            },
            {
              header: "Provider",
              width: 12,
            },
            { header: "Calls", width: 6 },
            {
              header: "Cost",
              width: 7,
            },
          ],
          this.models.map((m) => [
            formatModelName(m.model),
            m.provider ?? "Unknown",
            formatNumber(m.calls),
            formatCost(m.cost),
          ]),
          20,
          this.theme,
          {
            column: 3,
            direction: "desc",
          },
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
