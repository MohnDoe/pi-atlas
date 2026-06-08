# pi-usage

A pi TUI extension that parses session logs to display agent usage statistics — cost, languages, models, projects, and tools — in an interactive terminal dashboard. Registered as the `/stats` command.

## Language

**Dashboard**:
The full-screen overlay TUI shown by the `/stats` command. Contains tabs for different stat views.
_Avoid_: Popover, panel, window

**Tab**:
A named section within the Dashboard. The user switches between them with Left/Right keys. Planned tabs: Overview, Languages, Models, Projects + Tools.
_Avoid_: Page, view, pane

**Time Range**:
A filter applied across all tabs. Options: 1d, 7d, 30d, All. Changing the range recalculates all visible stats.
_Avoid_: Period, window, filter

**Session Log**:
A `.jsonl` file in `~/.pi/agent/sessions/` containing message, tool call, and session entries recorded by pi.
_Avoid_: Log file, trace, history file

**Day Aggregate**:
A pre-computed rollup of all session log data for a single calendar day. Cached to disk to avoid re-parsing JSONL files on every open.
_Avoid_: Daily summary, daily stats

**Range Selector**:
A horizontal bar of time range options (1d / 7d / 30d / All). User navigates with Up/Down arrows, presses Enter to select. Changing the range recalculates all visible stats across all tabs.
_Avoid_: Period picker, date filter

**KPI Card**:
A compact stat display on the Overview tab showing a single metric: label, value, and optional subtitle. Arranged in a grid row at the top of the tab.
_Avoid_: Metric tile, stat box

**Ranked Table**:
A sortable columnar list used on Languages, Models, and Projects+Tools tabs. Header row with column labels, data rows sorted by the primary metric (highest first).
_Avoid_: Data grid, list view

**Signature**:
A hash computed from the session log directory's file paths, sizes, and modification times. Used to detect changes and invalidate the Day Aggregate cache.
_Avoid_: Checksum, fingerprint

**Bar Chart**:
An ASCII-art visualization of daily spend on the Overview tab. Vertical bars using block characters (█▌), auto-scaled so the tallest day fills available height. Other bars are proportional. X-axis labels adapt to the selected Time Range (day-of-week for 7d, every 5th day for 30d, monthly for All).
_Avoid_: Sparkline, histogram

**Tab Bar**:
A horizontal row at the top of the Dashboard showing all Tab names. The active tab is highlighted. Left/Right arrow keys switch tabs.
_Avoid_: Tab strip, navigation bar

**Empty State**:
A message displayed when no session logs exist or when a tab has no data for the selected Time Range. Example: "No sessions found in ~/.pi/agent/sessions".
_Avoid_: Zero state, blank state
