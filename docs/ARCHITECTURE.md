# pi-usage Architecture

## Module Structure

```
src/
├── index.ts           — Extension entry point (registers /usage command)
├── types.ts           — All shared types (DayAgg, StatsSummary, session log types)
├── parser.ts          — JSONL file → DayAgg[]. Contains global sessionProjectMap.
├── compute.ts         — summarize(): DayAgg[] × TimeRange → StatsSummary (pure function)
├── cache.ts           — loadAggregate(): cache I/O, SHA-256 signature, file walking
├── format.ts          — Formatters (cost, number, dates, model names) + language detection
├── colorPalette.ts    — Per-language and per-provider chalk color assignments
├── components/        — Reusable TUI components
│   ├── Dashboard.ts       — Top-level container: TabBar + RangeSelector + active tab
│   ├── DashboardPopup.ts  — Wraps Dashboard in rounded BorderBox for overlay mode
│   ├── LoadingView.ts     — Progress bar shown during first-time parse
│   ├── Header.ts          — Title + RangeSelector in a BorderBox
│   ├── TabBar.ts          — Row of clickable tab names, ←→ navigation
│   ├── RangeSelector.ts   — Displays current range label, no interactive bar
│   ├── KpiCards.ts        — 2×3 grid of StatCard instances
│   ├── StatCard.ts        — Single label+value card (two lines)
│   ├── BarChart.ts        — ASCII vertical bar chart for daily spend
│   ├── SortedTable.ts     — Interactive table with cursor, marquee, scrolling
│   ├── RankedBarList.ts   — Bar visualization list (uses UsageRow)
│   ├── UsageRow.ts        — Two-line row: name+value + progress bar
│   ├── BorderBox.ts       — Wrapper with rounded/square border and title support
│   ├── MarqueeText.ts     — Auto-scrolling text animation (150ms tick)
│   └── shared/
│       └── GridRow.ts     — Percentage-based column layout
├── tabs/               — Tab content components
│   ├── Overview.ts     — KpiCards + BarChart
│   ├── Languages.ts    — RankedBarList by lines
│   ├── Models.ts       — SortedTable by cost
│   ├── Projects.ts     — RankedBarList by cost
│   └── Usage.ts        — Token cards + tool RankedBarList
└── __tests__/          — Pure unit tests (parser, compute, format, cache)
    └── components/__tests__/ — Component render tests
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
          │
          ▼
    StatsSummary × 4  (pre-computed in Dashboard constructor)
          │
          ▼
    Tab render(StatsSummary):
      Overview   → KpiCards + BarChart
      Languages  → RankedBarList (by lines)
      Models     → SortedTable (by cost)
      Projects   → RankedBarList (by cost, sessions)
      Usage      → Token StatCards + RankedBarList (by tool count)
```

## TUI Component Architecture

### Component Interface

Every component implements the pi-tui `Component` interface:

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

### Rendering Pipeline

1. `ctx.ui.custom()` calls the component's `render(width)` where `width` is the available TUI width
2. The render method returns terminal lines with ANSI styling applied
3. Components may cache their output: store `cachedLines` + `cachedWidth` and return cached result when `width` matches
4. `tui.requestRender()` signals the TUI to re-render (used after state changes from input handlers)
5. `DashboardPopup` wraps the Dashboard in a BorderBox, subtracting 2 from width (border chars) and 2 from line count (top + bottom borders)
6. The Dashboard subtracts `CHROME_ROWS` (11) from its terminal height to compute content area for tabs

### CHROME_ROWS (11 rows consumed by Dashboard framing)

| Row(s) | Element |
|--------|---------|
| 1-3 | Header (3 lines: BorderBox around RangeSelector) |
| 4 | Spacer |
| 5 | TabBar |
| 6 | Separator line (─) |
| 7+ | Active tab content (variable height) |
| -1 | Separator line (─) |
| 0 (last) | Footer: update label + controls hint |

### Keyboard Navigation

| Key | Action | Handled by |
|-----|--------|------------|
| ← → | Switch tabs | Dashboard → TabBar |
| r | Cycle time range | Dashboard |
| ↑ ↓ | Scroll table / navigate rows | Dashboard → active tab (if Models) |
| Esc / q | Close dashboard | Dashboard |
| Enter | No-op (consumed) | Dashboard / RangeSelector |

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

The cache is keyed by `width`. On terminal resize, the new `width` triggers a cache miss. Components are invalidated when their underlying data changes (range switch, tab switch, data reload).

### SortedTable Marquee Animation

The SortedTable on the Models tab uses `MarqueeText` to scroll overflowing model names. Each marquee cell runs a `setInterval` at 150ms, advancing the scroll offset by 1 character and calling `tui.requestRender()` to animate. Marquees are cleaned up when the focused row changes or the table is invalidated.

### Popup vs Full-Screen Mode

The Dashboard detects terminal size at open time:

- **Terminal ≥60 cols × 20 rows**: Shows as a centered overlay popup at 50% width, max 80% height, wrapped in a `DashboardPopup` (rounded border box).
- **Smaller terminal**: Full-screen mode, no border wrapping.

This is purely a layout decision — the same Dashboard component renders in both modes at different widths.

## Key Implementation Notes

### Content Measurement

Language statistics report **lines** — measured by splitting edited `newText` or written `content` by newline characters (`\n`). This is the number of lines added, not character length.

> **Note**: The current `parser.ts` `detectLanguage()` still counts character length (`edit.newText?.length`, `contentStr.length`). Language Count in CONTEXT.md defines the canonical behavior (newline-split). The parser needs a code update to match. See ~/Work/dev/pi-usage/src/parser.ts lines ~150-170.

### Cost Attribution

Cost from an assistant message is attributed to **all active projects** (unique project names from session entries parsed so far in the current `parseFile()` call). This means a session working on multiple projects attributes the same cost to each project. The global `sessionProjectMap` is reset at the start of each file parse.

### Provider Tracking

DayAgg tracks both `modelCost`/`modelCount` and `providerCost`/`providerCount`, plus a `modelToProvider` mapping. This allows the Models tab to show provider alongside model name.

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
