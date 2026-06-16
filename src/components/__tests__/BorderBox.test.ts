import { describe, it, expect } from "vitest";
import { Component } from "@earendil-works/pi-tui";
import { BorderBox } from "../BorderBox";
import { makeTheme } from "../../__tests__/components.fixtures";

/** Simple mock child component that returns fixed lines. */
class MockChild implements Component {
  inputLog: string[] = [];
  invalidateCount = 0;

  constructor(private lines: string[]) {}
  render(_width: number): string[] {
    return this.lines;
  }
  handleInput(data: string): void {
    this.inputLog.push(data);
  }
  invalidate(): void {
    this.invalidateCount++;
  }
}

/** Strip ANSI escapes and test theme tags to get visible length. */
function vLen(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").replace(/<[/]?(?:b|fg:[^>]+|bg:[^>]+)>/g, "").length;
}

describe("BorderBox", () => {
  it("renders child content wrapped in rounded borders, padded to width", () => {
    const child = new MockChild(["Hello", "World"]);
    const box = new BorderBox({ child }, makeTheme());
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

  it("embeds title in the top border", () => {
    const child = new MockChild(["content"]);
    const box = new BorderBox({ child, title: "Stats" }, makeTheme());
    const lines = box.render(20);

    // Top border should contain "Stats" with decoration
    expect(lines[0]).toMatch(/╭─\sStats\s─/);
  });

  it("embeds footer in the bottom border", () => {
    const child = new MockChild(["content"]);
    const box = new BorderBox({ child, footer: "Esc close" }, makeTheme());
    const lines = box.render(22);

    expect(lines[lines.length - 1]).toMatch(/╰─\sEsc close\s─/);
  });

  it("uses straight corners when rounded=false", () => {
    const child = new MockChild(["x"]);
    const box = new BorderBox({ child, rounded: false }, makeTheme());
    const lines = box.render(6);

    expect(lines[0]).toMatch(/^┌/);
    expect(lines[0]).toMatch(/┐$/);
    expect(lines[2]).toMatch(/^└/);
    expect(lines[2]).toMatch(/┘$/);
  });

  it("delegates handleInput to child", () => {
    const child = new MockChild([]);
    const box = new BorderBox({ child }, makeTheme());

    box.handleInput("r");

    expect(child.inputLog).toEqual(["r"]);
  });

  it("caches render output and invalidates on width change or explicit call", () => {
    const child = new MockChild(["line"]);
    const box = new BorderBox({ child }, makeTheme());

    const first = box.render(20);
    expect(box.render(20)).toBe(first); // cached

    const second = box.render(30);
    expect(second).not.toBe(first); // width changed

    box.invalidate();
    expect(child.invalidateCount).toBe(1);
    expect(box.render(30)).not.toBe(second); // cache cleared
  });
});
