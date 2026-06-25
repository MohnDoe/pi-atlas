import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { BorderBox } from "@mohndoe/pi-tui-extras";
import { cell, type CellComponent } from "../components/cells";
import { SortedTable } from "../components/SortedTable";
import { formatCost, formatNumber, stripAnsi } from "../format";
import type { SkillStat } from "../types";

const EMPTY_MESSAGE = "No skills data for this time range";

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

  private buildRows(): void {
    if (this.isEmpty) return;
    this.rows = this.skills.map((s) => [
      cell.marquee(stripAnsi(s.name), this.tui),
      cell.text(this.theme.bold(formatNumber(s.invocations))),
      cell.text(this.theme.bold(formatNumber(s.tokens))),
      cell.text(this.theme.bold(formatNumber(s.toolCalls.total))),
      cell.text(s.cost > 0 ? this.theme.bold(formatCost(s.cost)) : this.theme.fg("dim", formatCost(0))),
    ]);
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
          { text: this.theme.bold("Skills"), align: "left" },
          { text: this.theme.fg("muted", "by cost"), align: "right" },
        ],
      });
      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: cell.header("Skill"), width: "fill" },
              { header: cell.header("Invocations"), width: 12 },
              { header: cell.header("Tokens"), width: 12 },
              { header: cell.header("Tools"), width: 10 },
              { header: cell.header("Cost"), width: 12 },
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
        titles: [{ text: "Skills", align: "left" }],
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
