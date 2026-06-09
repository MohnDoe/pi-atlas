import { matchesKey } from "@earendil-works/pi-tui";
import type { DaySpend, StatsSummary, StatsTheme } from "./types.js";

// ---- TabBar ----

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

// ---- RangeSelector ----

export class RangeSelector {
  private ranges: string[];
  private theme: StatsTheme;
  selectedIndex: number;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    theme: StatsTheme,
    ranges: string[] = ["1d", "7d", "30d", "All"],
    selectedIndex = 0,
  ) {
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
        parts.push(this.theme.fg("muted", ` [${label}] `));
      }
    }

    this.cachedLines = [parts.join("")];
    this.cachedWidth = width;
    return this.cachedLines;
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "up")) {
      if (this.selectedIndex > 0) {
        this.selectedIndex--;
        this.invalidate();
      }
      return true;
    }
    if (matchesKey(data, "down")) {
      if (this.selectedIndex < this.ranges.length - 1) {
        this.selectedIndex++;
        this.invalidate();
      }
      return true;
    }
    if (matchesKey(data, "enter")) return true;
    return false;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}

// ---- KPI Cards ----

export interface KpiData {
  totalCost: number;
  sessionCount: number;
  totalMessages: number;
  totalTokens: number;
  daysActive: number;
  avgCostPerDay: number;
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function formatCost(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(2);
}

interface CardDef {
  label: string;
  value: string;
}

export class KpiCards {
  private cards: CardDef[];
  private theme: StatsTheme;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(kpis: KpiData, theme: StatsTheme) {
    this.theme = theme;
    this.cards = [
      { label: "Total Cost", value: formatCost(kpis.totalCost) },
      { label: "Sessions", value: String(kpis.sessionCount) },
      { label: "Messages", value: fmtNum(kpis.totalMessages) },
      { label: "Total Tokens", value: fmtNum(kpis.totalTokens) },
      { label: "Days Active", value: String(kpis.daysActive) },
      { label: "Avg Cost/Day", value: formatCost(kpis.avgCostPerDay) },
    ];
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const gap = 2;
    const cardW = Math.max(12, Math.floor((width - gap * 2) / 3));
    const lines: string[] = [];

    for (let row = 0; row < 2; row++) {
      let line = "";
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        const c = this.cards[idx];
        // Build plain cell first, pad, then style — avoids style tags being sliced
        const plain = (c.label + ": " + c.value).slice(0, cardW).padEnd(cardW);
        const cell = this.theme.fg("text", plain);
        line += cell;
        if (col < 2) line += " ".repeat(gap);
      }
      lines.push(line);
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}

// ---- Bar Chart ----

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export class BarChart {
  private data: DaySpend[];
  private range: string;
  private maxHeight: number;
  private theme: StatsTheme;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(data: DaySpend[], range: string, maxHeight: number, theme: StatsTheme) {
    this.data = data;
    this.range = range;
    this.maxHeight = maxHeight;
    this.theme = theme;
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (this.data.length === 0) {
      this.cachedLines = [this.theme.fg("muted", "No data")];
      this.cachedWidth = width;
      return this.cachedLines;
    }

    const barAreaH = Math.max(3, this.maxHeight - 2);
    const colW = Math.max(2, Math.floor((width - this.data.length) / this.data.length));
    const maxCost = Math.max(...this.data.map((d) => d.cost), 0.01);

    const lines: string[] = [];

    for (let row = barAreaH - 1; row >= 0; row--) {
      let line = "";
      for (const d of this.data) {
        const barH = maxCost > 0 ? (d.cost / maxCost) * barAreaH : 0;
        if (barH > row + 0.5) {
          line += this.theme.fg("accent", "█".repeat(colW));
        } else if (barH > row) {
          line += this.theme.fg("accent", "▌".repeat(colW));
        } else {
          line += " ".repeat(colW);
        }
        line += " ";
      }
      lines.push(line);
    }

    // X-axis labels
    let labelLine = "";
    for (let i = 0; i < this.data.length; i++) {
      const lbl = formatLabel(this.data[i].date, i, this.data, this.range);
      const cellW = colW + 1;
      labelLine += this.theme.fg("dim", lbl.padEnd(cellW).slice(0, cellW));
    }
    lines.push(labelLine);

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}

function formatLabel(dateStr: string, index: number, data: DaySpend[], range: string): string {
  const d = new Date(dateStr + "T00:00:00Z");

  if (range === "1d" || range === "7d") {
    return DAY_NAMES[d.getUTCDay()];
  }
  if (range === "30d") {
    const day = d.getUTCDate();
    if (day === 1 || day % 5 === 0 || index === 0 || index === data.length - 1) {
      return String(day);
    }
    return "";
  }
  // All — show month when it changes or first entry
  const month = MONTH_NAMES[d.getUTCMonth()];
  if (index === 0) return month;
  const prevD = new Date(data[index - 1].date + "T00:00:00Z");
  if (prevD.getUTCMonth() !== d.getUTCMonth()) return month;
  return "";
}

// ---- RankedTable ----

export interface ColumnDef {
  header: string;
  width: number;
}

export class RankedTable {
  private columns: ColumnDef[];
  private rows: string[][];
  private maxHeight: number;
  private theme: StatsTheme;
  private scrollOffset = 0;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(columns: ColumnDef[], rows: string[][], maxHeight: number, theme: StatsTheme) {
    this.columns = columns;
    this.rows = rows;
    this.maxHeight = maxHeight;
    this.theme = theme;
  }

  private get visibleRows(): number {
    return Math.max(1, this.maxHeight - 1); // 1 row for header
  }

  private get maxScroll(): number {
    return Math.max(0, this.rows.length - this.visibleRows);
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const lines: string[] = [];
    const rankColW = 4;
    const gap = " ";

    // Clamp scroll offset
    if (this.scrollOffset > this.maxScroll) this.scrollOffset = this.maxScroll;
    if (this.scrollOffset < 0) this.scrollOffset = 0;

    // Header row
    let header = "#".padEnd(rankColW) + gap;
    for (const col of this.columns) {
      header += col.header.slice(0, col.width).padEnd(col.width) + gap;
    }
    header = header.trimEnd();
    const visLen = header.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
    if (visLen > width) header = header.slice(0, width);
    lines.push(this.theme.bg("selectedBg", this.theme.bold(this.theme.fg("accent", header))));

    // Data rows
    const end = Math.min(this.scrollOffset + this.visibleRows, this.rows.length);
    for (let i = this.scrollOffset; i < end; i++) {
      const rank = String(i + 1);
      let row = rank.padStart(rankColW - 1) + " " + gap;
      const data = this.rows[i];
      for (let j = 0; j < this.columns.length; j++) {
        const val = (data[j] ?? "").slice(0, this.columns[j].width);
        row += val.padEnd(this.columns[j].width) + gap;
      }
      row = row.trimEnd();
      const rowVisLen = row.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
      if (rowVisLen > width) row = row.slice(0, width);
      lines.push(row);
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): boolean {
    if (matchesKey(data, "up")) {
      if (this.scrollOffset > 0) {
        this.scrollOffset--;
        this.invalidate();
      }
      return true;
    }
    if (matchesKey(data, "down")) {
      if (this.scrollOffset < this.maxScroll) {
        this.scrollOffset++;
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

// ---- Dashboard ----

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

// ---- Projects + Tools View ----

export class ProjectsToolsView {
  private projectsTable: RankedTable | null;
  private toolsTable: RankedTable | null;
  private maxHeight: number;
  private theme: StatsTheme;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;

  constructor(
    projects: { project: string; cost: number; sessions: number }[],
    tools: { tool: string; count: number }[],
    maxHeight: number,
    theme: StatsTheme,
  ) {
    this.maxHeight = maxHeight;
    this.theme = theme;

    if (projects.length > 0) {
      const projCols: ColumnDef[] = [
        { header: "Project", width: 8 },
        { header: "Cost", width: 6 },
        { header: "Sessions", width: 8 },
      ];
      const projRows = projects.map((p) => [
        p.project.slice(0, 8),
        formatCost(p.cost),
        String(p.sessions),
      ]);
      this.projectsTable = new RankedTable(projCols, projRows, maxHeight, theme);
    } else {
      this.projectsTable = null;
    }

    if (tools.length > 0) {
      const toolCols: ColumnDef[] = [
        { header: "Tool", width: 10 },
        { header: "Count", width: 8 },
      ];
      const toolRows = tools.map((t) => [t.tool.slice(0, 10), String(t.count)]);
      this.toolsTable = new RankedTable(toolCols, toolRows, maxHeight, theme);
    } else {
      this.toolsTable = null;
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const gap = 3;
    const halfW = Math.floor((width - gap) / 2);

    const leftLines = this.projectsTable
      ? this.projectsTable.render(halfW)
      : [this.theme.fg("muted", "  No project data")];
    const rightLines = this.toolsTable
      ? this.toolsTable.render(halfW)
      : [this.theme.fg("muted", "  No tool data")];

    const maxLen = Math.max(leftLines.length, rightLines.length);
    const lines: string[] = [];

    for (let i = 0; i < maxLen; i++) {
      const left = (leftLines[i] ?? "").padEnd(halfW);
      const right = rightLines[i] ?? "";
      let row = left;
      if (right) row += " │ " + right;
      const visLen = row.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[^>]+>/g, "").length;
      if (visLen > width) row = row.slice(0, width);
      lines.push(row);
    }

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  handleInput(data: string): boolean {
    // Up/down scroll both tables together
    if (data === "\x1b[A" || data === "\x1b[B") {
      if (this.projectsTable) this.projectsTable.handleInput(data);
      if (this.toolsTable) this.toolsTable.handleInput(data);
      this.invalidate();
      return true;
    }
    return false;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
    if (this.projectsTable) this.projectsTable.invalidate();
    if (this.toolsTable) this.toolsTable.invalidate();
  }
}

// ---- Model name formatting ----

export function formatModelName(raw: string): string {
  // Strip date suffix (YYYYMMDD or YYYY-MM-DD)
  let name = raw.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");

  // Replace separators with spaces, title case each word
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---- LoadingView ----

export class LoadingView {
  private progress = 0;
  private message: string;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;
  private tui: { requestRender: () => void } | null;

  constructor(message = "Parsing session logs...", tui?: { requestRender: () => void }) {
    this.message = message;
    this.tui = tui ?? null;
  }

  setProgress(p: number): void {
    this.progress = p;
    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const barW = Math.min(40, width - 10);
    const filled = Math.round((this.progress / 100) * barW);
    const bar = "█".repeat(filled) + "░".repeat(barW - filled);

    const lines = ["", `  ${this.message}`, `  [${bar}] ${this.progress}%`, ""];

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
