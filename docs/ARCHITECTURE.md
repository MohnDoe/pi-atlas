# pi-atlas Architecture

## Module Structure

```
src/
├── index.ts              — Extension entry point (registers /atlas command)
├── types.ts              — All shared types (DayAgg, StatsSummary, session log types)
├── parser.ts             — JSONL file → DayAgg[]. Contains global sessionProjectMap.
├── compute.ts            — summarize(): DayAgg[] × TimeRange → StatsSummary (pure function)
├── cache.ts              — loadAggregate(): cache I/O, SHA-256 signature, file walking
├── format.ts             — Formatters (cost, number, dates, model names) + language detection
├── colorPalette.ts       — Per-language and per-provider chalk color assignments
├── components/           — Reusable TUI components
│   ├── Dashboard.ts          — Top-level container (extends BorderBox): TabBar + 5 tabs
│   ├── LoadingView.ts        — Progress bar shown during first-time parse
│   ├── TabBar.ts             — Row of clickable tab names, ←→ navigation
│   ├── RangeSelector.ts      — Displays current range label, cycles on 'r'
│   ├── KpiCards.ts           — Single GridRow of 6 StatCards (16%×5 + 17%)
│   ├── StatCard.ts           — Single label+value card (two-line)
│   ├── BarChart.ts           — ASCII vertical bar chart (daily or hourly cost)
│   ├── cells.ts              — CellComponent system for SortedTable
│   ├── SortedTable.ts        — Interactive table with cursor, marquee, scrolling
│   ├── MarqueeText.ts        — Auto-scrolling text animation (150ms tick)
│   └── shared/
│       ├── Bar.ts            — renderBar(): horizontal bar of ■ characters
│       └── GridRow.ts        — Percentage-based column layout
├── tabs/                 — Tab content components (all extend Container from pi-tui)
│   ├── Overview.ts           — KpiCards + BarChart + top language/model/project row
│   ├── Languages.ts          — SortedTable (Name, Share%, Edits, Lines) in BorderBox
│   ├── Models.ts             — SortedTable (Name, Provider, Cost%, Calls, Cost) in BorderBox
│   ├── Projects.ts           — SortedTable (Name, Share%, Sessions, Cost) in BorderBox
│   └── Usage.ts              — Token stat cards + tool SortedTable, both in BorderBoxes
└── __tests__/            — Tests (parser, compute, format, cache, e2e)
    └── components/__tests__/ — Component render tests
        └── tabs/__tests__/   — Tab component tests
```

## Data Flow Pipeline

```
Session logs (.jsonl)
  │
  ├── [cache hit]  readCache() → deserialize → DayAgg[]
  │                     ↑ signature matches?
  │
  └── [cache miss/force]  parseFile() per JSONL file
          │
          ▼
    sessionProjectMap ← session entry (extracts cwd → project name)
          │
          ▼
    per-entry parse*():
      session entry → day with sessionId + project
      user message  → day with 1 user message count
      assistant msg → day with cost, tokens, model, tool calls
      tool result   → day with tool name count
          │
          ▼
    mergeDay(): accumulate entry aggregates into calendar-day buckets
          │
          ▼
    computeSignature() → SHA-256 of file metadata
    writeCache()       → persist serialized DayAgg[]
          │
          ▼
    DayAgg[] (sorted by date)
          │
          ▼
    summarize(days, range) → per range (1d|7d|30d|All)
          │  filter days by cutoff date
          │  merge costs, tokens, languages, models, projects, tools
          │  compute KPIs, sort ranked lists
          │  fill daily spend (zero-fill gaps for bounded ranges)
          │  build hourly spend (accumulates per-hour cost across UTC hours)
          │
          ▼
    StatsSummary × 4  (pre-computed in index.ts, stored in Map<TimeRange, StatsSummary>)
          │
          ▼
    Tab render(StatsSummary):
      Overview   → KpiCards + BarChart + top language/model/project
      Languages  → SortedTable (by lines, desc)
      Models     → SortedTable (by cost, desc)
      Projects   → SortedTable (by cost, desc)
      Usage      → Token stat cards + tool SortedTable (by count, desc)
```

## TUI Component Architecture

### Component Interface

Components use pi-tui's `Component` interface. Tab content components extend `Container` (which implements `Component`) for child management:

```ts
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate(): void;
}
```

- **render(width)**: Returns an array of strings (no trailing newlines). Each string is one terminal line, optionally with ANSI escape codes for colors. The `width` parameter is the available horizontal space in characters.
- **handleInput(data)**: Receives key events. `data` is either a key name (e.g., `"escape"`, `"enter"`) or a literal character (e.g., `"r"`, `"q"`). Arcade-key names use `matchesKey()` from pi-tui for comparison.
- **invalidate()**: Clears any cached render output, forcing the next `render()` call to recompute.

