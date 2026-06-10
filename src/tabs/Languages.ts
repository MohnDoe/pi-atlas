import { type Component } from "@earendil-works/pi-tui";
import { LangStat, StatsTheme } from "../types";
import { formatNumber } from "../parser";
import { RankedTable } from "../components/RankedTable";

export class Languages implements Component {
  private theme: StatsTheme;
  private maxHeight: number;
  private table: RankedTable | null = null;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(languages: LangStat[], theme: StatsTheme, maxHeight: number) {
    this.theme = theme;
    this.maxHeight = maxHeight;

    if (languages.length > 0) {
      const columns = [
        { header: "Language", width: 20 },
        { header: "Lines", width: 10 },
        { header: "Edits", width: 10 },
      ];
      const rows = languages.map((l) => [l.language, formatNumber(l.lines), formatNumber(l.edits)]);
      this.table = new RankedTable(columns, rows, this.maxHeight, this.theme);
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (this.table) {
      this.cachedLines = this.table.render(width);
    } else {
      this.cachedLines = [this.theme.fg("muted", "No language data for this time range")];
    }
    this.cachedWidth = width;
    return this.cachedLines;
  }

  handleInput(data: string): void {
    if (this.table) {
      this.table.handleInput(data);
      this.invalidate();
    }
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
    if (this.table) this.table.invalidate();
  }
}
