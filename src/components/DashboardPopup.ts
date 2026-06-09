import { Dashboard } from "./Dashboard";

/**
 * Wraps Dashboard in a box-drawing border for popup/overlay display.
 * Renders content at width-2 to account for │ side borders.
 * All lines are padded to full width for solid-background effect.
 */
export class DashboardPopup {
  private dashboard: Dashboard;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(dashboard: Dashboard) {
    this.dashboard = dashboard;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const innerWidth = Math.max(1, width - 2);
    const innerLines = this.dashboard.render(innerWidth);

    const lines: string[] = [];

    // Top border
    lines.push(this.padLine(`╭${"─".repeat(innerWidth)}╮`, width));

    // Content lines with side borders
    for (const line of innerLines) {
      // Pad the inner line to fill innerWidth (solid background effect)
      const stripped = this.stripTags(line);
      const padNeeded = Math.max(0, innerWidth - stripped.length);
      const padded = line + " ".repeat(padNeeded);
      lines.push(this.padLine(`│${padded}│`, width));
    }

    // Bottom border
    lines.push(this.padLine(`╰${"─".repeat(innerWidth)}╯`, width));

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): boolean {
    return this.dashboard.handleInput(data);
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
    this.dashboard.invalidate();
  }

  private padLine(line: string, targetWidth: number): string {
    const stripped = this.stripTags(line);
    const padNeeded = Math.max(0, targetWidth - stripped.length);
    return line + " ".repeat(padNeeded);
  }

  private stripTags(s: string): string {
    return s.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[/]?(?:b|fg:[^>]+|bg:[^>]+)>/g, "");
  }
}
