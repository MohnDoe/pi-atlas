import { matchesKey, type Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";

export interface ColumnDef {
  header: string;
  width: number | string;
}

export class SortedTable implements Component {
  private columns: ColumnDef[];
  private rows: string[][];
  private maxHeight: number;
  private theme: Theme;
  private scrollOffset = 0;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(columns: ColumnDef[], rows: string[][], maxHeight: number, theme: Theme) {
    const fillCount = columns.filter(c => c.width === "fill").length;
    if (fillCount > 1) throw new Error("Cannot have more than one fill column");

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

  private resolveWidths(width: number): number[] {
    const gapCount = this.columns.length - 1;
    const contentWidth = Math.max(0, width - gapCount);

    const resolved = new Array(this.columns.length).fill(-1);
    let fixedUsed = 0;
    let pctUsed = 0;
    const fillIdx = this.columns.findIndex(c => c.width === "fill");

    // Pass 1: fixed widths
    for (let i = 0; i < this.columns.length; i++) {
      const w = this.columns[i].width;
      if (typeof w === "number") {
        resolved[i] = w;
        fixedUsed += w;
      }
    }

    // Pass 2: percentage widths (from remaining after fixed)
    const afterFixed = Math.max(0, contentWidth - fixedUsed);
    for (let i = 0; i < this.columns.length; i++) {
      if (resolved[i] >= 0) continue;
      const w = this.columns[i].width;
      if (typeof w === "string" && /^\d+%$/.test(w)) {
        const pct = parseInt(w) / 100;
        resolved[i] = Math.floor(contentWidth * pct);
        pctUsed += resolved[i];
      }
    }

    // Pass 3: fill column gets remainder
    if (fillIdx >= 0) {
      const remaining = contentWidth - fixedUsed - pctUsed;
      resolved[fillIdx] = Math.max(1, remaining);
    }

    return resolved;
  }

  private padToWidth(line: string, width: number): string {
    const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
    if (visLen > width) return line.slice(0, width);
    return line + " ".repeat(width - visLen);
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const colWidths = this.resolveWidths(width);
    const lines: string[] = [];
    const gap = " ";

    // Clamp scroll offset
    if (this.scrollOffset > this.maxScroll) this.scrollOffset = this.maxScroll;
    if (this.scrollOffset < 0) this.scrollOffset = 0;

    // Header row
    let header = "";
    for (let i = 0; i < this.columns.length; i++) {
      header += this.columns[i].header.slice(0, colWidths[i]).padEnd(colWidths[i]) + gap;
    }
    header = header.trimEnd();
    lines.push(this.theme.bold(this.theme.fg("accent", this.padToWidth(header, width))));

    // Data rows
    const end = Math.min(this.scrollOffset + this.visibleRows, this.rows.length);
    for (let i = this.scrollOffset; i < end; i++) {
      let row = "";
      const data = this.rows[i];
      for (let j = 0; j < this.columns.length; j++) {
        const val = (data[j] ?? "").slice(0, colWidths[j]);
        row += val.padEnd(colWidths[j]) + gap;
      }
      row = row.trimEnd();
      lines.push(this.padToWidth(row, width));
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): void {
    if (matchesKey(data, "up")) {
      if (this.scrollOffset > 0) {
        this.scrollOffset--;
        this.invalidate();
      }
      return;
    }
    if (matchesKey(data, "down")) {
      if (this.scrollOffset < this.maxScroll) {
        this.scrollOffset++;
        this.invalidate();
      }
    }
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
