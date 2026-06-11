import { Container, matchesKey, type Component, Spacer } from "@earendil-works/pi-tui";
import { StatsSummary, StatsTheme } from "../types";
import { RangeSelector } from "./RangeSelector";
import { TabBar } from "./TabBar";
import { Header } from "./Header";
import { Overview } from "../tabs/Overview";
import { Languages } from "../tabs/Languages";
import { Models } from "../tabs/Models";
import { ColorPalette, langPalette, modelPalette } from "../colorPalette.js";
import { Projects } from "../tabs/Projects";
import { Usage } from "../tabs/Usage";


/**
 * Renders a single pre-formatted line. Does no padding or wrapping —
 * the caller is responsible for fitting the content to width.
 * Used instead of pi-tui's Text component for theme-styled content
 * because Text.width() does not understand mock theme tags used in tests.
 */
class RawLine implements Component {
  constructor(private content: string) {}
  render(_width: number): string[] {
    return [this.content];
  }
  invalidate(): void {}
}

export class Dashboard extends Container {
  /** Rows consumed by header, spacers, dividers, tab bar, and footer (non-content chrome). */
  private static readonly CHROME_ROWS = 8;

  private tabBar: TabBar;
  private header: Header;
  private rangeSelector: RangeSelector;
  private summaries: StatsSummary[];
  private onClose: (() => void) | null = null;
  private tabs: Component[] = [];
  private rangeLabels: string[];
  private theme: StatsTheme;
  private terminalRows: number;
  private langPalette: ColorPalette;
  private modelPalette: ColorPalette;

  private updateLabel: string | null;

  constructor(
    summaries: StatsSummary[],
    theme: StatsTheme,
    terminalRows: number,
    updateLabel: string | null,
    onClose?: () => void,
  ) {
    super();
    this.summaries = summaries;
    this.theme = theme;
    this.terminalRows = terminalRows;
    this.updateLabel = updateLabel;
    this.onClose = onClose ?? null;
    this.langPalette = langPalette;
    this.modelPalette = modelPalette;
    this.tabBar = new TabBar(["Overview", "Languages", "Models", "Projects", "Usage"], theme, 0);
    this.rangeLabels = ["1d", "7d", "30d", "All"];
    this.rangeSelector = new RangeSelector(theme, this.rangeLabels, this.rangeLabels.length - 1);
    this.header = new Header(this.rangeSelector);
    this.buildTabs();
  }

  private get currentSummary(): StatsSummary {
    return (
      this.summaries[this.rangeSelector.selectedIndex] ?? this.summaries[this.summaries.length - 1]
    );
  }

  private buildTabs(): void {
    const contentHeight = Math.max(5, this.terminalRows - Dashboard.CHROME_ROWS);
    const summary = this.currentSummary;

    this.tabs = [
      new Overview(
        {
          totalCost: summary.totalCost,
          sessionCount: summary.sessionCount,
          totalMessages: summary.totalMessages,
          totalTokens: summary.totalTokens,
          daysActive: summary.daysActive,
          avgCostPerDay: summary.avgCostPerDay,
        },
        summary.dailySpend,
        this.rangeLabels[this.rangeSelector.selectedIndex],
        this.theme,
        contentHeight,
      ),
      new Languages(summary.languages, this.theme, this.langPalette),
      new Models(summary.models, this.theme, this.modelPalette),
      new Projects(summary.projects, this.theme),
      new Usage(
        summary.tools,
        {
          total: summary.totalTokens,
          input: summary.totalInputTokens,
          output: summary.totalOutputTokens,
          cacheRead: summary.totalCacheReadTokens,
          cacheWrite: summary.totalCacheWriteTokens,
        },
        this.theme,
      ),
    ];
  }

  render(width: number): string[] {
    this.clear();
    this.addChild(this.header);
    this.addChild(new Spacer(1));

    this.addChild(this.tabBar);
    this.addChild(new RawLine(this.theme.fg("borderMuted", "─".repeat(Math.max(width, 60)))));

    const allEmpty = this.summaries.every((s) => s.sessionCount === 0);

    if (allEmpty) {
      this.addChild(new Spacer(1));
      this.addChild(
        new RawLine(this.theme.fg("muted", "  No sessions found in ~/.pi/agent/sessions")),
      );
      this.addChild(new Spacer(1));
    } else if (this.currentSummary.sessionCount === 0) {
      this.addChild(new Spacer(1));
      this.addChild(new RawLine(this.theme.fg("muted", "  No data for this time range")));
      this.addChild(new Spacer(1));
    } else {
      const activeTab = this.tabs[this.tabBar.activeIndex];
      if (activeTab) {
        this.addChild(activeTab);
      }
    }

    this.addChild(new RawLine(this.theme.fg("borderMuted", "─".repeat(Math.max(width, 60)))));
    const updateText = this.updateLabel
      ? this.theme.fg("dim", this.updateLabel)
      : "";
    const controls = this.theme.fg("dim", "Esc/q close  ←→ tabs  r range  ↑↓ scroll  Enter select");
    this.addChild(new RawLine(`${updateText}${updateText ? "  ·  " : ""}${controls}`));

    return super.render(width);
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q" || data === "Q") {
      this.onClose?.();
      return;
    }

    // Tab bar input (left/right)
    if (matchesKey(data, "left") || matchesKey(data, "right")) {
      this.tabBar.handleInput(data);
      this.tabBar.invalidate();
      return;
    }

    // r key: cycle range with wrap-around
    if (data === "r") {
      this.rangeSelector.selectedIndex =
        (this.rangeSelector.selectedIndex + 1) % this.rangeLabels.length;
      this.buildTabs();
      this.invalidate();
      return;
    }

    // enter: consumed (no-op)
    if (matchesKey(data, "enter")) {
      return;
    }

    // up/down: dispatch to table tabs, consumed on Overview
    if (matchesKey(data, "up") || matchesKey(data, "down")) {
      const tabIndex = this.tabBar.activeIndex;
      if (tabIndex >= 1) {
        this.tabs[tabIndex]?.handleInput?.(data);
        this.tabs[tabIndex]?.invalidate?.();
      }
    }
  }

  invalidate(): void {
    this.tabBar.invalidate();
    this.rangeSelector.invalidate();
    this.header.invalidate();
    for (const tab of this.tabs) {
      tab.invalidate?.();
    }
  }
}
