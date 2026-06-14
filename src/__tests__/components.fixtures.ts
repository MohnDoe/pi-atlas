import type { Theme } from "@earendil-works/pi-coding-agent";
import { ColorPalette } from "../colorPalette.js";

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
