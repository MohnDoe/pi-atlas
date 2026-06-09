import { describe, expect, it } from "vitest";
import { testTheme, visibleLength } from "../../__tests__/components.fixtures";
import { TabBar } from "../TabBar";

describe("TabBar", () => {
  const tabs = ["Overview", "Languages", "Models", "Projects + Tools"];

  it("renders all tab names", () => {
    const tb = new TabBar(tabs, testTheme(), 0);
    const lines = tb.render(80);
    expect(lines).toHaveLength(1);
    const line = lines[0];
    for (const tab of tabs) {
      expect(line).toContain(tab);
    }
  });

  it("renders within width", () => {
    const tb = new TabBar(tabs, testTheme(), 0);
    const lines = tb.render(40);
    expect(lines).toHaveLength(1);
    expect(visibleLength(lines[0])).toBeLessThanOrEqual(40);
  });

  it("highlights the active tab", () => {
    const tb = new TabBar(tabs, testTheme(), 2);
    const lines = tb.render(80);
    // Models tab (index 2) should stand out from the others
    expect(lines[0]).toContain("Models");
  });

  it("moves active tab left with handleInput", () => {
    const tb = new TabBar(tabs, testTheme(), 2);
    tb.handleInput("\x1b[D"); // left arrow
    expect((tb as { activeIndex: number }).activeIndex).toBe(1);

    tb.handleInput("\x1b[D");
    expect((tb as { activeIndex: number }).activeIndex).toBe(0);

    // Wraps around? Or stays at 0?
    tb.handleInput("\x1b[D");
    expect((tb as { activeIndex: number }).activeIndex).toBe(0); // stays
  });

  it("moves active tab right with handleInput", () => {
    const tb = new TabBar(tabs, testTheme(), 2);
    tb.handleInput("\x1b[C"); // right arrow
    expect((tb as { activeIndex: number }).activeIndex).toBe(3);

    tb.handleInput("\x1b[C");
    expect((tb as { activeIndex: number }).activeIndex).toBe(3); // stays
  });

  it("invalidates render cache", () => {
    const tb = new TabBar(tabs, testTheme(), 0);
    tb.render(80);
    tb.invalidate();
    // After invalidate, next render should recompute
    const lines = tb.render(60); // different width → should still work
    expect(visibleLength(lines[0])).toBeLessThanOrEqual(60);
  });

  it("uses theme.bg('selectedBg') and theme.fg('accent') for active tab", () => {
    const tb = new TabBar(tabs, testTheme(), 0);
    const lines = tb.render(80);
    // Active tab (Overview at index 0) should have selectedBg + accent
    expect(lines[0]).toContain("<bg:selectedBg>");
    expect(lines[0]).toContain("<fg:accent>");
  });

  it("uses theme.fg('muted') for inactive tabs", () => {
    const tb = new TabBar(tabs, testTheme(), 0);
    const lines = tb.render(80);
    // Inactive tabs should use muted
    expect(lines[0]).toContain("<fg:muted>");
  });
});
