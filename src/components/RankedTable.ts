import { matchesKey } from "@earendil-works/pi-tui";
import { StatsTheme } from "../types";

export interface ColumnDef {
  header: string;
  width: number;
}

export class RankedTable {
  private columns: ColumnDef[];
  private rows: string[][];
  private maxHeight: number;
  private theme: StatsTheme;
  private scrollOffset = 0;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(columns: ColumnDef[], rows: string[][], maxHeight: number, theme: StatsTheme) {
    this.columns = columns;
    this.rows = rows;
    this.maxHeight = maxHeight;
    this.theme = theme;
  }

  private get visibleRows(): number {
    return Math.max(1, this.maxHeight - 1); // 1 row for header
  }

  private get maxScroll(): number {
    return Math.max(0, this.rows.length - this.visibleRows);
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const lines: string[] = [];
    const rankColW = 4;
    const gap = " ";

    // Clamp scroll offset
    if (this.scrollOffset > this.maxScroll) this.scrollOffset = this.maxScroll;
    if (this.scrollOffset < 0) this.scrollOffset = 0;

    // Header row
    let header = "#".padEnd(rankColW) + gap;
    for (const col of this.columns) {
      header += col.header.slice(0, col.width).padEnd(col.width) + gap;
    }
    header = header.trimEnd();
    const visLen = header.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
    if (visLen > width) header = header.slice(0, width);
    lines.push(this.theme.bg("selectedBg", this.theme.bold(this.theme.fg("accent", header))));

    // Data rows
    const end = Math.min(this.scrollOffset + this.visibleRows, this.rows.length);
    for (let i = this.scrollOffset; i < end; i++) {
      const rank = String(i + 1);
      let row = rank.padStart(rankColW - 1) + " " + gap;
      const data = this.rows[i];
      for (let j = 0; j < this.columns.length; j++) {
        const val = (data[j] ?? "").slice(0, this.columns[j].width);
        row += val.padEnd(this.columns[j].width) + gap;
      }
      row = row.trimEnd();
      const rowVisLen = row.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
      if (rowVisLen > width) row = row.slice(0, width);
      lines.push(row);
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "up")) {
      if (this.scrollOffset > 0) {
        this.scrollOffset--;
        this.invalidate();
      }
      return true;
    }
    if (matchesKey(data, "down")) {
      if (this.scrollOffset < this.maxScroll) {
        this.scrollOffset++;
        this.invalidate();
      }
      return true;
    }
    return false;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
