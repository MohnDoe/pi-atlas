import type { Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import { ColorPalette } from "../colorPalette";
import { type RangeOption, RangeSelector } from "../components/RangeSelector";

/**
 * Pass-through mock theme for tests. All styling methods return text unchanged.
 * Matches the pattern from rpiv-mono test-utils.
 */
export function makeTheme(overrides: Partial<Theme> = {}): Theme {
  return {
    fg: (_color, text) => text,
    bg: (_color, text) => text,
    bold: (text) => text,
    italic: (text) => text,
    underline: (text) => text,
    inverse: (text) => text,
    strikethrough: (text) => text,
    ...overrides,
  } as Theme;
}

export function testPalette(): ColorPalette {
  return new ColorPalette({});
}

/**
 * Mock TUI for tests. Only requestRender() is implemented as a no-op.
 * All other TUI methods are left undefined - they're never called in tests
 * that exercise MarqueeText or SortedTable marquee behavior.
 */
export function makeMockTUI(): TUI {
  return {
    requestRender() {},
    terminal: {
      get rows() {
        return 24;
      },
      get columns() {
        return 80;
      },
    },
  } as TUI;
}

export function makeRangeSelector(theme: Theme): RangeSelector {
  const rangeOptions: RangeOption[] = [
    { label: "Today", value: "1d" },
    { label: "Last 7 days", value: "7d" },
    { label: "Last 30 days", value: "30d" },
    { label: "All time", value: "All" },
  ];
  return new RangeSelector(theme, rangeOptions, rangeOptions.length - 1);
}
