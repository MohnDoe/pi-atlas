# Migrate BorderBox to @mohndoe/pi-tui-extras

## Context

`src/components/BorderBox.ts` is a wrapper around `@mohndoe/pi-tui-extras`'s `BorderBox`. The user wants to replace all internal usage with direct imports from the package, then delete the old files.

## Approach

Replace every `import { BorderBox } from "./BorderBox"` with `import { BorderBox } from "@mohndoe/pi-tui-extras"` and update each call site from the old API `new BorderBox({ child, title, footer, rounded, color, paddingX, paddingY }, theme)` to the package API `new BorderBox(child, { titles, footers, borderStyle, borderColor, padding })`.

### API mapping

| Our wrapper | Package API |
|---|---|
| `new BorderBox(opts, theme)` | `new BorderBox(child, options)` |
| `child` | first positional arg |
| `title: string` | `titles: [{ text, align: "left" }]` |
| `footer: string` | `footers: [{ text, align: "left" }]` |
| `rounded: boolean` | `borderStyle: "singleRounded" \| "single"` |
| `color: ThemeColor` | `borderColor: (s) => theme.fg(color, s)` |
| `color: ChalkInstance` | `borderColor: chalkFn` |
| `paddingX: number` | `padding: { left: x, right: x }` |
| `paddingY: number` | `padding: { top: y, bottom: y }` |

## Files to modify

### Remove
- `src/components/BorderBox.ts`
- `src/components/__tests__/BorderBox.test.ts`

### Update imports + constructor calls
- `src/components/DashboardPopup.ts` — 1 usage
- `src/components/Header.ts` — 1 usage
- `src/components/KpiCards.ts` — 6 usages
- `src/tabs/Overview.ts` — 4 usages
- `src/tabs/Usage.ts` — 1 usage

## Steps

- [ ] **DashboardPopup.ts** — Replace import, update constructor call
- [ ] **Header.ts** — Replace import, update constructor call
- [ ] **KpiCards.ts** — Replace import, update 6 constructor calls
- [ ] **Overview.ts** — Replace import, update 4 constructor calls
- [ ] **Usage.ts** — Replace import, update 1 constructor call
- [ ] Delete `src/components/BorderBox.ts`
- [ ] Delete `src/components/__tests__/BorderBox.test.ts`
- [ ] Run typecheck + tests

## Verification

- `bun run typecheck` passes
- All existing 347 tests pass
- No references to `./BorderBox` remain in source files
