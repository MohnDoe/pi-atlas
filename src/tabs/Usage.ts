import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Spacer, Text, type TUI } from "@earendil-works/pi-tui";
import { BorderBox } from "../components/BorderBox";
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
    const maxCount = Math.max(...this.tools.map((t) => t.count), 0);
    this.rows = this.tools.map((t) => {
      const barPct = maxCount > 0 ? (t.count / maxCount) * 100 : 0;
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
    this.addChild(
      new BorderBox(
        {
          title: title + " · " + subtitle,
          child: row,
          color: "border",
          paddingX: 1,
        },
        this.theme,
      ),
    );

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

  override invalidate(): void {
    super.invalidate();
    this.table?.invalidate();
  }
}
