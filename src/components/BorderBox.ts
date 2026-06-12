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

/** Truncate a string to fit maxLen visible chars, appending "…" if needed. */
function truncate(s: string, maxLen: number): string {
  if (visibleLen(s) <= maxLen) return s;
  let result = s;
  while (visibleLen(result + "…") > maxLen && result.length > 0) {
    result = result.slice(0, -1);
  }
  return result + "…";
}

/** Pad a line to targetWidth, accounting for invisible tags. */
function padLine(line: string, targetWidth: number): string {
  const padNeeded = Math.max(0, targetWidth - visibleLen(line));
  return line + " ".repeat(padNeeded);
}

/** Build a border line with optional embedded text (title/footer). */
function borderLine(
  left: string,
  right: string,
  innerWidth: number,
  width: number,
  text?: string,
): string {
  if (!text) {
    return padLine(`${left}${"─".repeat(innerWidth)}${right}`, width);
  }

  const decor = `─ ${text} ─`;
  const decorLen = visibleLen(decor);
  const fill = Math.max(0, innerWidth - decorLen);

  const truncated = fill === 0 ? truncate(text, innerWidth - 4) : text;
  const finalDecor = `─ ${truncated} ─`;
  const finalFill = Math.max(0, innerWidth - visibleLen(finalDecor));

  return padLine(`${left}${finalDecor}${"─".repeat(finalFill)}${right}`, width);
}

export class BorderBox implements Component {
  private cache: { lines: string[]; width: number } | null = null;
  private readonly child: Component;
  private readonly rounded: boolean;
  private readonly title?: string;
  private readonly footer?: string;

  constructor(opts: BorderBoxOptions) {
    this.child = opts.child;
    this.rounded = opts.rounded !== false;
    this.title = opts.title;
    this.footer = opts.footer;
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

    // Top border (with optional title)
    lines.push(borderLine(tl, tr, innerWidth, width, this.title));

    // Content lines
    for (const line of childLines) {
      const padNeeded = Math.max(0, innerWidth - visibleLen(line));
      const padded = line + " ".repeat(padNeeded);
      lines.push(padLine(`│${padded}│`, width));
    }

    // Bottom border (with optional footer)
    lines.push(borderLine(bl, br, innerWidth, width, this.footer));

    this.cache = { lines, width };
    return lines;
  }

  handleInput(data: string): void {
    this.child.handleInput?.(data);
    this.invalidate();
  }

  invalidate(): void {
    this.cache = null;
    this.child.invalidate();
  }
}
