import { describe, expect, it } from "vitest";
import { MarqueeText } from "../MarqueeText";

describe("MarqueeText", () => {
  it("renders full text when it fits within width", () => {
    const mt = new MarqueeText("Hello");
    const lines = mt.render(10);
    expect(lines).toEqual(["Hello"]);
  });

  it("renders truncated window when text overflows", () => {
    const mt = new MarqueeText("Hello World!");
    // tick=0, offset=0 → first 5 chars
    const lines = mt.render(5);
    expect(lines[0]).toBe("Hello");
  });

  it("advances tick and shows next window", () => {
    const mt = new MarqueeText("Hello World!");
    // tick=0 → "Hello"
    expect(mt.render(5)[0]).toBe("Hello");

    // tick=1-2 → still offset=0 (floor(tick/3)=0)
    mt.advance();
    expect(mt.render(5)[0]).toBe("Hello");
    mt.advance();
    expect(mt.render(5)[0]).toBe("Hello");

    // tick=3 → offset=1 → "ello "
    mt.advance();
    expect(mt.render(5)[0]).toBe("ello ");
  });

  it("wraps around when reaching end of content", () => {
    const mt = new MarqueeText("ABCDEF");
    // Advance to tick=12 → offset=floor(12/3)%6=4 → "EFA"
    for (let i = 0; i < 12; i++) mt.advance();
    expect(mt.render(3)[0]).toBe("EFA");
  });

  it("resets marquee to start", () => {
    const mt = new MarqueeText("Hello World!");
    mt.advance();
    mt.advance();
    mt.advance();
    expect(mt.render(5)[0]).toBe("ello ");

    mt.reset();
    expect(mt.render(5)[0]).toBe("Hello");
  });

  it("handles empty string", () => {
    const mt = new MarqueeText("");
    expect(mt.render(5)).toEqual([""]);
  });

  it("handles exact fit (text.length === width)", () => {
    const mt = new MarqueeText("Hello");
    expect(mt.render(5)).toEqual(["Hello"]);
  });
});
