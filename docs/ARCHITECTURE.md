# pi-atlas Architecture

## Module structure

```
src/
├── index.ts        — Extension entry point. Registers /atlas.
├── types.ts        — Shared types (DayAgg, StatsSummary, etc.)
├── parser.ts       — .jsonl → DayAgg[]. Global sessionProjectMap for cost attribution.
├── compute.ts      — summarize(): DayAgg[] × TimeRange → StatsSummary (pure).
├── cache.ts        — loadAggregate(): try SHA-256-keyed cache, fall back to parse.
├── format.ts       — Cost/number/date formatters + language detection (EXT_TO_LANG).
├── colorPalette.ts — chalk color lookups per language and per provider.
├── components/     — TUI components (Dashboard, SortedTable, cells, BarChart, etc.)
├── tabs/           — Five tab implementations (Overview, Languages, Models, Projects, Usage).
└── __tests__/      — Tests mirror src layout.
```

## Data pipeline

```
.jsonl files → parseFile() → DayAgg[] (per calendar day)
                                   ↓
                             summarize(days, range)
                                   ↓
                    StatsSummary × 4 (pre-computed for 1d/7d/30d/All)
                                   ↓
                          Tab receives relevant StatsSummary
```

All four ranges are computed up front (see [ADR-0002](../docs/adr/0002-precomputed-summaries.md)). `StatsSummary` is passed as a `Map<TimeRange, StatsSummary>`; tabs don't re-compute on range changes.

## Component hierarchy

```
Dashboard (extends BorderBox from @mohndoe/pi-tui-extras)
├── TabBar                 (←→ navigation)
├── separator
├── active tab content      (one of: Overview, Languages, Models, Projects, Usage)
├── separator
└── controls hint
```

- **Dashboard** always renders as a centered overlay popup (50% width, max 80% height).
- Title bar shows app name (left) + current range label (right). Footer shows update timestamp + controls hint.
- Tabs extend `Container` (from `@earendil-works/pi-tui`), which implements `Component`.
- Every tab wraps its content in one or more `BorderBox` instances (from `@mohndoe/pi-tui-extras`).
- The **SortedTable** (used by Languages, Models, Projects, Usage) delegates cell rendering to `cells.ts` — a factory of `CellComponent` types: `text`, `header` (with sort indicators), `marquee` (auto-scroll), `bar` (horizontal bar).

### Chrome

Dashboard calculates tab content height as: `floor(terminal.rows × 0.8) - chrome rows - 2`. Chrome rows: TabBar + separator + separator + footer = ~4. The exact number is a local constant.

## Key design decisions

**Cost attribution** — cost from an assistant message is attributed to all active projects seen in the current file (see [ADR-0001](../docs/adr/0001-global-session-project-map.md)).

**Pre-computed summaries** — four `StatsSummary` values are computed when the Dashboard opens, making tab switches instant (see [ADR-0002](../docs/adr/0002-precomputed-summaries.md)).

**Session log parsing** — eight JSONL entry types are handled (session, user/assistant/tool-result messages, model change, thinking level change, compaction). Branch summary, custom, custom message, label, and session info entries are skipped.

**Language counting** — lines measured by splitting on `\n`, not character length.

**Cache** — SHA-256 of file paths/sizes/mtimes. Deterministic (sorted paths). Rebuilds silently on corruption.

**RangeSelector** — accepts `RangeOption[]` from caller. Labels: "Today", "Last 7 days", "Last 30 days", "All time". The `r` key cycles through them.
