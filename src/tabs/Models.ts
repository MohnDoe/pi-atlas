import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette.js";
import { cell, type CellComponent } from "../components/cells.js";
import { SortedTable } from "../components/SortedTable.js";
import { formatCost, formatModelName, formatNumber } from "../format";
import { ModelStat } from "../types";

const EMPTY_MESSAGE = "No model data for this time range";

export class Models extends Container {
  private isEmpty: boolean;
  private theme: Theme;
  private table: SortedTable | null = null;
  private rows: CellComponent[][] = [];

  constructor(
    private models: ModelStat[],
    theme: Theme,
    private palette: ColorPalette,
    private tui: TUI,
  ) {
    super();
    this.theme = theme;
    this.isEmpty = models.length === 0;
    this.buildRows();
  }

  /** Build row cells once in constructor. Data is stable per Models instance —
   *  a new Models is created whenever Dashboard.buildTabs() runs (range switch).
   *  Building rows every render would destroy marquee state on each frame. */
  private buildRows(): void {
    if (this.isEmpty) return;
    const totalCost = this.models.reduce((sum, item) => sum + item.cost, 0);
    const maxCost = Math.max(...this.models.map((m) => m.cost), 0);
    this.rows = this.models.map((m) => {
      let pct = 0;
      let barPct = 0;
      if (totalCost > 0) {
        pct = (m.cost * 100) / totalCost;
        barPct = maxCost > 0 ? (m.cost / maxCost) * 100 : 0;
      }
      return [
        cell.marquee(formatModelName(m.model), this.tui),
        cell.text(this.theme.fg("dim", m.provider ?? "Unknown")),
        cell.text(this.theme.fg("muted", formatNumber(m.calls))),
        cell.text(
          m.cost > 0 ? this.theme.bold(formatCost(m.cost)) : this.theme.fg("dim", "Free"),
        ),
        m.cost > 0
          ? cell.bar(barPct, this.palette.getColor(m.provider ?? "Unknown"), (s) =>
              this.theme.fg("dim", s),
            )
          : cell.text(""),
      ];
    });
  }

  render(width: number): string[] {
    this.clear();
    if (!this.isEmpty) {
      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: cell.header("Model"), width: "fill" },
              { header: cell.header("Provider"), width: 16 },
              { header: cell.header("Calls"), width: 6 },
              { header: cell.header("Cost"), width: 7 },
              { header: cell.header("Cost %"), width: 20 },
            ],
            rows: this.rows,
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
    this.table?.invalidate();
  }
}
