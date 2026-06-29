import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { BorderBox, type BorderBoxOptions } from "@mohndoe/pi-tui-extras";
import { cell, type CellComponent } from "../components/cells";
import { SortedTable } from "../components/SortedTable";
import { formatCost, formatNumber } from "../format";
import { type ProjectStat } from "../types";

const EMPTY_MESSAGE = "No projects data for this time range";

export class Projects extends Container {
  private isEmpty: boolean;
  private theme: Theme;
  private table: SortedTable | null = null;
  private rows: CellComponent[][] = [];

  constructor(
    private projects: ProjectStat[],
    theme: Theme,
    private tui: TUI,
    private maxHeight: number,
  ) {
    super();
    this.theme = theme;
    this.isEmpty = projects.length === 0;
    this.buildRows();
  }

  /** Build row cells once in constructor. Data is stable per Projects instance. */
  private buildRows(): void {
    if (this.isEmpty) return;

    const totalCost = this.projects.reduce((sum, item) => sum + item.cost, 0);
    const maxCost = Math.max(...this.projects.map((p) => p.cost), 0);
    this.rows = this.projects.map((p) => {
      let barPct = 0;
      if (totalCost > 0) {
        barPct = maxCost > 0 ? (p.cost / maxCost) * 100 : 0;
      }
      return [
        cell.marquee(p.project, this.tui),
        cell.bar(barPct, (s) => s, "transparent"),
        cell.text(this.theme.fg("muted", formatNumber(p.sessions))),
        cell.text(p.cost > 0 ? this.theme.bold(formatCost(p.cost)) : this.theme.fg("dim", "Free")),
      ];
    });
  }

  override render(width: number): string[] {
    this.clear();

    const borderBoxOptions: BorderBoxOptions = {
      borderStyle: "singleRounded",
      borderFn: (s) => this.theme.fg("border", s),
      titles: [{ text: this.theme.bold("Projects"), align: "left" }],
    };
    let borderBox = new BorderBox(borderBoxOptions);
    if (!this.isEmpty) {
      borderBoxOptions.titles = [
        ...borderBoxOptions.titles!,
        { text: this.theme.fg("muted", "by cost"), align: "right" },
      ];
      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: cell.header("Name"), width: "fill" },
              { header: cell.header("Share %"), width: 14 },
              { header: cell.header("Sessions"), width: 10 },
              { header: cell.header("Cost"), width: 10 },
            ],
            rows: this.rows,
            maxHeight: this.maxHeight,
            sort: { column: 3, direction: "desc" },
            tui: this.tui,
          },
          this.theme,
        );
      }
      borderBox = new BorderBox(borderBoxOptions);
      borderBox.addChild(this.table);
    } else {
      borderBox.addChild(new Text(this.theme.fg("muted", EMPTY_MESSAGE)));
    }
    this.addChild(borderBox);
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
