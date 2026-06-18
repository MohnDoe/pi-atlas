import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette.js";
import { cell, type CellComponent } from "../components/cells.js";
import { SortedTable } from "../components/SortedTable.js";
import { formatNumber } from "../format";
import { LangStat } from "../types";

const EMPTY_MESSAGE = "No language data for this time range";

export class Languages extends Container {
  private isEmpty: boolean;
  private theme: Theme;
  private table: SortedTable | null = null;
  private rows: CellComponent[][] = [];

  constructor(
    private languages: LangStat[],
    theme: Theme,
    private palette: ColorPalette,
    private tui: TUI,
    private maxHeight: number,
  ) {
    super();
    this.theme = theme;
    this.isEmpty = languages.length === 0;
    this.buildRows();
  }

  /** Build row cells once in constructor. Data is stable per Languages instance —
   *  a new Languages is created whenever Dashboard.buildTabs() runs (range switch). */
  private buildRows(): void {
    if (this.isEmpty) return;
    const maxLines = Math.max(...this.languages.map((l) => l.lines), 0);
    this.rows = this.languages.map((l) => {
      const barPct = maxLines > 0 ? (l.lines / maxLines) * 100 : 0;
      return [
        cell.marquee(l.language, this.tui),
        cell.bar(barPct, this.palette.getColor(l.language), "transparent"),
        cell.text(this.theme.fg("muted", formatNumber(l.edits))),
        cell.text(this.theme.bold(formatNumber(l.lines))),
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
              { header: cell.header("Language"), width: 12 },
              { header: cell.header("Share %"), width: "fill" },
              { header: cell.header("Edits"), width: 8 },
              { header: cell.header("Lines"), width: 14 },
            ],
            rows: this.rows,
            maxHeight: this.maxHeight,
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
