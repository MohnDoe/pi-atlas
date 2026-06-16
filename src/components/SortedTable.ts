import { matchesKey, type Component, type TUI } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { MarqueeText } from "./MarqueeText.js";

export interface ColumnDef {
  header: string;
  width: number | string;
  marquee?: boolean;
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
  rows: string[][];
  maxHeight: number;
  sort?: SortConfig;
  cursor?: CursorOptions;
  /** TUI reference for driving marquee animation. MarqueeText instances call
   *  tui.requestRender() to advance their animation. */
  tui: TUI;
}

export class SortedTable implements Component {
  static readonly DEFAULT_CURSOR_CHAR = "▶";
  static readonly CURSOR_SUFFIX = " ";
  private columns: ColumnDef[];
  private rows: string[][];
  private maxHeight: number;
  private theme: Theme;
  private sort?: SortConfig;
  private scrollOffset = 0;
  private focusedRow = -1;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;
  private cursorPrefix: string;
  private padPrefix: string;
  private tui: TUI;
  private marqueeCells: Map<string, MarqueeText> = new Map();

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
      const w = this.columns[i].width;
      if (typeof w === "number") {
        resolved[i] = w;
        fixedUsed += w;
      }
    }

    // Pass 2: percentage widths
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
    const colWidths = this.resolveWidths(width);

    // Bypass cache when focused row has active marquee columns
    const hasMarquee =
      this.focusedRow >= 0 &&
      this.columns.some(
        (col, j) => col.marquee && (this.rows[this.focusedRow]?.[j]?.length ?? 0) > colWidths[j],
      );

    if (hasMarquee) {
      this.cachedLines = null;
      this.cachedWidth = -1;
    }

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
      const cw = colWidths[i];
      let headerText = col.header;
      if (this.sort && this.sort.column === i) {
        const indicator = this.sort.direction === "asc" ? " ▲" : " ▼";
        const maxHeaderLen = cw - indicator.length;
        headerText = headerText.slice(0, maxHeaderLen) + indicator;
      }
      header += headerText.slice(0, cw).padEnd(cw) + gap;
    }
    header = this.padPrefix + header.trimEnd();
    header = this.padToWidth(header, width);
    lines.push(this.theme.bold(this.theme.fg("accent", header)));

    // Data rows
    const end = Math.min(this.scrollOffset + this.visibleRows, this.rows.length);
    for (let i = this.scrollOffset; i < end; i++) {
      let row = "";
      const data = this.rows[i];
      for (let j = 0; j < this.columns.length; j++) {
        const raw = data[j] ?? "";
        let val: string;
        if (i === this.focusedRow && this.columns[j].marquee && raw.length > colWidths[j]) {
          val = this.marqueeText(i, j, raw, colWidths[j]);
        } else if (this.columns[j].marquee && raw.length > colWidths[j]) {
          // Unfocused marquee column — truncated with ellipsis
          val = raw.slice(0, Math.max(0, colWidths[j] - 1)) + "…";
        } else {
          val = raw.slice(0, colWidths[j]);
        }
        row += val.padEnd(colWidths[j]) + gap;
      }
      row = row.trimEnd();
      const prefix = i === this.focusedRow ? this.cursorPrefix : this.padPrefix;
      row = this.padToWidth(row, width - prefix.length);
      row = prefix + row;
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
        this.cleanupMarquee();
        this.followFocus();
        this.invalidate();
      }
      return;
    }
    if (matchesKey(data, "down")) {
      if (this.focusedRow < this.rows.length - 1) {
        this.focusedRow++;
        this.cleanupMarquee();
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

  private marqueeText(row: number, col: number, text: string, width: number): string {
    const key = `${row}-${col}`;
    let mt = this.marqueeCells.get(key);
    if (!mt) {
      mt = new MarqueeText(text, this.tui);
      this.marqueeCells.set(key, mt);
    }
    return mt.render(width)[0];
  }

  private cleanupMarquee(): void {
    this.marqueeCells.forEach((mt) => mt.destroy());
    this.marqueeCells.clear();
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
    this.cleanupMarquee();
  }
}
