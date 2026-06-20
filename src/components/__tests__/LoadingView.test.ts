import { describe, expect, it } from "bun:test";
import { LoadingView } from "../LoadingView";

describe("LoadingView", () => {
  it("renders with 0% progress", () => {
    const lv = new LoadingView();
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("Parsing session logs...");
    expect(lines.join("\n")).toContain("0%");
  });

  it("updates progress", () => {
    const lv = new LoadingView();
    lv.setProgress(50);
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("50%");
  });

  it("renders progress bar with block chars", () => {
    const lv = new LoadingView();
    lv.setProgress(75);
    const lines = lv.render(80);
    expect(lines.join("\n")).toContain("█");
    expect(lines.join("\n")).toContain("75%");
  });
});
