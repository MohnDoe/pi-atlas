import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette";
import { cell, type CellComponent } from "../components/cells";
import { SortedTable } from "../components/SortedTable";
import { formatCost, formatModelName, formatNumber } from "../format";
import { type ModelStat } from "../types";
import { BorderBox } from "@mohndoe/pi-tui-extras";

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
    private maxHeight: number,
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
      let barPct = 0;
      if (totalCost > 0) {
        barPct = maxCost > 0 ? (m.cost / maxCost) * 100 : 0;
      }
      return [
        cell.marquee(formatModelName(m.model), this.tui),
        cell.text(this.theme.fg("muted", m.provider ?? "Unknown")),
        cell.bar(barPct, this.palette.getColor(m.provider ?? "Unknown"), "transparent"),
        cell.text(this.theme.fg("muted", formatNumber(m.calls))),
        cell.text(m.cost > 0 ? this.theme.bold(formatCost(m.cost)) : this.theme.fg("dim", "Free")),
      ];
    });
  }

  override render(width: number): string[] {
    this.clear();
    const baseBorderBoxOptions = {
      borderStyle: "singleRounded" as const,
      borderFn: (s: string) => this.theme.fg("border", s),
    };
    if (!this.isEmpty) {
      const bb = new BorderBox({
        ...baseBorderBoxOptions,
        titles: [
          { text: this.theme.bold("Models"), align: "left" },
          { text: this.theme.fg("muted", "by cost"), align: "right" },
        ],
      });
      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: cell.header("Name"), width: "fill" },
              { header: cell.header("Provider"), width: 20 },
              { header: cell.header("Cost %"), width: 14 },
              { header: cell.header("Calls"), width: 10 },
              { header: cell.header("Cost"), width: 10 },
            ],
            rows: this.rows,
            maxHeight: this.maxHeight,
            sort: { column: 4, direction: "desc" },
            tui: this.tui,
          },
          this.theme,
        );
      }
      bb.addChild(this.table);
      this.addChild(bb);
    } else {
      const bb = new BorderBox({
        ...baseBorderBoxOptions,
        titles: [{ text: "Models", align: "left" }],
      });
      bb.addChild(new Text(this.theme.fg("muted", EMPTY_MESSAGE)));
      this.addChild(bb);
    }
    return super.render(width);
  }

  handleInput(data: string): void {
    this.table?.handleInput(data);
  }

  override invalidate(): void {
    super.invalidate();
    this.table?.invalidate();
  }
}
