import { matchesKey, type Component } from "@earendil-works/pi-tui";
import { formatCost, formatModelName, formatNumber } from "../parser";
import { ModelStat, StatsTheme } from "../types";
import { ColumnDef, RankedTable } from "../components/RankedTable";

const EMPTY_MESSAGE = "No model data for this time range";

export class Models implements Component {
  private table: RankedTable | null = null;
  private isEmpty: boolean;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;
  private theme: StatsTheme;

  constructor(models: ModelStat[], theme: StatsTheme, maxHeight: number) {
    this.theme = theme;
    this.isEmpty = models.length === 0;

    if (!this.isEmpty) {
      const columns: ColumnDef[] = [
        { header: "Model", width: 20 },
        { header: "Cost", width: 10 },
        { header: "Calls", width: 10 },
      ];
      const rows = models.map((m) => [
        formatModelName(m.model),
        formatCost(m.cost),
        formatNumber(m.calls),
      ]);
      this.table = new RankedTable(columns, rows, maxHeight, this.theme);
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (this.isEmpty) {
      const lines = [this.theme.fg("muted", "  " + EMPTY_MESSAGE)];
      this.cachedLines = lines;
      this.cachedWidth = width;
      return lines;
    }

    const lines = this.table!.render(width);
    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "up") || matchesKey(data, "down")) {
      this.table?.handleInput(data);
      this.invalidate();
    }
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
    this.table?.invalidate();
  }
}
