# @mohndoe/pi-atlas

A pi TUI extension that provides an atlas of agent activity — costs, languages, models, projects, and tools — from session logs in an interactive terminal dashboard. Registered as the `/atlas` command.

## Architecture Overview

The extension has four core modules and a component layer:

- **`index.ts`** — Entry point. Registers `/atlas`. Uses `ctx.ui.custom()` to show a LoadingView, then the Dashboard.
- **`cache.ts`** — Loads or computes the Day Aggregate array. Tries cache first (SHA-256 directory signature), falls back to parsing all JSONL files.
- **`parser.ts`** — Parses individual `.jsonl` files into per-calendar-day DayAgg entries. Handles session, user message, assistant message, tool result, model change, thinking level change, and compaction entry types. Silently skips branch summary, custom, custom message, label, and session info entries.
- **`compute.ts`** — Pure function `summarize()` that filters DayAgg[] by time range and merges them into a StatsSummary.
- **`format.ts`** — Formatting utilities (costs, numbers, dates, model names, language mapping via file extension).
- **`colorPalette.ts`** — Per-language and per-provider color assignments using chalk.
- **`components/`** — TUI component tree (Dashboard, TabBar, RangeSelector, etc.)
- **`tabs/`** — Tab content components (Overview, Languages, Models, Projects, Usage)

**Data flow**: JSONL files → `parseFile()` → `DayAgg[]` per day → `summarize()` → `StatsSummary` per range → Component render.

## Language

**Command**:
The `/atlas` pi command that opens the Dashboard. No arguments. Registered in `index.ts` under the name `"atlas"`.
_Avoid_: /stats, /usage

**Dashboard**:
The full-screen or overlay TUI shown by the `/atlas` command. Contains tabs for different stat views. In large terminals (≥60 cols × 20 rows), shows as a 50%-width centered popup with rounded border. In smaller terminals, fills the screen.
_Avoid_: Popover, panel, window

**Tab**:
A named section within the Dashboard. Five tabs: Overview, Languages, Models, Projects, Usage. The user switches between them with Left/Right keys. Each tab receives its data from the StatsSummary for the currently selected Time Range.
_Avoid_: Page, view, pane

**Time Range**:
A filter applied across all tabs. Options: 1d, 7d, 30d, All. The user cycles through them with the `r` key. Changing the range recalculates all visible stats across all tabs. Summaries for all four ranges are pre-computed when the Dashboard opens.
_Avoid_: Period, window, filter

**Session Log**:
A `.jsonl` file in `~/.pi/agent/sessions/` in pi's session format (a FileEntry union of 10 entry types). Contains session headers and tree-linked entries: messages, model changes, thinking level changes, compactions, branch summaries, custom entries, custom messages, labels, and session info.
_Avoid_: Log file, trace, history file

**Compaction Entry**:
A session entry recording a context compaction event. Carries a summary of compacted messages, the first kept entry ID, and the number of tokens compacted (`tokensBefore`). Tracked in DayAgg as `compactionCount` and `compactedTokens`.
_Avoid_: Summary entry, context compression

**Model Change Entry**:
A session entry recording an explicit model switch by the user. Carries the provider and model ID. Tracked in DayAgg as `modelChanges`.
_Avoid_: Model switch, provider change

**Thinking Level Change Entry**:
A session entry recording a thinking/reasoning level change by the user. Carries the thinking level string (e.g. "low", "high", "xhigh"). Tracked in DayAgg as `thinkingLevelCount` (a per-level counter).
_Avoid_: Reasoning level, effort change

**Day Aggregate**:
A pre-computed rollup of all session log data for a single calendar day. Cached to disk as a `CachePayload` (serialized `DayAgg[]` with a directory signature) to avoid re-parsing JSONL files on every open.
_Avoid_: Daily summary, daily stats

**Range Selector**:
A lightweight component showing the currently selected Time Range label. The `r` key cycles through 1d → 7d → 30d → All → 1d. No visual horizontal bar or arrow-key navigation.
_Avoid_: Period picker, date filter

**KPI Card**:
A compact stat display on the Overview tab showing a single metric: muted label and accent-colored value. Six cards arranged in two GridRow rows of three: Total Cost, Sessions, Messages (top row), Active Days, Avg/Day, Tokens (bottom row).
_Avoid_: Metric tile, stat box

