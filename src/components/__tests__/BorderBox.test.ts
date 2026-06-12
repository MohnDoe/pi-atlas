import { describe, it, expect } from "vitest";
import { Component } from "@earendil-works/pi-tui";
import { BorderBox } from "../BorderBox";

/** Simple mock child component that returns fixed lines. */
class MockChild implements Component {
  constructor(private lines: string[]) {}
  render(_width: number): string[] {
    return this.lines;
  }
  handleInput?(_data: string): void {}
  invalidate(): void {}
}

/** Strip ANSI escapes and test theme tags to get visible length. */
function vLen(s: string): number {
  return s
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/<[/]?(?:b|fg:[^>]+|bg:[^>]+)>/g, "")
    .length;
}

describe("BorderBox", () => {
  it("renders child content wrapped in rounded borders, padded to width", () => {
    const child = new MockChild(["Hello", "World"]);
    const box = new BorderBox({ child });
    const lines = box.render(10);

    expect(lines.length).toBe(4);

    // Each line exactly 10 visible chars
    for (const line of lines) {
      expect(vLen(line)).toBe(10);
    }

    // Top: ╭────────╮
    expect(lines[0]).toMatch(/^╭─{8}╮$/);

    // Content lines padded to inner width (8)
    expect(lines[1]).toMatch(/^│Hello\s{3}│$/);
    expect(lines[2]).toMatch(/^│World\s{3}│$/);

    // Bottom: ╰────────╯
    expect(lines[3]).toMatch(/^╰─{8}╯$/);
  });
});
