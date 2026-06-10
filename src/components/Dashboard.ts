import { Container, matchesKey, type Component, Spacer, Box, Text } from "@earendil-works/pi-tui";
import { formatCost, formatModelName } from "../parser";
import { StatsSummary, StatsTheme } from "../types";
import { BarChart } from "./BarChart";
import { KpiCards } from "./KpiCards";
import { ProjectsToolsView } from "./ProjectToolsView";
import { RangeSelector } from "./RangeSelector";
import { ColumnDef, RankedTable } from "./RankedTable";
import { TabBar } from "./TabBar";
import { Header } from "./Header";

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
  private tabBar: TabBar;
  private header: Header;
  private rangeSelector: RangeSelector;
  private summaries: StatsSummary[]; // [1d, 7d, 30d, All]
  private onClose: (() => void) | null = null;
  private activeTable: RankedTable | ProjectsToolsView | null = null;
  private lastTabIndex = 0;
  private lastRangeIndex = 1;
  private rangeLabels: string[];
  private theme: StatsTheme;

  constructor(summaries: StatsSummary[], theme: StatsTheme, onClose?: () => void) {
    super();
    this.summaries = summaries;
    this.theme = theme;
    this.onClose = onClose ?? null;
    this.tabBar = new TabBar(["Overview", "Languages", "Models", "Projects + Tools"], theme, 0);
    this.rangeLabels = ["1d", "7d", "30d", "All"];
    this.rangeSelector = new RangeSelector(theme, this.rangeLabels, this.rangeLabels.length - 1);
    this.header = new Header(this.rangeSelector);
  }

  private get currentSummary(): StatsSummary {
    return (
      this.summaries[this.rangeSelector.selectedIndex] ?? this.summaries[this.summaries.length - 1]
    );
  }

  render(width: number): string[] {
    // Rebuild children list based on current state
    this.clear();
    this.addChild(this.header);

    this.addChild(new Spacer(1));
    // Tab bar
    this.addChild(this.tabBar);

    // Separator
    this.addChild(new RawLine(this.theme.fg("borderMuted", "─".repeat(Math.min(width, 60)))));
    // Separator
    this.addChild(new RawLine(this.theme.fg("borderMuted", "─".repeat(Math.min(width, 60)))));

    // Detect empty states
    const allEmpty = this.summaries.every((s) => s.sessionCount === 0);
    const tabChanged = this.tabBar.activeIndex !== this.lastTabIndex;
    const rangeChanged = this.rangeSelector.selectedIndex !== this.lastRangeIndex;

    if (allEmpty) {
      this.addChild(new Spacer(1));
      this.addChild(
        new RawLine(this.theme.fg("muted", "  No sessions found in ~/.pi/agent/sessions")),
      );
      this.addChild(new Spacer(1));
      this.activeTable = null;
    } else if (this.currentSummary.sessionCount === 0) {
      this.addChild(new Spacer(1));
      this.addChild(new RawLine(this.theme.fg("muted", "  No data for this time range")));
      this.addChild(new Spacer(1));
      this.activeTable = null;
    } else if (this.tabBar.activeIndex === 0) {
      // Overview tab: KPI cards + bar chart
      this.activeTable = null;

      this.addChild(
        new KpiCards(
          {
            totalCost: this.currentSummary.totalCost,
            sessionCount: this.currentSummary.sessionCount,
            totalMessages: this.currentSummary.totalMessages,
            totalTokens: this.currentSummary.totalTokens,
            daysActive: this.currentSummary.daysActive,
            avgCostPerDay: this.currentSummary.avgCostPerDay,
          },
          this.theme,
        ),
      );

      this.addChild(new Spacer(1)); // spacer

      // Bar chart
      const remainingH = Math.max(8, 15);
      this.addChild(
        new BarChart(
          this.currentSummary.dailySpend,
          this.rangeLabels[this.rangeSelector.selectedIndex],
          remainingH,
          this.theme,
        ),
      );
    } else {
      // Table tabs: Languages (1), Models (2), Projects+Tools (3)
      if (tabChanged || rangeChanged) {
        this.activeTable = null;
      }
      this.lastTabIndex = this.tabBar.activeIndex;
      this.lastRangeIndex = this.rangeSelector.selectedIndex;

      if (this.tabBar.activeIndex === 1) {
        // Languages tab
        if (this.currentSummary.languages.length === 0) {
          this.addChild(new Spacer(1));
          this.addChild(
            new RawLine(this.theme.fg("muted", "  No language data for this time range")),
          );
          this.addChild(new Spacer(1));
          this.activeTable = null;
        } else if (!this.activeTable) {
          const langColumns: ColumnDef[] = [
            { header: "Language", width: 20 },
            { header: "Lines", width: 10 },
            { header: "Edits", width: 10 },
          ];
          const langRows = this.currentSummary.languages.map((l) => [
            l.language,
            String(l.lines),
            String(l.edits),
          ]);
          const tableH = Math.max(5, 15);
          this.activeTable = new RankedTable(langColumns, langRows, tableH, this.theme);
        }
        if (this.activeTable) {
          this.addChild(this.activeTable);
        }
      } else if (this.tabBar.activeIndex === 2) {
        // Models tab
        if (this.currentSummary.models.length === 0) {
          this.addChild(new Spacer(1));
          this.addChild(new RawLine(this.theme.fg("muted", "  No model data for this time range")));
          this.addChild(new Spacer(1));
          this.activeTable = null;
        } else if (!this.activeTable) {
          const modelColumns: ColumnDef[] = [
            { header: "Model", width: 20 },
            { header: "Cost", width: 10 },
            { header: "Calls", width: 10 },
          ];
          const modelRows = this.currentSummary.models.map((m) => [
            formatModelName(m.model),
            formatCost(m.cost),
            String(m.calls),
          ]);
          const tableH = Math.max(5, 15);
          this.activeTable = new RankedTable(modelColumns, modelRows, tableH, this.theme);
        }
        if (this.activeTable) {
          this.addChild(this.activeTable);
        }
      } else {
        // Projects + Tools tab (index 3)
        if (!this.activeTable) {
          const tableH = Math.max(5, 15);
          this.activeTable = new ProjectsToolsView(
            this.currentSummary.projects,
            this.currentSummary.tools,
            tableH,
            this.theme,
          );
        }
        if (this.activeTable) {
          this.addChild(this.activeTable);
        }
      }
    }

    // Footer
    this.addChild(new RawLine(this.theme.fg("borderMuted", "─".repeat(Math.min(width, 60)))));
    this.addChild(
      new RawLine(this.theme.fg("dim", "Esc/q close  ←→ tabs  ↑↓ range  Enter select")),
    );

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
      this.invalidate();
      return;
    }

    // Range selector input (up/down/enter)
    if (matchesKey(data, "up") || matchesKey(data, "down")) {
      this.rangeSelector.handleInput(data);
      this.invalidate();
      return;
    }

    // Table scrolling (up/down) — on table tabs
    if (matchesKey(data, "up") || matchesKey(data, "down")) {
      if (this.activeTable) {
        this.activeTable.handleInput(data);
        this.invalidate();
        return;
      }
      // Even without a table (empty state), consume the event on table tabs
      if (this.tabBar.activeIndex >= 1) return;
    }
  }

  invalidate(): void {
    this.tabBar.invalidate();
    this.rangeSelector.invalidate();
    if (this.activeTable) {
      this.activeTable.invalidate();
    }
  }
}