### CellComponent (for SortedTable)

The `cells.ts` module defines a `CellComponent` interface and factory:

```ts
interface CellComponent {
  render(width: number, state?: CellState): string;
  invalidate(): void;
}

interface CellState {
  isFocused?: boolean;
  sortDirection?: "asc" | "desc" | null;
}
```

Factory methods: `cell.text(content)`, `cell.header(content)`, `cell.marquee(content, tui)`, `cell.bar(fillPct, filledStyle, emptyStyle)`.

- **TextCell**: Static text, truncated to width.
- **HeaderCell**: Text with sort indicator (▲/▼).
- **MarqueeCell**: Auto-scrolling text when focused and overflowing; truncated with ellipsis when unfocused.
- **BarCell**: Filled horizontal bar using `renderBar()` from `shared/Bar.ts`.

### BorderBox (from @mohndoe/pi-tui-extras)

`Dashboard` extends `BorderBox`, and every tab wraps its content in a `BorderBox`. The BorderBox supports:

- Title(s) embedded in the top border line (left/right aligned)
- Footer(s) embedded in the bottom border line
- Configurable border style (`singleRounded` by default, `single` available)
- Configurable padding
- A `borderFn` for styling the border characters

### Rendering Pipeline

1. `index.ts` creates a Dashboard inside `ctx.ui.custom()` with `overlay: true` (always centered popup at 50% width, max 80% height, anchored center).
2. `Dashboard.render(width)` is called by the TUI. Dashboard clears its children, builds children fresh, and calls `super.render(width)` (BorderBox render).
3. BorderBox renders its borders, titles, footers, and children sequentially.
4. Each child component renders with its allocated width.
5. `tui.requestRender()` triggers a full re-render after state changes from input handlers.

### CHROME_ROWS (3 rows consumed by Dashboard framing inside the border)

| Row(s) | Element                                          |
| ------ | ------------------------------------------------ |
| 1      | TabBar                                           |
| 2      | Separator line (─)                               |
| 3+     | Active tab content (variable height)             |
| -1     | Separator line (─)                               |
| 0 (last) | Footer: controls hint (Esc/q, ←→, r, ↑↓)     |

The Dashboard's BorderBox also carries:
- **Left title**: bold "Pi Atlas · v0.1"
- **Right title**: current range label (e.g., "Today [r]") — updates when range changes
- **Footer(s)**: optional update label (e.g., "Last update: ..."), right-aligned

Chrome rows are subtracted from the total available height to compute `contentHeight` for tabs. The `computeContentHeight()` method derives terminal height from `tui.terminal.rows`, takes 80%, then subtracts `CHROME_ROWS + 2` (border top + bottom).

### Keyboard Navigation

| Key     | Action                       | Handled by                         |
| ------- | ---------------------------- | ---------------------------------- |
| ← →     | Switch tabs                  | Dashboard → TabBar                 |
| r       | Cycle time range             | Dashboard → RangeSelector          |
| ↑ ↓     | Scroll active tab            | Dashboard → active tab (scrollable)|
| Esc / q | Close dashboard              | Dashboard                          |
| Enter   | No-op (consumed)             | Dashboard / RangeSelector          |

### Component Caching Pattern

Most components follow this caching pattern:

```ts
private cachedLines: string[] | null = null;
private cachedWidth = -1;

render(width: number): string[] {
  if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
  // ... compute lines ...
  this.cachedLines = lines;
  this.cachedWidth = width;
  return lines;
}

invalidate(): void {
  this.cachedLines = null;
  this.cachedWidth = -1;
}
```

The cache is keyed by `width`. On terminal resize, the new `width` triggers a cache miss. Components are invalidated when data changes (range switch, tab switch, data reload). `Dashboard` extends `BorderBox` and calls `super.invalidate()` plus invalidates all children on input.

### SortedTable Marquee Animation

The SortedTable uses `MarqueeText` to scroll overflowing cell text. Each marquee cell runs a `setInterval` at 150ms, advancing the scroll offset by 1 character and calling `tui.requestRender()` to animate. Marquees are cleaned up when the focused row changes or the table is invalidated.

## Tab Content Reference

### Overview

Three sections stacked vertically:

1. **KPI Cards** in a `BorderBox` (single rounded): 6 `StatCard`s in one `GridRow` — Total cost, Sessions, Messages, Active days, Avg/Day, Tokens.
2. **Cost over time** in a `BorderBox` with "Cost overtime" title: `BarChart` component. For `1d` range with complete hourly data, renders 24-hour bars. Otherwise renders daily bars with x-axis labels adapting to range (day-of-week for 7d, day-of-month for 30d, month for All).
3. **Top cards** row in a `GridRow` (33/33/34): three small `BorderBox`es — Top Language (with language color), Top Model (with provider color), Top Project.

