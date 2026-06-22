import type { Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, Spacer, Text, type Component, type TUI } from "@earendil-works/pi-tui";
import { BorderBox } from "@mohndoe/pi-tui-extras";
import { ColorPalette, langPalette, modelPalette } from "../colorPalette";
import { Languages } from "../tabs/Languages";
import { Models } from "../tabs/Models";
import { Overview } from "../tabs/Overview";
import { Projects } from "../tabs/Projects";
import { Usage } from "../tabs/Usage";
import type { StatsSummary, TimeRange } from "../types";
import { Header } from "./Header";
import { RangeSelector, type RangeOption } from "./RangeSelector";
import { TabBar } from "./TabBar";

export class Dashboard extends BorderBox {
  /** Rows consumed by header, spacers, dividers, tab bar, and footer (non-content chrome). */
  private static readonly CHROME_ROWS = 8;

  private tabBar: TabBar;
  private header: Header;
  private rangeSelector: RangeSelector;
  private onClose: (() => void) | null = null;
  private tabs: Component[] = [];
  private rangeOptions: RangeOption[];
  private langPalette: ColorPalette;
  private modelPalette: ColorPalette;
  private contentHeight = 0;

  constructor(
    private summaries: Map<TimeRange, StatsSummary>,
    private theme: Theme,
    private tui: TUI,
    updateLabel: string | null,
    onClose?: () => void,
  ) {
    // BorderBox footer with update label (styled to match current DashboardPopup look)
    const footers = updateLabel
      ? [{ text: theme.fg("dim", theme.italic(updateLabel)), align: "right" as const }]
      : [];

    super({
      titles: [
        { text: theme.bold("Pi Atlas"), align: "left" as const },
        { text: theme.fg("muted", "v0.1"), align: "right" as const },
      ],
      footers,
      borderStyle: "singleRounded",
      borderFn: (s: string) => theme.fg("text", s),
      padding: { left: 1, right: 1 },
    });

    this.onClose = onClose ?? null;
    this.langPalette = langPalette;
    this.modelPalette = modelPalette;
    this.tabBar = new TabBar(["Overview", "Languages", "Models", "Projects", "Usage"], theme, 0);
    this.rangeOptions = [
      { label: "Today", value: "1d" },
      { label: "Last 7 days", value: "7d" },
      { label: "Last 30 days", value: "30d" },
      { label: "All time", value: "All" },
    ];
    this.rangeSelector = new RangeSelector(theme, this.rangeOptions, this.rangeOptions.length - 1);
    this.header = new Header(this.theme, this.rangeSelector);
    this.contentHeight = this.computeContentHeight();
    this.buildTabs();
  }

  /** Compute the available content height from current terminal dimensions.
   *  Total popup = 80% of terminal. Subtract chrome rows (inside border) and
   *  2 border lines (top + bottom from BorderBox). */
  private computeContentHeight(): number {
    const termHeight = this.tui.terminal.rows;
    const dashRows = Math.floor(termHeight * 0.8);
    return Math.max(5, dashRows - Dashboard.CHROME_ROWS - 2);
  }

  private get currentSummary(): StatsSummary {
    return this.summaries.get(this.rangeSelector.selectedValue) ?? this.summaries.get("All")!;
  }

  private buildTabs(): void {
    const contentHeight = this.contentHeight;
    const summary = this.currentSummary;
    const rangeKey = this.rangeSelector.selectedValue;

    // Invalidate old tabs — cleans up marquee timers, caches, etc.
    for (const tab of this.tabs) {
      tab.invalidate?.();
    }

    this.tabs = [
      new Overview(summary, rangeKey, this.theme, contentHeight),
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

  override render(width: number): string[] {
    // Clear BorderBox render cache so timer-driven child updates
    // (e.g. marquee scrolling) are reflected in the output.
    // Direct property access works because TS private is compile-time only.
    // TODO: fix marquee animation
    // this.borderCache = null;
    this.clear();

    const innerWidth = width - 2 - 2;
    this.addChild(this.header);
    this.addChild(new Spacer(1));

    this.addChild(this.tabBar);
    this.addChild(
      new Text(this.theme.fg("borderMuted", "─".repeat(Math.max(innerWidth, 60))), 0, 0),
    );

    const allEmpty = [...this.summaries.values()].every((s) => s.sessionCount === 0);

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

    this.addChild(
      new Text(this.theme.fg("borderMuted", "─".repeat(Math.max(innerWidth, 60))), 0, 0),
    );
    const controls = this.theme.fg("dim", "Esc/q close  ←→ tabs  r range  ↑↓ scroll");
    this.addChild(new Text(controls, 0, 0));

    // Recompute content height — rebuild tabs if terminal was resized
    const newContentHeight = this.computeContentHeight();
    if (newContentHeight !== this.contentHeight) {
      this.contentHeight = newContentHeight;
      this.buildTabs();
    }

    return super.render(width);
  }

  override handleInput(data: string): void {
    // Invalidate BorderBox render cache so next render() picks up state changes.
    this.invalidate();

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
        (this.rangeSelector.selectedIndex + 1) % this.rangeOptions.length;
      this.buildTabs();
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
        return;
      }
    }
  }

  override invalidate(): void {
    super.invalidate();
    this.tabBar.invalidate();
    this.rangeSelector.invalidate();
    this.header.invalidate();
    for (const tab of this.tabs) {
      tab.invalidate?.();
    }
  }
}
