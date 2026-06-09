import { matchesKey } from "@earendil-works/pi-tui";
import { formatCost, formatModelName } from "../parser";
import { StatsSummary, StatsTheme } from "../types";
import { BarChart } from "./BarChart";
import { KpiCards } from "./KpiCards";
import { ProjectsToolsView } from "./ProjectToolsView";
import { RangeSelector } from "./RangeSelector";
import { ColumnDef, RankedTable } from "./RankedTable";
import { TabBar } from "./TabBar";

export class Dashboard {
  private tabBar: TabBar;
  private rangeSelector: RangeSelector;
  private summaries: StatsSummary[]; // [1d, 7d, 30d, All]
  private onClose: (() => void) | null = null;
  private activeTable: RankedTable | ProjectsToolsView | null = null;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;
  private lastTabIndex = 0;
  private lastRangeIndex = 1;
  private theme: StatsTheme;

  constructor(summaries: StatsSummary[], theme: StatsTheme, onClose?: () => void) {
    this.summaries = summaries;
    this.theme = theme;
    this.onClose = onClose ?? null;
    this.tabBar = new TabBar(["Overview", "Languages", "Models", "Projects + Tools"], theme, 0);
    this.rangeSelector = new RangeSelector(theme, ["1d", "7d", "30d", "All"], 1); // default 7d
  }

  private get currentSummary(): StatsSummary {
    return this.summaries[this.rangeSelector.selectedIndex] ?? this.summaries[1];
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const lines: string[] = [];
    const sep = "─".repeat(Math.min(width, 60));

    // Top border
    lines.push(this.theme.fg("borderMuted", sep));

    // Tab bar
    const tabLines = this.tabBar.render(width);
    lines.push(...tabLines);

    // Separator
    lines.push(this.theme.fg("borderMuted", sep));

    // Range selector
    const rangeLines = this.rangeSelector.render(width);
    lines.push(...rangeLines);

    // Separator
    lines.push(this.theme.fg("borderMuted", sep));

    // Detect empty states
    const allEmpty = this.summaries.every((s) => s.sessionCount === 0);
    if (allEmpty) {
      lines.push("");
      lines.push(this.theme.fg("muted", "  No sessions found in ~/.pi/agent/sessions"));
      lines.push("");
    } else if (this.currentSummary.sessionCount === 0) {
      lines.push("");
      lines.push(this.theme.fg("muted", "  No data for this time range"));
      lines.push("");
    } else if (this.tabBar.activeIndex === 0) {
      // Overview tab: KPI cards + bar chart
      const kpiLines = new KpiCards(
        {
          totalCost: this.currentSummary.totalCost,
          sessionCount: this.currentSummary.sessionCount,
          totalMessages: this.currentSummary.totalMessages,
          totalTokens: this.currentSummary.totalTokens,
          daysActive: this.currentSummary.daysActive,
          avgCostPerDay: this.currentSummary.avgCostPerDay,
        },
        this.theme,
      ).render(width);
      lines.push(...kpiLines);

      lines.push(""); // spacer

      // Bar chart fills remaining space
      const remainingH = Math.max(8, 15);
      const chartLines = new BarChart(
        this.currentSummary.dailySpend,
        ["1d", "7d", "30d", "All"][this.rangeSelector.selectedIndex],
        remainingH,
        this.theme,
      ).render(width);
      lines.push(...chartLines);
    } else if (
      this.tabBar.activeIndex === 1 ||
      this.tabBar.activeIndex === 2 ||
      this.tabBar.activeIndex === 3
    ) {
      // Table tabs: Languages (1), Models (2), Projects+Tools (3)
      const tabChanged = this.tabBar.activeIndex !== this.lastTabIndex;
      const rangeChanged = this.rangeSelector.selectedIndex !== this.lastRangeIndex;
      if (tabChanged || rangeChanged) {
        this.activeTable = null;
      }
      this.lastTabIndex = this.tabBar.activeIndex;
      this.lastRangeIndex = this.rangeSelector.selectedIndex;

      if (this.tabBar.activeIndex === 1) {
        // Languages tab
        if (this.currentSummary.languages.length === 0) {
          lines.push("");
          lines.push(this.theme.fg("muted", "  No language data for this time range"));
          lines.push("");
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
          const tableLines = this.activeTable.render(width);
          lines.push(...tableLines);
        }
      } else if (this.tabBar.activeIndex === 2) {
        // Models tab
        if (this.currentSummary.models.length === 0) {
          lines.push("");
          lines.push(this.theme.fg("muted", "  No model data for this time range"));
          lines.push("");
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
          const tableLines = this.activeTable.render(width);
          lines.push(...tableLines);
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
        const viewLines = this.activeTable.render(width);
        lines.push(...viewLines);
      }
    }

    // Footer
    lines.push(this.theme.fg("borderMuted", sep));
    lines.push(this.theme.fg("dim", "Esc/q close  ←→ tabs  ↑↓ range  Enter select"));

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "escape") || data === "q" || data === "Q") {
      this.onClose?.();
      return true;
    }

    // Tab bar input (left/right)
    if (matchesKey(data, "left") || matchesKey(data, "right")) {
      this.tabBar.handleInput(data);
      this.invalidate();
      return true;
    }

    // Range selector input (up/down/enter) — only on Overview tab
    if (
      (matchesKey(data, "up") || matchesKey(data, "down") || matchesKey(data, "enter")) &&
      this.tabBar.activeIndex === 0
    ) {
      this.rangeSelector.handleInput(data);
      this.invalidate();
      return true;
    }

    // Table scrolling (up/down) — on table tabs
    if (matchesKey(data, "up") || matchesKey(data, "down")) {
      if (this.activeTable) {
        this.activeTable.handleInput(data);
        this.invalidate();
        return true;
      }
      // Even without a table (empty state), consume the event on table tabs
      if (this.tabBar.activeIndex >= 1) return true;
    }

    return false;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
    this.tabBar.invalidate();
    this.rangeSelector.invalidate();
  }
}
