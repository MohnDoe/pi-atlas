import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { BorderBox, type BorderBoxOptions } from "@mohndoe/pi-tui-extras";
import { cell, type CellComponent } from "../components/cells";
import { SortedTable } from "../components/SortedTable";
import { formatCost, formatNumber } from "../format";
import { type SkillStat } from "../types";

const EMPTY_MESSAGE = "No skill usage data for this time range";

export class Skills extends Container {
  private isEmpty: boolean;
  private theme: Theme;
  private table: SortedTable | null = null;
  private rows: CellComponent[][] = [];

  constructor(
    private skills: SkillStat[],
    theme: Theme,
    private tui: TUI,
    private maxHeight: number,
  ) {
    super();
    this.theme = theme;
    this.isEmpty = skills.length === 0;
    this.buildRows();
  }

  /** Build row cells once in constructor. Data is stable per Skills instance. */
  private buildRows(): void {
    if (this.isEmpty) return;

    this.rows = this.skills.map((s) => [
      cell.text(s.name),
      cell.text(this.theme.fg("muted", formatNumber(s.calls))),
      cell.text(this.theme.fg("muted", formatNumber(s.sessions))),
      cell.text(this.theme.fg("muted", formatNumber(s.tokens))),
      cell.text(
        s.cost > 0 ? this.theme.bold(formatCost(s.cost)) : this.theme.fg("dim", formatCost(0)),
      ),
    ]);
  }

  override render(width: number): string[] {
    this.clear();

    const borderBoxOptions: BorderBoxOptions = {
      borderStyle: "singleRounded",
      borderFn: (s) => this.theme.fg("border", s),
      titles: [{ text: this.theme.bold("Skills"), align: "left" }],
    };
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
              { header: cell.header("Invocations"), width: 12 },
              { header: cell.header("Sessions"), width: 8 },
              { header: cell.header("Tokens"), width: 14 },
              { header: cell.header("Cost"), width: 16 },
            ],
            rows: this.rows,
            maxHeight: this.maxHeight,
            sort: { column: 4, direction: "desc" },
            tui: this.tui,
          },
          this.theme,
        );
      }
    }
    const borderBox = new BorderBox(borderBoxOptions);
    if (this.isEmpty) {
      borderBox.addChild(new Text(this.theme.fg("muted", EMPTY_MESSAGE)));
    } else {
      borderBox.addChild(this.table!);
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
