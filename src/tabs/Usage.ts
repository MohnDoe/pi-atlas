import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Text, type TUI } from "@earendil-works/pi-tui";
import { BorderBox, type BorderBoxOptions } from "@mohndoe/pi-tui-extras";
import { cell, type CellComponent } from "../components/cells";
import { GridRow } from "../components/shared/GridRow";
import { SortedTable } from "../components/SortedTable";
import { StatCard } from "../components/StatCard";
import { formatNumber, stripAnsi } from "../format";
import type { StatsSummary, ToolStat } from "../types";

interface TokenUsageStat {
  total: StatsSummary["totalTokens"];
  input: StatsSummary["totalInputTokens"];
  output: StatsSummary["totalOutputTokens"];
  cacheRead: StatsSummary["totalCacheReadTokens"];
  cacheWrite: StatsSummary["totalCacheWriteTokens"];
}

const TOOL_NAME_MAX_LENGTH = 120;

const EMPTY_MESSAGE = "No tools data for this time range";

export class Usage extends Container {
  private isEmpty: boolean;
  private theme: Theme;
  private tokenUsage: TokenUsageStat;
  private rows: CellComponent[][] = [];
  private table: SortedTable | null = null;
  private tableHeight: number;

  constructor(
    private tools: ToolStat[],
    tokenUsage: TokenUsageStat,
    theme: Theme,
    private tui: TUI,
    maxHeight: number,
  ) {
    super();
    this.theme = theme;
    this.tokenUsage = tokenUsage;
    this.isEmpty = tools.length === 0;
    // Tool table gets contentHeight - 4 to account for "Tokens" title + spacer + 2 line overhead
    this.tableHeight = Math.max(3, maxHeight - 4);
    this.buildRows();
  }

  /** Build row cells once in constructor. */
  private buildRows(): void {
    if (this.isEmpty) return;
    const totalCount = this.tools.reduce((sum, item) => sum + item.count, 0);
    const maxCount = Math.max(...this.tools.map((t) => t.count), 0);
    this.rows = this.tools.map((t) => {
      let barPct = 0;
      if (totalCount > 0) {
        barPct = maxCount > 0 ? (t.count / maxCount) * 100 : 0;
      }
      return [
        cell.marquee(stripAnsi(t.name).slice(0, TOOL_NAME_MAX_LENGTH), this.tui),
        cell.bar(barPct, (s) => s, "transparent"),
        cell.text(this.theme.bold(formatNumber(t.count))),
      ];
    });
  }

  override render(width: number): string[] {
    this.clear();

    // Token section: title + stat cards
    const title = this.theme.bold("Tokens");
    const subtitle = this.theme.fg("muted", formatNumber(this.tokenUsage.total));
    const row = new GridRow(
      [
        new StatCard(
          {
            label: {
              text: "Input",
            },
            value: {
              text: this.theme.bold(formatNumber(this.tokenUsage.input)),
              color: "accent",
            },
          },
          this.theme,
        ),
        new StatCard(
          {
            label: {
              text: "Output",
            },
            value: {
              text: this.theme.bold(formatNumber(this.tokenUsage.output)),
              color: "accent",
            },
          },

          this.theme,
        ),
        new StatCard(
          {
            label: {
              text: "Cache Read",
            },
            value: {
              text: this.theme.bold(formatNumber(this.tokenUsage.cacheRead)),
              color: "accent",
            },
          },
          this.theme,
        ),
        new StatCard(
          {
            label: {
              text: "Cache Write",
            },
            value: {
              text: this.theme.bold(formatNumber(this.tokenUsage.cacheWrite)),
              color: "accent",
            },
          },
          this.theme,
        ),
      ],
      [25, 25, 25, 25],
    );
    const statRowBorderBox = new BorderBox({
      titles: [
        { text: title, align: "left" },
        { text: subtitle, align: "right" },
      ],
      borderFn: (s: string) => this.theme.fg("border", s),
      padding: { left: 1, right: 1 },
    });
    statRowBorderBox.addChild(row);
    this.addChild(statRowBorderBox);

    const borderBoxOptions: BorderBoxOptions = {
      borderStyle: "singleRounded",
      borderFn: (s) => this.theme.fg("border", s),
      titles: [{ text: this.theme.bold("Tools"), align: "left" }],
    };

    let borderBox = new BorderBox(borderBoxOptions);

    // Tool table section
    if (!this.isEmpty) {
      borderBoxOptions.titles = [
        ...borderBoxOptions.titles!,
        { text: this.theme.fg("muted", "by calls"), align: "right" },
      ];

      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: cell.header("Command"), width: 20 },
              { header: cell.header("Share %"), width: "fill" },
              { header: cell.header("Calls"), width: 12 },
            ],
            rows: this.rows,
            maxHeight: this.tableHeight,
            sort: { column: 2, direction: "desc" },
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
