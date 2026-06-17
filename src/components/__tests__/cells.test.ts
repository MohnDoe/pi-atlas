import { describe, expect, it } from "vitest";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { cell } from "../cells.js";

describe("cell.text", () => {
  it("renders content truncated to width", () => {
    const c = cell.text("Hello World");
    const result = c.render(5, { isFocused: false, sortDirection: null });
    expect(result).toBe(truncateToWidth("Hello World", 5, ""));
  });

  it("returns exact line when content fits within width", () => {
    const c = cell.text("Hi");
    const result = c.render(10, { isFocused: false, sortDirection: null });
    expect(result).toBe(truncateToWidth("Hi", 10, ""));
  });

  it("handles empty content", () => {
    const c = cell.text("");
    const result = c.render(10, { isFocused: false, sortDirection: null });
    expect(result).toBe("");
  });

  it("handles zero width", () => {
    const c = cell.text("Hello");
    const result = c.render(0, { isFocused: false, sortDirection: null });
    expect(result).toBe("");
  });
});
