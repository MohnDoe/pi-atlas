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

  describe("paddingX", () => {
    it("defaults to 0 — backward compatible", () => {
      const child = new MockChild(["Hello"]);
      const box = new BorderBox({ child }, makeTheme());
      const lines = box.render(10);

      expect(lines[1]).toMatch(/^│Hello\s{3}│$/);
    });

    it("indents content from both sides", () => {
      const child = new MockChild(["Hi"]);
      const box = new BorderBox({ child, paddingX: 2 }, makeTheme());
      const lines = box.render(12);

      // innerWidth = 10, childInnerWidth = 10 - 4 = 6
      // content: 2 spaces + "Hi" + 2 spaces (child pad) + 2 spaces (paddingX right) = 10
      expect(vLen(lines[1])).toBe(12);
      expect(lines[1]).toMatch(/^│\s{2}Hi\s{6}│$/);
    });

    it("child renders at narrower width", () => {
      let childWidth = 0;
      const child = new (class implements Component {
        render(w: number): string[] {
          childWidth = w;
          return ["ok"];
        }
        handleInput(_: string): void {}
        invalidate(): void {}
      })();
      const box = new BorderBox({ child, paddingX: 3 }, makeTheme());
      box.render(20); // innerWidth = 18, childInnerWidth = 18 - 6 = 12
      expect(childWidth).toBe(12);
    });
  });

  describe("paddingY", () => {
    it("defaults to 0 — backward compatible", () => {
      const child = new MockChild(["Hello"]);
      const box = new BorderBox({ child }, makeTheme());
      expect(box.render(10).length).toBe(3); // top + 1 content + bottom
    });

    it("adds blank lines above and below content", () => {
      const child = new MockChild(["Hello"]);
      const box = new BorderBox({ child, paddingY: 1 }, makeTheme());
      const lines = box.render(10);

      expect(lines.length).toBe(5); // top + padY + content + padY + bottom
      expect(lines[0]).toMatch(/^╭─{8}╮$/); // top
      expect(lines[1]).toMatch(/^│\s{8}│$/); // blank (padY top)
      expect(lines[2]).toMatch(/^│Hello\s{3}│$/); // content
      expect(lines[3]).toMatch(/^│\s{8}│$/); // blank (padY bottom)
      expect(lines[4]).toMatch(/^╰─{8}╯$/); // bottom
    });

    it("skips paddingY when child renders no lines", () => {
      const child = new MockChild([]);
      const box = new BorderBox({ child, paddingY: 2 }, makeTheme());
      const lines = box.render(10);

      expect(lines.length).toBe(2); // just top + bottom
      expect(lines[0]).toMatch(/^╭─{8}╮$/);
      expect(lines[1]).toMatch(/^╰─{8}╯$/);
    });

    it("works with multiple paddingY lines", () => {
      const child = new MockChild(["x"]);
      const box = new BorderBox({ child, paddingY: 3 }, makeTheme());
      const lines = box.render(10);

      expect(lines.length).toBe(9); // top + 3 padY top + 1 content + 3 padY bottom + bottom
      for (let i = 0; i < 3; i++) {
        expect(lines[1 + i]).toMatch(/^│\s{8}│$/); // padY top
      }
      expect(lines[4]).toMatch(/^│x\s{7}│$/); // content
      for (let i = 0; i < 3; i++) {
        expect(lines[5 + i]).toMatch(/^│\s{8}│$/); // padY bottom
      }
    });
  });

  describe("combined paddingX and paddingY", () => {
    it("applies both indentation and vertical spacing", () => {
      const child = new MockChild(["Hello", "World"]);
      const box = new BorderBox({ child, paddingX: 1, paddingY: 1 }, makeTheme());
      const lines = box.render(12);

      // innerWidth = 10, childInnerWidth = 10 - 2 = 8
      expect(lines.length).toBe(6); // top + padY + 2 content + padY + bottom
      expect(lines[0]).toMatch(/^╭─{10}╮$/); // top
      expect(lines[1]).toMatch(/^│\s{10}│$/); // padY top
      expect(lines[2]).toMatch(/^│\sHello\s{4}│$/); // indent 1 + "Hello" + 4 spaces
      expect(lines[3]).toMatch(/^│\sWorld\s{4}│$/); // indent 1 + "World" + 4 spaces
      expect(lines[4]).toMatch(/^│\s{10}│$/); // padY bottom
      expect(lines[5]).toMatch(/^╰─{10}╯$/); // bottom
    });
  });

  describe("caching with padding", () => {
    it("caches render output when padding params are used", () => {
      const child = new MockChild(["line"]);
      const box = new BorderBox({ child, paddingX: 2, paddingY: 1 }, makeTheme());

      const first = box.render(20);
      expect(box.render(20)).toBe(first); // cached

      const second = box.render(30);
      expect(second).not.toBe(first); // width changed

      box.invalidate();
      expect(box.render(30)).not.toBe(second); // cache cleared
    });
  });
});
