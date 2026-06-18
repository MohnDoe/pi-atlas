import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text, type TUI, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { cell, type CellComponent } from "../components/cells.js";
import { SortedTable } from "../components/SortedTable.js";
import { GridRow } from "../components/shared/GridRow.js";
import { StatCard } from "../components/StatCard.js";
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
    const maxCount = Math.max(...this.tools.map((t) => t.count), 0);
    this.rows = this.tools.map((t) => {
      const barPct = maxCount > 0 ? (t.count / maxCount) * 100 : 0;
      return [
        cell.marquee(stripAnsi(t.tool).slice(0, TOOL_NAME_MAX_LENGTH), this.tui),
        cell.bar(barPct, (s) => this.theme.fg("text", s), "transparent"),
        cell.text(this.theme.bold(formatNumber(t.count))),
      ];
    });
  }

  render(width: number): string[] {
    this.clear();

    // Token section: title + stat cards
    const title = this.theme.bold("Tokens");
    const subtitle = this.theme.fg("muted", formatNumber(this.tokenUsage.total));
    const gap = " ".repeat(Math.max(0, width - visibleWidth(title) - visibleWidth(subtitle)));
    this.addChild(new Text(title + gap + subtitle, 0, 0));

    const row = new GridRow(
      [
        new StatCard("Input", formatNumber(this.tokenUsage.input), this.theme, "accent"),
        new StatCard("Output", formatNumber(this.tokenUsage.output), this.theme, "accent"),
        new StatCard("Cache Read", formatNumber(this.tokenUsage.cacheRead), this.theme, "accent"),
        new StatCard("Cache Write", formatNumber(this.tokenUsage.cacheWrite), this.theme, "accent"),
      ],
      [25, 25, 25, 25],
    );
    this.addChild(row);

    // Tool table section
    if (!this.isEmpty) {
      this.addChild(new Spacer(1));

      if (!this.table) {
        this.table = new SortedTable(
          {
            columns: [
              { header: cell.header("Tool"), width: 20 },
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
