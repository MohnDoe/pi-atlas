import type { Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, type Component, type TUI } from "@earendil-works/pi-tui";
import type { CellComponent } from "./cells";

export interface ColumnDef {
  header: CellComponent;
  width: number | string;
}

export interface SortConfig {
  column: number;
  direction: "asc" | "desc";
}

export interface CursorOptions {
  enabled?: boolean;
  char?: string;
}

export interface SortedTableConfig {
  columns: ColumnDef[];
  rows: CellComponent[][];
  maxHeight: number;
  sort?: SortConfig;
  cursor?: CursorOptions;
  /** TUI reference — passed through to cells that need it (e.g. marquee cells). */
  tui: TUI;
}

export class SortedTable implements Component {
  static readonly DEFAULT_CURSOR_CHAR = "▌";
  static readonly CURSOR_SUFFIX = " ";
  private columns: ColumnDef[];
  private rows: CellComponent[][];
  private maxHeight: number;
  private theme: Theme;
  private sort?: SortConfig;
  private scrollOffset = 0;
  private focusedRow = -1;
  private cursorPrefix: string;
  private padPrefix: string;
  private tui: TUI;

  constructor(config: SortedTableConfig, theme: Theme) {
    const fillCount = config.columns.filter((c) => c.width === "fill").length;
    if (fillCount > 1) throw new Error("Cannot have more than one fill column");

    for (const col of config.columns) {
      const w = col.width;
      if (typeof w === "string" && w !== "fill" && !/^\d+%$/.test(w)) {
        throw new Error(`Invalid column width: "${w}"`);
      }
    }

    this.columns = config.columns;
    this.rows = config.rows;
    this.maxHeight = config.maxHeight;
    this.theme = theme;
    this.sort = config.sort;
    this.focusedRow = this.rows.length > 0 ? 0 : -1;

    this.tui = config.tui;

    const cursorOpts = config.cursor;
    const cursorEnabled = cursorOpts?.enabled ?? true;
    const cursorChar = cursorOpts?.char ?? SortedTable.DEFAULT_CURSOR_CHAR;
    this.cursorPrefix = cursorEnabled ? cursorChar + SortedTable.CURSOR_SUFFIX : "";
    this.padPrefix = cursorEnabled ? " ".repeat(this.cursorPrefix.length) : "";
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
    const fillIdx = this.columns.findIndex((c) => c.width === "fill");

    // Pass 1: fixed widths
    for (let i = 0; i < this.columns.length; i++) {
      const w = this.columns[i]!.width;
      if (typeof w === "number") {
        resolved[i] = w;
        fixedUsed += w;
      }
    }

    // Pass 2: percentage widths
    for (let i = 0; i < this.columns.length; i++) {
      if (resolved[i] >= 0) continue;
      const w = this.columns[i]!.width;
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

    // Pass 4: overflow — if total > contentWidth, shrink non-fill proportionally
    const totalAllocated = resolved.reduce((sum, w) => sum + w, 0);
    if (totalAllocated > contentWidth) {
      const scale = contentWidth / totalAllocated;
      let nonFillSum = 0;
      for (let i = 0; i < resolved.length; i++) {
        if (i === fillIdx) continue;
        resolved[i] = Math.max(1, Math.floor(resolved[i] * scale));
        nonFillSum += resolved[i];
      }
      if (fillIdx >= 0) {
        resolved[fillIdx] = Math.max(1, contentWidth - nonFillSum);
      }
    }

    return resolved;
  }

  private padToWidth(line: string, width: number): string {
    return truncateToWidth(line, width, "", true);
  }

  render(width: number): string[] {
    const colWidths = this.resolveWidths(width);

    const lines: string[] = [];
    const gap = " ";

    // Clamp scroll offset
    if (this.scrollOffset > this.maxScroll) this.scrollOffset = this.maxScroll;
    if (this.scrollOffset < 0) this.scrollOffset = 0;

    // Header row
    let header = "";
    for (let i = 0; i < this.columns.length; i++) {
      const cw = colWidths[i] ?? width;
      const sortDirection = this.sort?.column === i ? this.sort.direction : null;
      const headerText = this.columns[i]!.header.render(cw, { sortDirection });
      header += truncateToWidth(headerText, cw, "", true) + gap;
    }
    header = this.padPrefix + header.trimEnd();
    header = this.padToWidth(header, width);
    lines.push(this.theme.bold(this.theme.fg("accent", header)));

    // Data rows
    const end = Math.min(this.scrollOffset + this.visibleRows, this.rows.length);
    for (let i = this.scrollOffset; i < end; i++) {
      let row = "";
      const dataRow = this.rows[i]!;
      for (let j = 0; j < this.columns.length; j++) {
        const c = dataRow[j];
        if (!c) continue;
        const cw = colWidths[j] ?? width;
        const val = c.render(cw, { isFocused: i === this.focusedRow });
        row += truncateToWidth(val, cw, "", true);
        if (j < this.columns.length - 1) row += gap;
      }
      const prefix = i === this.focusedRow ? this.cursorPrefix : this.padPrefix;
      row = this.padToWidth(row, width - prefix.length);
      row = prefix + row;
      if (i === this.focusedRow) {
        row = this.theme.bg("selectedBg", row);
      }
      lines.push(row);
    }

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
    // Propagate to all header cells
    for (const col of this.columns) {
      col.header.invalidate();
    }
    // Propagate to all data cells
    for (const row of this.rows) {
      for (const c of row) {
        c.invalidate();
      }
    }
  }
}
