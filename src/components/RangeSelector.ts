import { matchesKey, type Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";

export interface RangeOption {
  label: string;
  value: string;
}

export class RangeSelector implements Component {
  selectedIndex: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    private theme: Theme,
    private ranges: RangeOption[] = [
      { label: "Today", value: "1d" },
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "All time", value: "All" },
    ],
    selectedIndex = 0,
  ) {
    this.selectedIndex = selectedIndex;
  }

  get selectedValue(): string {
    return this.ranges[this.selectedIndex].value;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    this.cachedLines = [this.theme.fg("accent", this.ranges[this.selectedIndex].label)];
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
