# PRD: pi-usage — TUI Usage Dashboard for pi

## Problem Statement

pi users have no way to see their agent usage statistics — how much they've spent, which languages they code in, which models they use most, or which projects consume the most tokens. Session logs exist on disk (`~/.pi/agent/sessions/**/*.jsonl`) but are opaque JSONL files. Users who want to understand their usage patterns, track costs, or optimize their model choices have no built-in tool to do so.

[pi-infobar](https://github.com/phun333/pi-infobar) solves this as a native macOS/Windows menu-bar app, but that requires leaving the terminal and installing a separate desktop application. A TUI-native solution would let users inspect their stats without leaving pi.

## Solution

A pi extension called **pi-usage** that registers a `/stats` command. Running `/stats` opens a full-screen interactive TUI overlay dashboard with tabs for different stat views, pulling data from the user's local session logs.

The extension parses `~/.pi/agent/sessions/**/*.jsonl` files, aggregates per-day statistics, caches the results to `~/.pi/pi-usage-cache.json` for fast subsequent opens, and renders ASCII-art visualizations (bar chart for daily spend, ranked tables for languages/models/projects/tools).

All processing is local — no network calls, no remote sync, no telemetry.

## User Stories

1. As a pi user, I want to see my total agent spend for today, so that I can track my daily AI coding costs.
2. As a pi user, I want to see a daily spend chart over the past week, so that I can identify which days I used pi the most.
3. As a pi user, I want to see which programming languages I edit/write most often, so that I can understand my actual coding mix.
4. As a pi user, I want to see cost breakdown by model, so that I can decide whether to switch to a cheaper model.
5. As a pi user, I want to see which projects consume the most tokens and cost, so that I can prioritize cost optimization.
6. As a pi user, I want to see which tools (bash, edit, write, read, etc.) I invoke most frequently, so that I can understand my workflow patterns.
7. As a pi user, I want to filter stats by time range (1 day, 7 days, 30 days, all time), so that I can zoom in on recent usage or see long-term trends.
8. As a pi user, I want the dashboard to open instantly after the first load (via caching), so that I don't wait for repeated parsing of the same session logs.
9. As a pi user, I want the cache to automatically invalidate when session logs change, so that stats are always current without manual refresh.
10. As a pi user, I want to navigate tabs with arrow keys and close with Escape, so that interaction feels natural in the terminal.
11. As a pi user, I want to see a loading spinner with progress while session logs are being parsed for the first time, so that I know the extension is working and not stuck.
12. As a pi user with no session history, I want to see a clear message explaining that no sessions were found, so that I understand why the dashboard is empty.
13. As a pi user, I want corrupted JSONL lines to be silently skipped with a warning count, so that a few bad lines don't break the entire dashboard.
14. As a pi user, I want the daily spend chart to adapt its X-axis labels to the selected time range (day-of-week for 7d, dates for 30d, months for All), so that the chart is readable at any zoom level.
15. As a pi user, I want token counts broken down by input, output, cache read, and cache write, so that I understand my full token consumption.
16. As a pi user, I want session and message counts visible, so that I can gauge my overall activity level.
17. As a pi user, I want average cost per day and days-active metrics, so that I can see my usage patterns at a glance.

## Implementation Decisions

### Architecture

- **Extension style**: Directory with `index.ts` entry point, placed at `~/.pi/agent/extensions/pi-usage/` for auto-discovery.
- **Loading**: Lazy. No work is done until the user runs `/stats`. On first invocation, session logs are parsed and cached. Subsequent invocations use the cache if the session directory signature hasn't changed.
- **Data source**: Local only. Reads from `~/.pi/agent/sessions/` (subdirectories, `*.jsonl` files). No remote SSH sync.
- **Cache**: Single JSON file at `~/.pi/pi-usage-cache.json`. Contains the full aggregate (array of per-day rollups), a signature hash of the session directory, and a generation timestamp. Signature check determines whether re-parsing is needed.
- **No configuration file**. Cache path and session directory path are hardcoded constants.

### Modules

Four TypeScript source files:

- **`index.ts`** — Extension entry point. Registers the `/stats` command. The command handler calls the engine to load or retrieve aggregates, then opens the dashboard TUI overlay via `ctx.ui.custom()`. Handles the loading spinner via `BorderedLoader` during first-time parse.

- **`engine.ts`** — Aggregate computation and caching. Provides:
  - `loadAggregate(force?: boolean, onProgress?: (p: number) => void): Promise<Aggregate>` — reads cache or parses all session logs. Returns the full aggregate with all DayAgg entries.
  - `summarize(days: DayAgg[], range: TimeRange): StatsSummary` — pure function that computes summary from day aggregates for a given time range. Returns KPI values, ranked lists, and daily spend data.
  - Session directory signature computation (FNV hash of file paths, sizes, mtimes).
  - Cache read/write with signature-based invalidation.

- **`parser.ts`** — JSONL parsing. Provides:
  - `parseFile(path: string, dayMap: Map<string, DayAgg>): void` — parses a single JSONL file, mutating the day map in place.
  - Language detection: maps file extensions from `edit`/`write` tool calls to language names using a static map.
  - Project name extraction: decodes the session directory name (which encodes the filesystem path) back to a human-readable project name.
  - Handles `session` type entries (extracts `cwd`), `message` type entries (extracts `role`, `usage`, `model`, `cost`), and tool calls within assistant messages (extracts tool name, `path`, line counts from `newText`/`edits`).
  - Corrupt JSONL lines are skipped with a warning counter.

- **`components.ts`** — All TUI components. Each implements the `{ render, handleInput, invalidate }` interface:
  - `Dashboard` — Top-level container composing TabBar, RangeSelector, and content area for the active tab.
  - `TabBar` — Renders tab names, highlights active tab. Handles Left/Right arrow input.
  - `RangeSelector` — Renders time range options. Handles Up/Down + Enter for selection.
  - `KpiCards` — Renders 6 KPI cards in a 2×3 grid layout. Each card shows label, value, and optional subtitle (e.g., percentage of total).
  - `BarChart` — ASCII vertical bar chart using block characters (█ ▌). Auto-scales to the max daily spend. X-axis labels adapt to range (day names for 7d, dates every 5th day for 30d, month labels for All). Y-axis shows dollar amounts at key points.
  - `RankedTable` — Generic ranked list component. Takes columns (header labels + widths) and rows (arrays of strings). Renders a header row (highlighted), then data rows with rank numbers. Handles scrolling for long lists.
  - `LoadingView` — Initial loading state. Delegates to `BorderedLoader` for spinner + progress, then transitions to the dashboard once data is ready.

### Data Model

All stats derive from `DayAgg` entries. One `DayAgg` per calendar day:

- `date`: `"YYYY-MM-DD"` string
- `cost`: total cost for the day (sum of `usage.cost.total` from assistant messages)
- `inTok`, `outTok`, `crTok`, `cwTok`: token breakdown
- `userMsgs`, `asstMsgs`, `toolResults`: message counts
- `sessionIds`: unique session IDs active that day
- `langLines`, `langEdits`: language → lines written / edit count
- `modelCost`, `modelCount`: model → cost / invocation count
- `projectCost`, `projectSessions`: project name → cost / session set
- `toolCount`: tool name → invocation count

A `StatsSummary` is derived from filtered `DayAgg[]` by `summarize()` and contains:

- KPI values: `totalCost`, `sessionCount`, `totalMessages`, `totalTokens`, `daysActive`, `avgCostPerDay`, `todayCost`
- `languages: LangStat[]` — sorted by lines descending
- `models: ModelStat[]` — sorted by cost descending
- `projects: ProjectStat[]` — sorted by cost descending
- `tools: ToolStat[]` — sorted by count descending
- `dailySpend: DaySpend[]` — filled (zero for gaps) array for the chart

### UI Layout

```
┌─ Tab Bar ───────────────────────────────────────────────┐
│  [Overview]   Languages    Models    Projects + Tools    │
├─ Range Selector ────────────────────────────────────────┤
│  [1d]  [7d]  [30d]  [All]                                │
├─ Content ───────────────────────────────────────────────┤
│  (varies by active tab)                                   │
│                                                           │
└─ Footer: "Esc/q close  ←→ tabs  ↑↓ range  Enter select" ─┘
```

**Overview tab** (top to bottom):
- 2×3 grid of KPI cards: Total Cost | Sessions | Messages | Total Tokens | Days Active | Avg Cost/Day
- Bar chart filling remaining vertical space

**Languages tab**: Ranked table with columns: # | Language | Lines | Edits

**Models tab**: Ranked table with columns: # | Model | Cost | Calls

**Projects + Tools tab**: Side-by-side layout (left half Projects, right half Tools)
- Projects: # | Project | Cost | Sessions
- Tools: # | Tool | Count

### Navigation

| Action | Key |
|--------|-----|
| Switch tab left | ← |
| Switch tab right | → |
| Move range selector | ↑ ↓ |
| Select range | Enter |
| Close dashboard | Esc or q |
| Scroll tables (if overflow) | ↑ ↓ within content area |

### Rendering Details

- **Bar chart**: Uses `█` for full blocks and `▌` for half blocks. Height = remaining terminal height after KPIs and borders. Each day column is at least 2 chars wide (bar + spacer). Auto-scaled: tallest bar = max height.
- **Cost formatting**: Displayed in USD with 2 decimal places (`$12.34`). Large values use compact notation if needed (`$1.2k`).
- **Model display names**: Stripped of vendor prefixes and date suffixes (`claude-sonnet-4-20250514` → `Sonnet 4`).
- **Theme**: Uses the active pi theme. KPI cards use theme accent colors. Selected tab/range are highlighted with accent background. Headers use bold.
- **Loading**: `BorderedLoader` shows "Parsing session logs..." with a progress percentage.

### Error Handling

- **No session directory**: Show "No sessions found in ~/.pi/agent/sessions" in the content area. All tabs show the empty state message.
- **No data for a specific tab**: Show "No data for this time range" within that tab's content area.
- **Corrupt JSONL lines**: Silently skipped. A warning counter is tracked but not shown in the TUI (logged to stderr for debugging).
- **Cache file corrupt or unreadable**: Falls back to re-parsing all session logs. No error shown to user.
- **Parse failure (catastrophic)**: Show "Failed to parse session logs: {message}" in the content area.

## Testing Decisions

### What makes a good test

Tests should verify external behavior — given some inputs (JSONL content, DayAgg data, render width), assert the outputs (parsed aggregates, computed summaries, rendered lines). Tests should not inspect internal implementation details.

### Modules tested

**Parser** — pure function tests. Feed in sample JSONL strings and assert the resulting DayAgg map has correct cost, token counts, language lines, project attribution, and tool counts. Test edge cases: empty files, malformed JSON, missing fields, unknown file extensions, sessions with no messages.

**Engine** — pure computation tests. Feed in mock `DayAgg[]` arrays and assert `summarize()` produces correct KPIs, ranked lists, and daily spend arrays for each time range. Test: single day, multiple days, zero-cost days, gaps in dates, range boundaries.

**Components** — render tests. Instantiate components with known data, call `render(width)`, assert that rendered lines contain expected text (labels, values, bar characters) and don't exceed `width`. Test: empty data states, scrolling overflow, ASCII chart scaling.

### Prior art

The pi codebase extension examples (`preset.ts`, `tools.ts`, `snake.ts`) demonstrate the component pattern: `{ render, handleInput, invalidate }`. The `SelectList` and `SettingsList` built-in components provide the ranked-list interaction pattern that `RankedTable` should emulate.

### Test runner

Vitest (MCP vitest server is available).

## Out of Scope

- Remote SSH sync (pi-infobar's optional remote mode)
- Persistent footer/widget indicator (overlay only)
- Configuration file or settings UI
- Graphical charts (donut, pie, line) — ASCII text only
- Export or copy stats to clipboard
- Real-time updates while dashboard is open (snapshot at open time)
- Historical session data migration from older pi versions
- Multi-machine session aggregation
- Custom themes beyond what the active pi theme provides
- Cost estimation for models without recorded `usage.cost` — only recorded costs are used

## Further Notes

- The extension is inspired by [pi-infobar](https://github.com/phun333/pi-infobar) and aims for feature parity where the TUI medium allows.
- The project directory will be `~/.pi/agent/extensions/pi-usage/` for auto-discovery, or symlinked. The working copy lives at `~/Work/dev/pi-usage/`.
- `package.json` may be needed if the extension requires npm dependencies. Currently, only `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, and `typebox` are needed — all provided by the pi runtime, so no external deps are expected.