**Bar Chart**:
An ASCII-art visualization of daily spend on the Overview tab. Vertical bars using block characters (█▌), auto-scaled so the tallest day fills the available height. Other bars are proportional. Y-axis labels show formatted cost values on the left, separated by a \`│\` line. Labels are auto-spaced based on chart height (every row if ≤6, every other if ≤14, every 3rd otherwise) and always include a $0.00 baseline. X-axis labels adapt to the selected Time Range: day-of-week for 7d, calendar day every 5th entry for 30d, month labels when month changes for All.
_Avoid_: Sparkline, histogram

**SortedTable**:
An interactive table component on the Models tab. Supports row cursor (▶ indicator), keyboard scrolling via Up/Down, and marquee text scrolling for overflowing model names. Header row shows sort indicators (▲▼). Columns: Model (fill), Provider (12), Calls (6), Cost (8).
_Avoid_: Data grid, list view

**RankedBarList**:
A bar-list visualization used on the Languages, Projects, and Usage (tools) tabs. Each item is rendered as a UsageRow: name (bold, left) + values (right) on line 1, a horizontal progress bar with percentage on line 2. The tallest bar fills the available width; shorter bars are proportional.
_Avoid_: Ranked table, bar list

**Usage Row**:
A two-line row used inside RankedBarList. Line 1: bold name on the left, secondary text (muted) + main value (bold) on the right. Line 2: colored progress bar (■ characters) with percentage suffix.
_Avoid_: List item, bar row

**GridRow**:
A layout component that distributes child components across the full terminal width using percentage-based column widths. Used by the Overview tab's KpiCards (3 children at 33%/33%/34%) and the Usage tab's token breakdown (4 children at 25% each).
_Avoid_: Row layout, flex row

**StatCard**:
A compact two-line component (muted label, accent-colored value) used inside GridRow to form KPI cards.
_Avoid_: Metric display, info box

**BorderBox**:
A wrapper component that renders its child inside a box border (rounded ╭╮╰╯ by default, square ┌┐└┘ when `rounded: false`). Supports optional title and footer embedded in the border line. Used by:

- Header to frame the Range Selector
- DashboardPopup to wrap the entire Dashboard in overlay mode
  _Avoid_: Frame, panel

**DashboardPopup**:
A thin wrapper around Dashboard that adds a BorderBox with title "Pi Atlas v0.1". Only used in overlay/popup mode (terminals ≥60×20).
_Avoid_: Popup wrapper

**LoadingView**:
The initial component shown while session logs are being parsed. Displays "Parsing session logs..." with a progress bar (█░ characters) and percentage. Calls `tui.requestRender()` on progress updates.
_Avoid_: Splash screen, spinner

**MarqueeText**:
An animated text component that scrolls overflowing text left-to-right (wrapping around with a 5-char gap) at 1 character per 150ms tick. Only used inside SortedTable for overflowing model names on the Models tab. Each instance drives its own `setInterval` timer and calls `tui.requestRender()` to animate.
_Avoid_: Scrolling text, auto-scroll

**Signature**:
A SHA-256 hash computed from the session log directory's file paths, sizes, and modification times. Used to detect changes and invalidate the Day Aggregate cache.
_Avoid_: Checksum, fingerprint

**Language Count**:
The number of lines edited or written for a language. Measured by splitting edited `newText` or written `content` by newline characters. Not character length.
_Avoid_: Lines written, lines of code

**Empty State**:
A message displayed when no session logs exist ("No sessions found in ~/.pi/agent/sessions") or when a tab has no data for the selected Time Range ("No data for this time range").
_Avoid_: Zero state, blank state

**Skill**:
A reusable agent instruction set loaded from a `SKILL.md` file and injected into a user message via a `<skill name="…" location="…">` XML tag. Detected in user message text content during session log parsing. Tracked in the Skills tab with cost, invocation count, and tokens.
_Avoid_: Command, extension, plugin

**Skill Invocation**:
One occurrence of a user message containing a `<skill>` XML tag. Forms a boundary: all assistant and tool messages from that user message until the next user message are attributed to the Skill Invocation. Cost, tokens, and message counts accumulate under the skill name.
_Avoid_: Skill run, skill usage, skill call
