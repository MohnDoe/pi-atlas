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
    this.rows = this.skills.flatMap((s) => {
      const firstLine = [
        cell.text(stripAnsi(s.name)),
        cell.text(this.theme.bold(formatNumber(s.invocations))),
        cell.text(this.theme.bold(formatNumber(s.tokens))),
        cell.text(this.theme.bold(formatNumber(s.toolCalls.total))),
        cell.text(
          s.cost > 0 ? this.theme.bold(formatCost(s.cost)) : this.theme.fg("dim", formatCost(0)),
        ),
      ];

      if (s.invocations > 1) {
        return [
          firstLine,
          [
            cell.text(""),
            cell.text(""),
            cell.text(
              this.theme.italic(
                this.theme.fg("dim", `~${formatNumber(s.tokens / s.invocations)} avg`),
              ),
            ),
            cell.text(
              s.toolCalls.total > 0
                ? this.theme.italic(
                    this.theme.fg(
                      "dim",
                      `~${formatNumber(parseInt(s.toolCalls.avg.toFixed(0)))} avg`,
                    ),
                  )
                : "",
            ),
            cell.text(
              s.cost > 0
                ? this.theme.italic(
                    this.theme.fg("dim", `~${formatCost(s.cost / s.invocations)} avg`),
                  )
                : "",
            ),
          ],
        ];
      }

      return [firstLine];
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
          { text: this.theme.bold("Skills"), align: "left" },
          { text: this.theme.fg("muted", "by cost"), align: "right" },
        ],
      });
      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: cell.header("Name"), width: "fill" },
              { header: cell.header("Invocations"), width: 12 },
              { header: cell.header("Tokens"), width: 14 },
              { header: cell.header("Tool calls"), width: 12 },
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
