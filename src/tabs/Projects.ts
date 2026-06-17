import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { cell, type CellComponent } from "../components/cells.js";
import { SortedTable } from "../components/SortedTable.js";
import { formatCost, formatNumber } from "../format";
import { ProjectStat } from "../types";

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
    const maxCost = Math.max(...this.projects.map((p) => p.cost), 0);
    this.rows = this.projects.map((p) => {
      const barPct = maxCost > 0 ? (p.cost / maxCost) * 100 : 0;
      return [
        cell.marquee(p.project, this.tui),
        cell.text(String(p.sessions)),
        cell.text(p.cost > 0 ? this.theme.bold(formatCost(p.cost)) : this.theme.fg("dim", "Free")),
        cell.bar(barPct, chalk.white, (s) => this.theme.fg("dim", s)),
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
              { header: cell.header("Project"), width: "fill" },
              { header: cell.header("Sessions"), width: 10 },
              { header: cell.header("Cost"), width: 8 },
              { header: cell.header("Share %"), width: 20 },
            ],
            rows: this.rows,
            maxHeight: this.maxHeight,
            sort: { column: 2, direction: "desc" },
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
