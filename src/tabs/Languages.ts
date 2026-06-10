import { type Component } from "@earendil-works/pi-tui";
import { LangStat, StatsTheme } from "../types";
import { formatNumber } from "../parser";
import { RankedTable } from "../components/RankedTable";

export class Languages implements Component {
  private theme: StatsTheme;
  private maxHeight: number;
  private table: RankedTable | null = null;

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
    if (this.table) return this.table.render(width);
    return [this.theme.fg("muted", "No language data for this time range")];
  }

  handleInput(data: string): void {
    if (this.table) this.table.handleInput(data);
  }

  invalidate(): void {
    if (this.table) this.table.invalidate();
  }
}
