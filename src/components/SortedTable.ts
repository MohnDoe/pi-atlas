import { matchesKey, type Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";

export interface ColumnDef {
  header: string;
  width: number;
}

export interface SortConfig {
  column: number;
  direction: "asc" | "desc";
}

export class SortedTable implements Component {
  private columns: ColumnDef[];
  private rows: string[][];
  private maxHeight: number;
  private theme: Theme;
  private sort?: SortConfig;
  private scrollOffset = 0;
  private focusedRow = -1;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(columns: ColumnDef[], rows: string[][], maxHeight: number, theme: Theme, sort?: SortConfig) {
    this.columns = columns;
    this.rows = rows;
    this.maxHeight = maxHeight;
    this.theme = theme;
    this.sort = sort;
    this.focusedRow = this.rows.length > 0 ? 0 : -1;
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
    const gap = " ";

    // Clamp scroll offset
    if (this.scrollOffset > this.maxScroll) this.scrollOffset = this.maxScroll;
    if (this.scrollOffset < 0) this.scrollOffset = 0;

    // Header row
    let header = "";
    for (let i = 0; i < this.columns.length; i++) {
      const col = this.columns[i];
      let headerText = col.header;
      if (this.sort && this.sort.column === i) {
        const indicator = this.sort.direction === "asc" ? " ▲" : " ▼";
        const maxHeaderLen = col.width - indicator.length;
        headerText = headerText.slice(0, maxHeaderLen) + indicator;
      }
      header += headerText.slice(0, col.width).padEnd(col.width) + gap;
    }
    header = "  " + header.trimEnd();
    const visLen = header.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
    if (visLen > width) header = header.slice(0, width);
    lines.push(this.theme.bold(this.theme.fg("accent", header)));

    // Data rows
    const end = Math.min(this.scrollOffset + this.visibleRows, this.rows.length);
    for (let i = this.scrollOffset; i < end; i++) {
      let row = "";
      const data = this.rows[i];
      for (let j = 0; j < this.columns.length; j++) {
        const val = (data[j] ?? "").slice(0, this.columns[j].width);
        row += val.padEnd(this.columns[j].width) + gap;
      }
      row = row.trimEnd();
      const cursor = i === this.focusedRow ? "▶ " : "  ";
      row = cursor + row;
      const rowVisLen = row.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
      if (rowVisLen > width) row = row.slice(0, width);
      if (i === this.focusedRow) {
        row = this.theme.bg("selectedBg", row);
      }
      lines.push(row);
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "up")) {
      if (this.focusedRow > 0) {
        this.focusedRow--;
        this.followFocus();
        this.invalidate();
      }
      return;
    }
    if (matchesKey(data, "down")) {
      if (this.focusedRow < this.rows.length - 1) {
        this.focusedRow++;
        this.followFocus();
        this.invalidate();
      }
    }
  }

  private followFocus(): void {
    if (this.focusedRow < this.scrollOffset) {
      this.scrollOffset = this.focusedRow;
    } else if (this.focusedRow >= this.scrollOffset + this.visibleRows) {
      this.scrollOffset = this.focusedRow - this.visibleRows + 1;
    }
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
