import { matchesKey, type Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";

export class RangeSelector implements Component {
  selectedIndex: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    private theme: Theme,
    private ranges: string[] = ["Today", "Last 7 days", "Last 30 days", "All time"],
    selectedIndex = 0,
  ) {
    this.selectedIndex = selectedIndex;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    this.cachedLines = [this.theme.fg("accent", this.ranges[this.selectedIndex])];
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
