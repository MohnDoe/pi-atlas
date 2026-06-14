import { matchesKey, type Component } from "@earendil-works/pi-tui";

/** Theme subset needed by TabBar — bg for active, fg for accent/muted. */
export interface TabBarTheme {
  bg: (color: "selectedBg", text: string) => string;
  fg: (color: "accent" | "muted", text: string) => string;
}

export class TabBar implements Component {
  private tabs: string[];
  private theme: TabBarTheme;
  activeIndex: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(tabs: string[], theme: TabBarTheme, activeIndex = 0) {
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

  handleInput(data: string): void {
    if (matchesKey(data, "left")) {
      if (this.activeIndex > 0) {
        this.activeIndex--;
        this.invalidate();
      }
      return;
    }
    if (matchesKey(data, "right")) {
      if (this.activeIndex < this.tabs.length - 1) {
        this.activeIndex++;
        this.invalidate();
      }
    }
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
