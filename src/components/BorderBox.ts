import { Component } from "@earendil-works/pi-tui";

export interface BorderBoxOptions {
  child: Component;
  title?: string;
  footer?: string;
  rounded?: boolean;
}

/** Strip ANSI escapes and test theme tags to compute visible length. */
function visibleLen(s: string): number {
  return s
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/<[/]?(?:b|fg:[^>]+|bg:[^>]+)>/g, "")
    .length;
}

/** Pad a line to targetWidth, accounting for invisible tags. */
function padLine(line: string, targetWidth: number): string {
  const padNeeded = Math.max(0, targetWidth - visibleLen(line));
  return line + " ".repeat(padNeeded);
}

export class BorderBox implements Component {
  private cache: { lines: string[]; width: number } | null = null;
  private readonly child: Component;
  private readonly rounded: boolean;

  constructor(opts: BorderBoxOptions) {
    this.child = opts.child;
    this.rounded = opts.rounded !== false;
  }

  render(width: number): string[] {
    if (this.cache && this.cache.width === width) return this.cache.lines;

    const innerWidth = Math.max(1, width - 2);
    const childLines = this.child.render(innerWidth);

    const tl = this.rounded ? "╭" : "┌";
    const tr = this.rounded ? "╮" : "┐";
    const bl = this.rounded ? "╰" : "└";
    const br = this.rounded ? "╯" : "┘";

    const lines: string[] = [];

    // Top border
    lines.push(padLine(`${tl}${"─".repeat(innerWidth)}${tr}`, width));

    // Content lines
    for (const line of childLines) {
      const padNeeded = Math.max(0, innerWidth - visibleLen(line));
      const padded = line + " ".repeat(padNeeded);
      lines.push(padLine(`│${padded}│`, width));
    }

    // Bottom border
    lines.push(padLine(`${bl}${"─".repeat(innerWidth)}${br}`, width));

    this.cache = { lines, width };
    return lines;
  }

  handleInput(data: string): void {
    this.child.handleInput?.(data);
  }

  invalidate(): void {
    this.cache = null;
    this.child.invalidate();
  }
}