### Languages

Single `BorderBox` containing a `SortedTable` with columns:

| Column   | Width | Description                  |
| -------- | ----- | ---------------------------- |
| Name     | 12    | Language name (marquee)      |
| Share %  | fill  | Horizontal bar, colored      |
| Edits    | 8     | Edit count (muted)           |
| Lines    | 14    | Line count (bold), sorted ↓  |

Rows built once in constructor using `cell.marquee()`, `cell.bar()`, `cell.text()`.

### Models

Single `BorderBox` containing a `SortedTable`:

| Column   | Width | Description                     |
| -------- | ----- | ------------------------------- |
| Name     | 32    | Model name (marquee, formatted) |
| Provider | 16    | Provider name (muted)           |
| Cost %   | fill  | Horizontal bar, provider-colored|
| Calls    | 10    | Call count (muted)              |
| Cost     | 12    | Cost (bold or "Free" if $0), ↓  |

### Projects

Single `BorderBox` with a `SortedTable`:

| Column   | Width | Description                  |
| -------- | ----- | ---------------------------- |
| Name     | 20    | Project name (marquee)       |
| Share %  | fill  | Horizontal bar               |
| Sessions | 14    | Session count (muted)        |
| Cost     | 8     | Cost (bold or "Free"), ↓     |

### Usage

Two sections, each in a `BorderBox`:

1. **Tokens**: Title "Tokens" + token total (right title). Single `GridRow` of 4 `StatCard`s (25% each): Input, Output, Cache Read, Cache Write.
2. **Tools**: Title "Tools" + tool count (right title). `SortedTable` with columns:

| Column   | Width | Description              |
| -------- | ----- | ------------------------ |
| Command  | 20    | Tool name (marquee)      |
| Share %  | fill  | Horizontal bar           |
| Calls    | 12    | Count (bold), sorted ↓   |

## Key Implementation Notes

### Content Measurement

Language statistics report **lines** — measured by splitting edited `newText` or written `content` by newline characters (`\n`). For assistant messages, uses `(s.match(/\n/g) ?? []).length` for a single edit. For file writes, uses `content.split("\n")` to count lines. Always the number of lines added, not character length.

### Cost Attribution

Cost from an assistant message is attributed to **all active projects** (unique project names from session entries parsed so far in the current `parseFile()` call). This means a session working on multiple projects attributes the same cost to each project. The global `sessionProjectMap` is reset at the start of each file parse.

### Provider Tracking

DayAgg tracks both `modelCost`/`modelCount` and `providerCost`/`providerCount`, plus a `modelToProvider` mapping. This allows the Models tab to show provider alongside model name.

### BarChart: Hourly vs Daily Mode

The BarChart detects the active range:
- For `1d` with exactly 24 `HourSpend` entries, renders per-hour bars with `Nh` labels every 4/6/12 hours.
- For all other ranges, renders daily bars with date labels. Automatically downsamples data if there are more bars than available width (aggregates consecutive days).

### Cache Invalidation

Cache is invalidated when the SHA-256 hash of all `.jsonl` file paths, sizes, and modification times changes. The hash is deterministic (sorted by path). If the cache file is corrupt or missing, it's rebuilt from scratch — no error is shown to the user.

### Loading Flow

1. `getCacheTimestamp()` reads the old cache to show "Last update: ..." in the footer
2. `loadAggregate()` runs with progress callbacks
3. A `LoadingView` component shows the progress bar during first-time parse
4. The `LoadingView` calls `tui.requestRender()` on each progress update for animation
5. Once loaded, the Dashboard replaces the LoadingView

### Language Detection

File extensions are mapped to language names via a static `EXT_TO_LANG` table in `format.ts` (~60 entries). Unknown extensions are reported as "Other".

### RangeSelector

The RangeSelector accepts `RangeOption[]` from `index.ts`, not hardcoded ranges. Options are:
- "Today" → `1d`
- "Last 7 days" → `7d`
- "Last 30 days" → `30d`
- "All time" → `All`

The `r` key cycles through the array with wrap-around. The Dashboard reads `selectedValue` to look up the correct `StatsSummary` from the `Map<TimeRange, StatsSummary>`.

### Empty States

The Dashboard checks all summaries upfront:
- If **all summaries** have `sessionCount === 0`: shows "No sessions found in ~/.pi/agent/sessions"
- If **current summary** has `sessionCount === 0`: shows "No data for this time range"
- Individual tabs show their own empty messages ("No language data...", "No model data...", etc.)
