import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { makeMockTUI } from "../../__tests__/components.fixtures.js";
import { cell } from "../cells.js";

describe("cell.text", () => {
  it("renders content truncated to width", () => {
    const c = cell.text("Hello World");
    const result = c.render(5);
    expect(result).toBe(truncateToWidth("Hello World", 5, ""));
  });

  it("returns exact line when content fits within width", () => {
    const c = cell.text("Hi");
    const result = c.render(10);
    expect(result).toBe(truncateToWidth("Hi", 10, ""));
  });

  it("handles empty content", () => {
    const c = cell.text("");
    const result = c.render(10);
    expect(result).toBe("");
  });

  it("handles zero width", () => {
    const c = cell.text("Hello");
    const result = c.render(0);
    expect(result).toBe("");
  });
});

describe("cell.header", () => {
  it("appends ▲ when sortDirection is asc", () => {
    const c = cell.header("Name");
    const result = c.render(10, { sortDirection: "asc" });
    expect(result).toBe(truncateToWidth("Name", 8, "") + " ▲");
  });

  it("appends ▼ when sortDirection is desc", () => {
    const c = cell.header("Name");
    const result = c.render(10, { sortDirection: "desc" });
    expect(result).toBe(truncateToWidth("Name", 8, "") + " ▼");
  });

  it("appends nothing when sortDirection is null", () => {
    const c = cell.header("Name");
    const result = c.render(10, { sortDirection: null });
    expect(result).toBe(truncateToWidth("Name", 10, ""));
  });

  it("truncates content to fit indicator when narrow", () => {
    const c = cell.header("VeryLongColumnName");
    const result = c.render(10, { sortDirection: "desc" });
    expect(result).toBe(truncateToWidth("VeryLongColumnName", 8, "") + " ▼");
  });

  it("handles narrow width with no indicator", () => {
    const c = cell.header("Hello World");
    const result = c.render(5);
    expect(result).toBe(truncateToWidth("Hello World", 5, ""));
  });
});

describe("cell.marquee", () => {
  let tui: ReturnType<typeof makeMockTUI>;

  beforeEach(() => {
    vi.useFakeTimers();
    tui = makeMockTUI();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows scrolling content when focused", () => {
    const c = cell.marquee("Hello World", tui);
    const result = c.render(5, { isFocused: true });
    // tick=0, offset=0 → first 5 chars
    expect(result).toBe("Hello");
  });

  it("shows ellipsis when unfocused with overflow", () => {
    const c = cell.marquee("Hello World", tui);
    const result = c.render(5);
    expect(result).toBe(truncateToWidth("Hello World", 5, "…"));
  });

  it("shows full content when unfocused without overflow", () => {
    const c = cell.marquee("Hi", tui);
    const result = c.render(10);
    expect(result).toBe("Hi");
  });

  it("clears interval on invalidate", () => {
    const c = cell.marquee("Hello World", tui);
    c.render(5, { isFocused: true }); // starts timer
    expect(vi.getTimerCount()).toBe(1);
    c.invalidate();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("creates new marquee on render after invalidate", () => {
    const c = cell.marquee("Hello World", tui);
    c.render(5, { isFocused: true });
    c.invalidate();
    // After invalidate, focused render should start fresh
    const result = c.render(5, { isFocused: true });
    expect(result).toBe("Hello");
  });

  it("advances marquee tick via timer", () => {
    const c = cell.marquee("Hello World", tui);
    c.render(5, { isFocused: true }); // tick=0

    vi.advanceTimersByTime(150); // 1 tick
    const result = c.render(5, { isFocused: true });
    expect(result).toBe("ello ");
  });

  it("handles empty content", () => {
    const c = cell.marquee("", tui);
    const result = c.render(5, { isFocused: true });
    expect(result).toBe("");
  });

  it("invalidate does not throw when no marquee has been created", () => {
    const c = cell.marquee("Hello", tui);
    expect(() => c.invalidate()).not.toThrow();
  });
});

describe("cell.bar", () => {
  it("renders bar filling the requested width", () => {
    const c = cell.bar(50, (s) => s, (s) => "░".repeat(s.length));
    const result = c.render(10);
    expect(result).toHaveLength(10);
    expect(result).toBe("■■■■■░░░░░");
  });

  it("uses filled style for filled portion", () => {
    const c = cell.bar(100, (s) => `F{${s}}`, (s) => "e".repeat(s.length));
    const result = c.render(5);
    expect(result).toBe("F{■■■■■}");
  });

  it("uses empty style for empty portion", () => {
    const c = cell.bar(0, (s) => "f".repeat(s.length), (s) => `E{${s}}`);
    const result = c.render(5);
    expect(result).toBe("E{■■■■■}");
  });

  it("handles zero width", () => {
    const c = cell.bar(50, (s) => s, (s) => "░".repeat(s.length));
    const result = c.render(0);
    expect(result).toBe("");
  });

  it("handles 100% fill with no empty chars", () => {
    const c = cell.bar(100, (s) => `F{${s}}`, (s) => "E".repeat(s.length));
    const result = c.render(8);
    expect(result).toBe("F{■■■■■■■■}");
  });

  it("invalidate does nothing (no internal cache)", () => {
    const c = cell.bar(50, (s) => s, (s) => "░".repeat(s.length));
    expect(() => c.invalidate()).not.toThrow();
  });
});
