# PRD: Theme-Aware Semantic Colors for pi-usage Dashboard

**Status:** Draft / Considering
**Labels:** considering

## Problem Statement

The pi-usage dashboard (`/stats` command) currently uses a mix of methods for colors:
- A thin `StatsTheme` interface wrapping pi's `Theme` class for some colors (accent, muted, dim, borderMuted, selectedBg)
- Direct `chalk` function calls scattered across components for others (StatCard accent values, progress bar text, header title, token values)
- Hardcoded hex colors (`chalk.hex("#a0dcfd")`) in the Usage tab

This inconsistency means:
- When the user changes pi's theme (e.g., from dark to light), parts of the dashboard adapt but others don't
- Developers must know both pi's theme API and chalk to contribute
- No single source of truth for "what does a good/warning/error value look like in this theme"

## Solution

Replace all direct `chalk` usage in dashboard components with calls to pi's `Theme` object (`theme.fg()`, `theme.bg()`, `theme.bold()`). Introduce semantic color name conventions (good, info, warning, error, accent) that map to pi's existing 51-token theme system. The dashboard will fully adapt to any pi theme automatically.

### Color Mapping

| Semantic Name | pi Theme Token | Use Case |
|---|---|---|
| `accent` | `accent` | Tab active, bar chart bars, table headers, KPIs |
| `muted` | `muted` | Subtitles, secondary labels, empty states |
| `dim` | `dim` | X-axis labels, status bar, percentage text |
| `borderMuted` | `borderMuted` | Divider lines (─) |
| `selectedBg` | `selectedBg` | Tab active background, table header background |
| `good` | `success` | Positive values (cost, totals) |
| `info` | `accent` (reuse) | Informational values (token counts, session counts) |
| `warning` | `warning` | Warning indicators |
| `error` | `error` | Error indicators |
| `text` | `text` | Default text (via bold, not fg) |

### Architecture

- **No new dependencies.** pi's `Theme` class is already available via `ctx.ui.custom()`.
- **No new global state.** Theme is passed through the component tree as a parameter.
- **Chalk remains** only for language-specific and model-provider colors (langPalette, modelPalette), and for progress bar colors in RankedBarList/UsageRow.

## User Stories

1. As a pi-usage user, I want the dashboard's green/blue/yellow values to match whatever pi theme I've selected, so the dashboard looks consistent with the rest of pi.

2. As a pi-usage user using a light terminal theme, I want the entire dashboard (not just parts of it) to be readable and properly colored, so I don't get blinding white-on-light or unreadable low-contrast areas.

3. As a pi-usage developer, I want to use `theme.fg("good", value)` instead of `chalk.green(value)`, so I don't have to think about whether a color will look right in both light and dark themes.

4. As a pi-usage developer, I want the StatCard component to accept a theme color name rather than a chalk function, so KPI accent colors adapt to the theme automatically.

5. As a pi-usage developer, I want the UsageRow component to receive the theme and use it for text styling, so progress bar percentages and labels follow the theme even though the bar color is still data-driven.

6. As a pi-usage developer, I want the Header component to use theme methods instead of hardcoded chalk, so the title and version text follow theme settings.

7. As a pi-usage developer, I want existing tests to pass with minimal changes — only adding `testTheme()` where RankedBarList now requires it — so the refactor doesn't introduce regressions.

8. As a pi-usage developer, I want the `StatsTheme` interface to remain stable (same method signatures), so existing component patterns don't need rewriting.

## Implementation Decisions

1. **StatCard replaces `accentFn: ChalkInstance` with `accentColor: string`.** The component applies `theme.fg(accentColor, value)` instead of calling a chalk function. Defaults to `"accent"` when no color is provided.

2. **KpiCards maps hardcoded chalk colors to theme color names:**
   - `chalk.green` → `"good"`
   - `chalk.blue` → `"info"`
   - `chalk.magenta` → `"accent"`
   - `chalk.yellow` → `"warning"`
   - `chalk.cyan` → `"info"`
   - `chalk.red` → `"error"`

3. **UsageRow receives `theme: StatsTheme` via RankedBarList.** Replaces:
   - `chalk.bold(name)` → `theme.bold(name)`
   - `chalk.dim(secondaryValueText)` → `theme.fg("muted", secondaryValueText)`
   - `chalk.bold(mainValueText)` → `theme.bold(mainValueText)`
   - `chalk.dim(pctString)` → `theme.fg("dim", pctString)`
   - `chalk.gray(bar remainder)` → `theme.fg("dim", bar remainder)`

4. **RankedBarList gains a `theme` constructor parameter.** Passes it through to each UsageRow instance on render.

5. **Header receives `theme` constructor parameter.** Replaces `chalk.bold("Pi Usage")` with `theme.bold("Pi Usage")` and `chalk.dim("v 0.0.1")` with `theme.fg("dim", "v 0.0.1")`.

6. **Dashboard passes theme to Header.** Already passes theme to other children.

7. **Usage tab replaces `chalk.hex("#a0dcfd")` with theme color name `"info"` for token StatCards.**

8. **Projects tab keeps `chalk.white` as-is for progress bar color.** The bar color for projects is a ChalkInstance (per-item data color), not a theme color. Projects are text-colored by convention, and `chalk.white` approximates this on dark terminals.

9. **Languages and Models tabs pass theme through to RankedBarList.** They already receive theme from Dashboard.

10. **Chalk dependency remains** for langPalette, modelPalette, and RankedBarItem bar colors. These are data-driven colors (per-language, per-model-provider), not theme colors.

## Testing Decisions

A good test verifies external behavior: that the rendered output contains the expected text and color markers. It does not assert implementation details like which method was called or the internal state of a component.

### Seams

1. **Highest seam: Dashboard integration test (`Dashboard.test.ts`)** — Tests that mock `testTheme()` color tags (<fg:muted>, <fg:accent>, <fg:dim>, <fg:borderMuted>) appear in rendered output for all sections. `testTheme()` wraps text in `<fg:colorName>...</fg:colorName>` tags, making color usage visible in test assertions.

2. **Component seams:**
   - `KpiCards.test.ts` — Exercises StatCard with theme color names. Already uses `testTheme()`.
   - `Header.test.ts` — Exercises theme methods for title/version. Already uses `testTheme()`.
   - `RankedBarList.test.ts` — Needs `testTheme()` added when constructing RankedBarList.
   - `Overview.test.ts` — Exercises full overview tab rendering. Already uses `testTheme()`.

3. **Tab seams:**
   - `Languages.test.ts` — Exercises RankedBarList with theme. Already uses `testTheme()`.
   - `Models.test.ts` — Same pattern as Languages.

### Prior Art

All existing tests use a `testTheme()` mock from `src/__tests__/components.fixtures.ts` that wraps text in faux ANSI tags. This pattern continues for the refactor — no new testing infrastructure needed.

### New Test Considerations

No new test modules are needed. The existing tests at the Dashboard and component level provide adequate coverage. The key change is that `RankedBarList.test.ts` needs a `testTheme()` parameter added to its constructor calls.

## Out of Scope

- Creating new theme variants or theme files. The dashboard follows pi's built-in theme.
- Adding theme cycling or persistence to the dashboard (users change pi's theme, not the dashboard's).
- Porting the web frontend CSS themes (separate effort if needed).
- Changing the language/model palette system (stays chalk-based).

## Further Notes

This is a pure refactor — no visual changes for the default theme. The benefit is that when users switch pi's theme (e.g., to a light theme or a custom one), the entire dashboard adapts automatically instead of having colored pockets that ignore the theme.
