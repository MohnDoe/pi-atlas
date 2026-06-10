import { matchesKey, type Component } from "@earendil-works/pi-tui";
import { StatsTheme } from "../types";

export class RangeSelector implements Component {
  private ranges: string[];
  private theme: StatsTheme;
  selectedIndex: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(theme: StatsTheme, ranges: string[] = ["1d", "7d", "30d", "All"], selectedIndex = 0) {
    this.theme = theme;
    this.ranges = ranges;
    this.selectedIndex = selectedIndex;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const parts: string[] = [];
    for (let i = 0; i < this.ranges.length; i++) {
      const label = this.ranges[i];
      if (i === this.selectedIndex) {
        parts.push(this.theme.bg("selectedBg", this.theme.fg("accent", `[${label}]`)));
      } else {
        parts.push(this.theme.fg("muted", `${label}`));
      }
    }

    this.cachedLines = [parts.join(" ")];
    this.cachedWidth = width;
    return this.cachedLines;
  }

  handleInput(data: string): void {
    // enter is a no-op (selection is consumed) but must not propagate farther
    if (matchesKey(data, "enter")) return;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
