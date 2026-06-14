import type { Theme } from "@earendil-works/pi-coding-agent";
import type { StatsTheme } from "../types";
import { ColorPalette } from "../colorPalette.js";

const FG_CODES: Record<string, string> = {
  accent: "\x1b[36m",
  dim: "\x1b[2m",
  muted: "\x1b[90m",
  borderMuted: "\x1b[90m",
  success: "\x1b[32m",
  border: "\x1b[34m",
  borderAccent: "\x1b[96m",
  warning: "\x1b[33m",
  error: "\x1b[31m",
  text: "\x1b[37m",
};

const BG_CODES: Record<string, string> = {
  selectedBg: "\x1b[48;5;236m",
};

export function testTheme(): StatsTheme {
  return {
    fg: (color, text) => `${FG_CODES[color] ?? ""}${text}\x1b[39m`,
    bg: (color, text) => `${BG_CODES[color] ?? ""}${text}\x1b[49m`,
    bold: (text) => `\x1b[1m${text}\x1b[22m`,
  };
}

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

export function visibleLength(s: string): number {
  // Strip ANSI escapes (both real and test-generated)
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}
