import { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { Component, visibleWidth } from "@earendil-works/pi-tui";
import { ChalkInstance } from "chalk";

export interface BorderBoxOptions {
  child: Component;
  title?: string;
  footer?: string;
  rounded?: boolean;
  color?: ThemeColor | ChalkInstance;
  paddingX?: number;
  paddingY?: number;
}

/** Truncate a string to fit maxLen visible chars, appending "…" if needed. */
function truncate(s: string, maxLen: number): string {
  if (visibleWidth(s) <= maxLen) return s;
  let result = s;
  while (visibleWidth(result + "…") > maxLen && result.length > 0) {
    result = result.slice(0, -1);
  }
  return result + "…";
}

function padLine(line: string, targetWidth: number): string {
  const padNeeded = Math.max(0, targetWidth - visibleWidth(line));
  return line + " ".repeat(padNeeded);
}

interface BorderLineOptions {
  left: string;
  right: string;
  innerWidth: number;
  width: number;
  borderColor?: (s: string) => string;
  text?: string;
}
/** Build a border line with optional embedded text (title/footer). */
function borderLine(opts: BorderLineOptions): string {
  if (opts.borderColor !== undefined) {
    opts.left = opts.borderColor(opts.left);
    opts.right = opts.borderColor(opts.right);
  }
  const border = opts.borderColor !== undefined ? opts.borderColor("─") : "─";
  if (!opts.text) {
    return padLine(`${opts.left}${border.repeat(opts.innerWidth)}${opts.right}`, opts.width);
  }

  const decor = `${border} ${opts.text} ${border}`;
  const decorLen = visibleWidth(decor);
  const fill = Math.max(0, opts.innerWidth - decorLen);

  const truncated = fill === 0 ? truncate(opts.text, opts.innerWidth - 4) : opts.text;
  const finalDecor = `${border} ${truncated} ${border}`;
  const finalFill = Math.max(0, opts.innerWidth - visibleWidth(finalDecor));

  return padLine(`${opts.left}${finalDecor}${border.repeat(finalFill)}${opts.right}`, opts.width);
}

export class BorderBox implements Component {
  private cache: { lines: string[]; width: number } | null = null;
  private readonly child: Component;
  private readonly rounded: boolean;
  private readonly title?: string;
  private readonly footer?: string;
  private readonly color: ThemeColor | ChalkInstance = "border";
  private readonly paddingX: number = 0;
  private readonly paddingY: number = 0;

  constructor(
    opts: BorderBoxOptions,
    private theme: Theme,
  ) {
    this.child = opts.child;
    this.rounded = opts.rounded !== false;
    this.title = opts.title;
    this.footer = opts.footer;
    this.color = opts.color || this.color;
    this.paddingX = opts.paddingX ?? 0;
    this.paddingY = opts.paddingY ?? 0;
  }

  render(width: number): string[] {
    if (this.cache && this.cache.width === width) return this.cache.lines;

    const innerWidth = Math.max(1, width - 2);
    const childInnerWidth = Math.max(1, innerWidth - 2 * this.paddingX);
    const childLines = this.child.render(childInnerWidth);

    const tl = this.rounded ? "╭" : "┌";
    const tr = this.rounded ? "╮" : "┐";
    const bl = this.rounded ? "╰" : "└";
    const br = this.rounded ? "╯" : "┘";
    const l = "│";
    const r = "│";

    const lines: string[] = [];
    const borderColor =
      typeof this.color === "string"
        ? (s: string) => this.theme.fg(this.color as ThemeColor, s)
        : this.color;

    // Top border (with optional title)
    lines.push(
      borderLine({
        left: tl,
        right: tr,
        innerWidth,
        width,
        borderColor,
        text: this.title,
      }),
    );

    // Shared helper for bordered lines (blank or content)
    const borderedLine = (inner: string): string => {
      return padLine(borderColor(l) + inner + borderColor(r), width);
    };

    // Y-padding blank line (uniform fill)
    const blankInner = " ".repeat(innerWidth);

    // PaddingY top (only when child has content)
    if (this.paddingY > 0 && childLines.length > 0) {
      for (let i = 0; i < this.paddingY; i++) {
        lines.push(borderedLine(blankInner));
      }
    }

    // Content lines
    for (const line of childLines) {
      const childPad = Math.max(0, childInnerWidth - visibleWidth(line));
      const padded = " ".repeat(this.paddingX) + line + " ".repeat(childPad + this.paddingX);
      lines.push(borderedLine(padded));
    }

    // PaddingY bottom (only when child has content)
    if (this.paddingY > 0 && childLines.length > 0) {
      for (let i = 0; i < this.paddingY; i++) {
        lines.push(borderedLine(blankInner));
      }
    }

    // Bottom border (with optional footer)
    lines.push(
      borderLine({
        left: bl,
        right: br,
        innerWidth,
        width,
        borderColor,
        text: this.footer,
      }),
    );

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
