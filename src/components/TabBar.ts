import { matchesKey } from "@earendil-works/pi-tui";
import { StatsTheme } from "../types";

export class TabBar {
  private tabs: string[];
  private theme: StatsTheme;
  activeIndex: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(tabs: string[], theme: StatsTheme, activeIndex = 0) {
    this.tabs = tabs;
    this.theme = theme;
    this.activeIndex = activeIndex;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const parts: string[] = [];
    for (let i = 0; i < this.tabs.length; i++) {
      const label = this.tabs[i];
      if (i === this.activeIndex) {
        parts.push(this.theme.bg("selectedBg", this.theme.fg("accent", ` ${label} `)));
      } else {
        parts.push(this.theme.fg("muted", ` ${label} `));
      }
    }

    let line = parts.join(" ");
    const visLen = line.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
    if (visLen > width) line = line.slice(0, width);

    this.cachedLines = [line];
    this.cachedWidth = width;
    return this.cachedLines;
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "left")) {
      if (this.activeIndex > 0) {
        this.activeIndex--;
        this.invalidate();
      }
      return true;
    }
    if (matchesKey(data, "right")) {
      if (this.activeIndex < this.tabs.length - 1) {
        this.activeIndex++;
        this.invalidate();
      }
      return true;
    }
    return false;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
