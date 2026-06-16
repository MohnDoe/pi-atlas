import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette.js";
import { SortedTable } from "../components/SortedTable.js";
import { formatCost, formatModelName, formatNumber } from "../format";
import { ModelStat } from "../types";

const EMPTY_MESSAGE = "No model data for this time range";

export class Models extends Container {
  private isEmpty: boolean;
  private theme: Theme;
  private table: SortedTable | null = null;

  constructor(
    private models: ModelStat[],
    theme: Theme,
    private palette: ColorPalette,
    private tui?: TUI,
  ) {
    super();
    this.theme = theme;
    this.isEmpty = models.length === 0;
  }

  render(width: number): string[] {
    this.clear();
    if (!this.isEmpty) {
      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: "Model", width: "fill", marquee: true },
              { header: "Provider", width: 12 },
              { header: "Calls", width: 6 },
              { header: "Cost", width: 8 },
            ],
            rows: this.models.map((m) => [
              formatModelName(m.model),
              m.provider ?? "Unknown",
              formatNumber(m.calls),
              formatCost(m.cost),
            ]),
            maxHeight: 20,
            sort: { column: 3, direction: "desc" },
            tui: this.tui,
          },
          this.theme,
        );
      }
      this.addChild(this.table);
    } else {
      this.addChild(new Text(this.theme.fg("muted", EMPTY_MESSAGE)));
    }
    return super.render(width);
  }

  handleInput(data: string): void {
    this.table?.handleInput(data);
  }

  invalidate(): void {
    super.invalidate();
  }
}
