import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import { makeMockTUI } from "../../__tests__/components.fixtures";
import { MarqueeText } from "../MarqueeText";

describe("MarqueeText", () => {
  let tui: ReturnType<typeof makeMockTUI>;

  beforeEach(() => {
    vi.useFakeTimers();
    tui = makeMockTUI();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders full text when it fits within width", () => {
    const mt = new MarqueeText("Hello", tui);
    const lines = mt.render(10);
    expect(lines).toEqual(["Hello"]);
  });

  it("renders truncated window when text overflows", () => {
    const mt = new MarqueeText("Hello World!", tui);
    // tick=0, offset=0 → first 5 chars
    const lines = mt.render(5);
    expect(lines[0]).toBe("Hello");
  });

  it("advances tick via timer and shows next window", () => {
    const mt = new MarqueeText("Hello World!", tui);
    mt.render(5); // timer starts

    // tick=0 → "Hello"
    expect(mt.render(5)[0]).toBe("Hello");

    // Advance 50ms = timer hasn't fired yet → still offset=0
    vi.advanceTimersByTime(50);
    expect(mt.render(5)[0]).toBe("Hello");

    // Advance 100ms more = 1 timer tick at 150ms → offset=1 → "ello "
    vi.advanceTimersByTime(100);
    expect(mt.render(5)[0]).toBe("ello ");
  });

  it("wraps around when reaching end of content", () => {
    const mt = new MarqueeText("ABCDEF", tui);
    mt.render(3);

    // Advance 600ms = 4 timer ticks → offset=4%11=4 → "EF "
    // (5-space gap after text shows first gap space at position 6)
    vi.advanceTimersByTime(600);
    expect(mt.render(3)[0]).toBe("EF ");
  });

  it("resets marquee to start", () => {
    const mt = new MarqueeText("Hello World!", tui);
    mt.render(5);
    vi.advanceTimersByTime(150); // 1 tick, offset=1
    expect(mt.render(5)[0]).toBe("ello ");

    mt.reset();
    expect(mt.render(5)[0]).toBe("Hello");
  });

  it("handles empty string", () => {
    const mt = new MarqueeText("", tui);
    expect(mt.render(5)).toEqual([""]);
  });

  it("handles exact fit (text.length === width)", () => {
    const mt = new MarqueeText("Hello", tui);
    expect(mt.render(5)).toEqual(["Hello"]);
  });
});
