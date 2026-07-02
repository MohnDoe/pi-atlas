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

    const maxCost = Math.max(...this.skills.map((s) => s.cost), 0);
    this.rows = this.skills.map((s) => [
      cell.marquee(s.name, this.tui),
      cell.text(this.theme.fg("muted", formatNumber(s.calls))),
      cell.text(this.theme.fg("muted", formatNumber(s.sessions))),
      cell.text(s.cost > 0 ? this.theme.bold(formatCost(s.cost)) : this.theme.fg("dim", "Free")),
      cell.text(this.theme.fg("muted", formatNumber(s.tokens))),
    ]);
  }

  override render(width: number): string[] {
    this.clear();

    const borderBoxOptions: BorderBoxOptions = {
      borderStyle: "singleRounded",
      borderFn: (s) => this.theme.fg("border", s),
      titles: [{ text: this.theme.bold("Skills"), align: "left" }],
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
              { header: cell.header("Skill"), width: "fill" },
              { header: cell.header("Invocations"), width: 12 },
              { header: cell.header("Sessions"), width: 8 },
              { header: cell.header("Cost"), width: 10 },
              { header: cell.header("Tokens"), width: 10 },
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
