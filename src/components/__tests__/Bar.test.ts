import { describe, expect, it } from "bun:test";
import { renderBar } from "../shared/Bar.js";

describe("renderBar", () => {
  const filledStyle = (s: string) => s; // identity (no styling)
  const emptyStyle = (s: string) => s;

  it("renders full bar at 100%", () => {
    const result = renderBar(10, 100, filledStyle, emptyStyle);
    expect(result).toBe("■■■■■■■■■■");
  });

  it("renders empty bar at 0%", () => {
    const result = renderBar(10, 0, filledStyle, emptyStyle);
    expect(result).toBe("■■■■■■■■■■"); // all empty (no style difference with identity)
  });

  it("renders half bar at 50%", () => {
    // 50% of 10 = 5 filled, 5 empty
    const filled = (s: string) => `[${s}]`;
    const empty = (s: string) => `(${s})`;
    const result = renderBar(10, 50, filled, empty);
    expect(result).toBe("[■■■■■](■■■■■)");
  });

  it("applies filled style to filled portion and empty style to empty portion", () => {
    const filled = (s: string) => `F{${s}}`;
    const empty = (s: string) => `E{${s}}`;
    const result = renderBar(8, 75, filled, empty);
    expect(result).toBe("F{■■■■■■}E{■■}");
  });

  it("clamps fillPct to 0 when negative", () => {
    const result = renderBar(10, -20, filledStyle, emptyStyle);
    expect(result).toBe("■■■■■■■■■■"); // all empty
  });

  it("clamps fillPct to 100 when above 100", () => {
    const result = renderBar(10, 200, filledStyle, emptyStyle);
    expect(result).toBe("■■■■■■■■■■"); // all filled
  });

  it("clamps fillPct to 100 at exactly 100", () => {
    const filled = (s: string) => s;
    const empty = (s: string) => "x".repeat(s.length);
    const result = renderBar(5, 100, filled, empty);
    expect(result).toBe("■■■■■"); // all filled, no empty characters
  });

  it("handles zero width gracefully", () => {
    const result = renderBar(0, 50, filledStyle, emptyStyle);
    expect(result).toBe("");
  });

  it("handles negative width gracefully", () => {
    const result = renderBar(-5, 50, filledStyle, emptyStyle);
    expect(result).toBe("");
  });

  it("rounds fill count to nearest integer", () => {
    // 33.33% of 30 = 10 filled
    const result = renderBar(30, 33.33, filledStyle, emptyStyle);
    expect(result).toHaveLength(30);
    expect(result.slice(0, 10)).toBe("■■■■■■■■■■");
  });
});
