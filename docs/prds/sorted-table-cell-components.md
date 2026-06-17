# PRD: Composable Cell Components for SortedTable

## Problem Statement

The Models tab's SortedTable is rigid — every cell is a raw string. There's no way to add colors, progress bars, badges, or other visual styling within cells. The only customization point is the `marquee` flag on `ColumnDef`. Adding a progress bar or colored provider badge would require either forking the table or hacking ANSI escapes into the raw strings.

The root cause: rows are configured as `string[][]` — each cell is a text value described by column metadata. The user has to format everything upfront into plain strings, losing the ability to mix visual types within a column.

## Solution

Replace `string[][]` rows with `CellComponent[][]` — each cell is an object with a `render()` method. Ship a factory DSL (`cell.text`, `cell.marquee`, `cell.header`) for creating cells. Consumers compose cells from factory methods instead of formatting strings.

This shifts from **configuration** (tell the table what the cell should show) to **composition** (give the table a component that knows how to render itself). New cell types can be added without touching the table.

## User Stories

1. As a user of the Models tab, I want provider names to appear in colored badges, so that I can visually distinguish providers at a glance.

2. As a user of the Models tab, I want long model names to scroll (marquee) when focused, so that I can read the full name in a narrow column.

3. As a user of any tab, I want the table header to show the sort direction (▲/▼), so that I know which column drives the ordering.

4. As a developer adding a new tab with a SortedTable, I want to build table rows using composable cell factories, so that I don't have to pre-format all cell text into strings.

5. As a developer, I want to add a progress bar cell type (e.g. `cell.bar(value)`), so that I can visualize proportional data within a table column.

6. As a developer, I want to add new cell types without modifying the SortedTable class, so that the table remains extensible.

7. As a developer, I want cells to receive focus state (`isFocused`) during render, so that I can create custom focus behaviors (e.g., marquee animation, stat changes on focus).

8. As a developer, I want marquee animation to be a cell-level concern rather than a column-level flag, so that I can mix marquee and non-marquee cells within the same column across different rows.

9. As a maintainer, I want marquee intervals to be properly cleaned up when the table is replaced (range switch), so that zombie intervals don't accumulate.

## Implementation Decisions

### CellComponent interface

All cells implement a single interface:

```
CellComponent {
  render(width: number, state: CellState): string
  invalidate(): void
}

CellState {
  isFocused: boolean
  sortDirection: "asc" | "desc" | null
}
```

- `render()` returns exactly one ANSI-styled terminal line
- `isFocused` is used by data cells (marquee animation, focus styling)
- `sortDirection` is used by header cells (sort indicator ▲/▼)
- `invalidate()` clears any held resources (marquee intervals)

### Cell factory DSL

A `cell` object provides factory methods for creating CellComponent instances:

- `cell.text(content)` — renders styled text. Content is pre-styled by the consumer (via theme.fg, chalk, bold, etc.). No styling logic in the factory.
- `cell.marquee(content, tui)` — renders scrolling animation when focused. Creates MarqueeText internally. Calls `tui.requestRender()` on animation ticks. Shows ellipsis when unfocused.
- `cell.header(content)` — renders text with sort indicator (▲/▼) appended when that column is the sort key. Uses `visibleWidth()` and `truncateToWidth()` from pi-tui for ANSI-aware width handling.
- `cell.bar(value, color?)` — renders a horizontal progress bar. Future cell type seeded by the DSL.

### SortedTable changes

- `rows` config changes from `string[][]` to `CellComponent[][]`
- `ColumnDef` loses the `marquee` flag (marquee is now a cell type, not a column property)
- `ColumnDef.header` changes from `string` to `CellComponent` (column headers are cells that receive sort state)
- No render cache — table recomputes lines every render call. TUI's differential rendering handles terminal write optimization.
- No `setRows()` method — table is replaced on data change (existing `buildTabs()` behavior)
- `invalidate()` propagates to all cells via `cell.invalidate()`
- Uses `visibleWidth()` and `truncateToWidth()` from pi-tui for ANSI-aware padding and truncation
- Row highlight (cursor prefix + selectedBg background) remains owned by the table

### Lifecycle

- Dashboard `buildTabs()` calls `invalidate()` on old tabs before reassigning `this.tabs`, which triggers `SortedTable.invalidate()` → each cell clears intervals
- On range switch: old tab is invalidated, new tab is constructed with fresh cells
- Between range switches: table instance persists, cells reuse internal state (marquee offset survives across renders)

### Cell factory placement

`cell` factory DSL is exported from a new `cells.ts` module alongside the component tree, separate from `SortedTable.ts`.

## Testing Decisions

### What makes a good test

Test external behavior: what renders. Don't test internal cell implementation details. A cell component is a seam — give it input (width, state) and assert output (string with expected content). Don't test which class was instantiated.

### Test seams (highest first)

1. **Models tab tests** (`src/tabs/__tests__/Models.test.ts`) — integration test. Construct Models with ModelStat[], assert rendered output contains formatted model names, provider, costs, cursor, sort indicator. Already the highest seam — minimal changes.

2. **SortedTable component tests** (`src/components/__tests__/SortedTable.test.ts`) — direct unit tests. Construct table with CellComponent[][] rows. Test: header rendering with sort indicators, data row rendering, cursor navigation, scrolling, width resolution, empty state. Marquee tests use `cell.marquee()` instead of ColumnDef flag.

3. **Cells unit tests** (`src/components/__tests__/cells.test.ts`) — test individual cell types: `cell.text()` renders within width, `cell.marquee()` animates on focus / shows ellipsis when unfocused / clears interval on invalidate, `cell.header()` renders sort indicators from CellState.

### Prior art

Existing SortedTable tests already test rendering, scrolling, cursor, marquee, and sort indicators. The new tests follow the same patterns — construct, render, assert output lines. The Models tab tests already test formatted model names and costs — they'll be updated to match the new cell-based output.

## Out of Scope

- Adding `cell.bar()` or other new cell types beyond the ones needed for the Models tab migration. The DSL is designed to be extended, but only `text`, `marquee`, and `header` are implemented.
- The Languages, Projects, and Usage tabs remain on RankedBarList. No SortedTable migration for them.
- SortedTable sorting by column click or mouse interaction. Sort is defined via config and displayed via header indicators only.
- Keyboard-driven column resize. Column widths are set at construction via ColumnDef.

## Further Notes

- The pi-tui framework's TUI class handles differential rendering at the terminal level — only changed lines are written. This means per-cell caching is optional, not required. The SortedTable recomputes every render call without a table-level cache.
- Marquee animation uses `setInterval` at 150ms, calling `tui.requestRender()` each tick. This is the same mechanism as the current MarqueeText component.
- The `invalidate()` lifecycle fix in `Dashboard.buildTabs()` addresses an existing leak in the current code (zombie marquee intervals survive range switches). The leak is cosmetic (intervals call `requestRender` on a live TUI) but worth fixing while we're in this area.
