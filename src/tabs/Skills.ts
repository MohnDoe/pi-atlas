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
      // Name
      cell.text(s.name),
      // Invocations
      cell.text(this.theme.fg("muted", formatNumber(s.calls))),
      // Sessions
      cell.text(this.theme.fg("muted", formatNumber(s.sessions))),
      // Tokens
      cell.text(formatNumber(s.usage.totalTokens)),
      // Input
      cell.text(
        this.theme.fg("muted", formatNumber(s.usage.input, { round: true })),
      ),
      // Output
      cell.text(
        this.theme.fg("muted", formatNumber(s.usage.output, { round: true })),
      ),
      // Cost
      cell.text(
        s.usage.cost.total > 0
          ? this.theme.bold(formatCost(s.usage.cost.total))
          : this.theme.fg("dim", formatCost(0)),
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
              { header: cell.header("Calls"), width: 7 },
              { header: cell.header("Sess."), width: 7 },
              { header: cell.header("Tokens"), width: 10 },
              { header: cell.header("↑In"), width: 6 },
              { header: cell.header("↓Out"), width: 6 },
              { header: cell.header("Cost"), width: 12 },
            ],
            rows: this.rows,
            maxHeight: this.maxHeight,
            sort: { column: 6, direction: "desc" },
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
