import type { StatsTheme } from "../types";

export function testTheme(): StatsTheme {
  return {
    fg: (color, text) => `<fg:${color}>${text}</fg:${color}>`,
    bg: (color, text) => `<bg:${color}>${text}</bg:${color}>`,
    bold: (text) => `<b>${text}</b>`,
  };
}

export function visibleLength(s: string): number {
  // Strip both real ANSI and test theme tags
  return s.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[/]?(?:b|fg:[^>]+|bg:[^>]+)>/g, "").length;
}
