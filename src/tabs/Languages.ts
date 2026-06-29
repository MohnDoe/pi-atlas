import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette";
import { cell, type CellComponent } from "../components/cells";
import { SortedTable } from "../components/SortedTable";
import { formatNumber } from "../format";
import type { LangStat } from "../types";
import { BorderBox } from "@mohndoe/pi-tui-extras";

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
    const totalLines = this.languages.reduce((sum, item) => sum + item.lines, 0);
    const maxLines = Math.max(...this.languages.map((l) => l.lines), 0);
    this.rows = this.languages.map((l) => {
      let barPct = 0;
      if (totalLines > 0) {
        barPct = maxLines > 0 ? (l.lines / maxLines) * 100 : 0;
      }
      return [
        cell.marquee(l.language, this.tui),
        cell.bar(barPct, this.palette.getColor(l.language), "transparent"),
        cell.text(this.theme.fg("muted", formatNumber(l.edits))),
        cell.text(this.theme.bold(formatNumber(l.lines))),
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
          { text: this.theme.bold("Languages"), align: "left" },
          { text: this.theme.fg("muted", "by lines written"), align: "right" },
        ],
      });

      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: cell.header("Name"), width: "fill" },
              { header: cell.header("Share %"), width: 20 },
              { header: cell.header("Edits"), width: 10 },
              { header: cell.header("Lines"), width: 12 },
            ],
            rows: this.rows,
            maxHeight: this.maxHeight,
            sort: { column: 3, direction: "desc" },
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
        titles: [{ text: "Languages", align: "left" }],
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
