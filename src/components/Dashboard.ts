import {
  Container,
  matchesKey,
  type Component,
  type TUI,
  Spacer,
  Text,
} from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { StatsSummary } from "../types";
import { RangeSelector } from "./RangeSelector";
import { TabBar } from "./TabBar";
import { Header } from "./Header";
import { Overview } from "../tabs/Overview";
import { Languages } from "../tabs/Languages";
import { Models } from "../tabs/Models";
import { ColorPalette, langPalette, modelPalette } from "../colorPalette.js";
import { Projects } from "../tabs/Projects";
import { Usage } from "../tabs/Usage";

export class Dashboard extends Container {
  /** Rows consumed by header, spacers, dividers, tab bar, and footer (non-content chrome). */
  private static readonly CHROME_ROWS = 8;

  private tabBar: TabBar;
  private header: Header;
  private rangeSelector: RangeSelector;
  private onClose: (() => void) | null = null;
  private tabs: Component[] = [];
  private rangeLabels: string[];
  private langPalette: ColorPalette;
  private modelPalette: ColorPalette;
  private contentHeight = 0;

  constructor(
    private summaries: StatsSummary[],
    private theme: Theme,
    private usePopup: boolean,
    private updateLabel: string | null,
    private tui: TUI,
    onClose?: () => void,
  ) {
    super();
    this.onClose = onClose ?? null;
    this.langPalette = langPalette;
    this.modelPalette = modelPalette;
    this.tabBar = new TabBar(["Overview", "Languages", "Models", "Projects", "Usage"], theme, 0);
    this.rangeLabels = ["Today", "Last 7 days", "Last 30 days", "All time"];
    this.rangeSelector = new RangeSelector(theme, this.rangeLabels, this.rangeLabels.length - 1);
    this.header = new Header(this.theme, this.rangeSelector);
    this.contentHeight = this.computeContentHeight();
    this.buildTabs();
  }

  /** Compute the available content height from current terminal dimensions. */
  private computeContentHeight(): number {
    const termHeight = this.tui.terminal.rows;
    const dashRows = this.usePopup
      ? Math.floor(termHeight * 0.8) - 2
      : termHeight;
    return Math.max(5, dashRows - Dashboard.CHROME_ROWS);
  }

  private get currentSummary(): StatsSummary {
    return (
      this.summaries[this.rangeSelector.selectedIndex] ?? this.summaries[this.summaries.length - 1]
    );
  }

  private buildTabs(): void {
    const contentHeight = this.contentHeight;
    const summary = this.currentSummary;

    // Invalidate old tabs — cleans up marquee timers, caches, etc.
    for (const tab of this.tabs) {
      tab.invalidate?.();
    }

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
      new Languages(summary.languages, this.theme, this.langPalette, this.tui, contentHeight),
      new Models(summary.models, this.theme, this.modelPalette, this.tui, contentHeight),
      new Projects(summary.projects, this.theme, this.tui, contentHeight),
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
        this.tui,
        contentHeight,
      ),
    ];
  }

  render(width: number): string[] {
    this.clear();
    this.addChild(this.header);
    this.addChild(new Spacer(1));

    this.addChild(this.tabBar);
    this.addChild(new Text(this.theme.fg("borderMuted", "─".repeat(Math.max(width, 60))), 0, 0));

    const allEmpty = this.summaries.every((s) => s.sessionCount === 0);

    if (allEmpty) {
      this.addChild(new Spacer(1));
      this.addChild(
        new Text(this.theme.fg("muted", "  No sessions found in ~/.pi/agent/sessions"), 0, 0),
      );
      this.addChild(new Spacer(1));
    } else if (this.currentSummary.sessionCount === 0) {
      this.addChild(new Spacer(1));
      this.addChild(new Text(this.theme.fg("muted", "  No data for this time range"), 0, 0));
      this.addChild(new Spacer(1));
    } else {
      const activeTab = this.tabs[this.tabBar.activeIndex];
      if (activeTab) {
        this.addChild(activeTab);
      }
    }

    this.addChild(new Text(this.theme.fg("borderMuted", "─".repeat(Math.max(width, 60))), 0, 0));
    const updateText = this.updateLabel ? this.theme.fg("dim", this.updateLabel) : "";
    const controls = this.theme.fg("dim", "Esc/q close  ←→ tabs  r range  ↑↓ scroll  Enter select");
    this.addChild(new Text(`${updateText}${updateText ? "  ·  " : ""}${controls}`, 0, 0));

    // Recompute content height — rebuild tabs if terminal was resized
    const newContentHeight = this.computeContentHeight();
    if (newContentHeight !== this.contentHeight) {
      this.contentHeight = newContentHeight;
      this.buildTabs();
    }

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
