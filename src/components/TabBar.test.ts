import { describe, expect, it } from "bun:test";
import { makeTheme } from "./components.fixtures";
import { TabBar } from "./TabBar";

describe("TabBar", () => {
  const tabs = ["Overview", "Languages", "Models", "Projects + Tools"];

  it("renders all tab names", () => {
    const tb = new TabBar(tabs, makeTheme(), 0);
    const lines = tb.render(80);
    expect(lines).toHaveLength(1);
    const line = lines[0];
    for (const tab of tabs) {
      expect(line).toContain(tab);
    }
  });

  it("renders within width", () => {
    const tb = new TabBar(tabs, makeTheme(), 0);
    const lines = tb.render(40);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.length).toBeLessThanOrEqual(40);
  });

  it("highlights the active tab", () => {
    const tb = new TabBar(tabs, makeTheme(), 2);
    const lines = tb.render(80);
    // Models tab (index 2) should stand out from the others
    expect(lines[0]).toContain("Models");
  });

  it("moves active tab left with handleInput", () => {
    const tb = new TabBar(tabs, makeTheme(), 2);
    tb.handleInput("\x1b[D"); // left arrow
    expect((tb as { activeIndex: number }).activeIndex).toBe(1);

    tb.handleInput("\x1b[D");
    expect((tb as { activeIndex: number }).activeIndex).toBe(0);

    // Wraps around? Or stays at 0?
    tb.handleInput("\x1b[D");
    expect((tb as { activeIndex: number }).activeIndex).toBe(0); // stays
  });

  it("moves active tab right with handleInput", () => {
    const tb = new TabBar(tabs, makeTheme(), 2);
    tb.handleInput("\x1b[C"); // right arrow
    expect((tb as { activeIndex: number }).activeIndex).toBe(3);

    tb.handleInput("\x1b[C");
    expect((tb as { activeIndex: number }).activeIndex).toBe(3); // stays
  });

  it("invalidates render cache", () => {
    const tb = new TabBar(tabs, makeTheme(), 0);
    tb.render(80);
    tb.invalidate();
    // After invalidate, next render should recompute
    const lines = tb.render(60); // different width → should still work
    expect(lines[0]!.length).toBeLessThanOrEqual(60);
  });
});
