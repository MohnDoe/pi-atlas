import { Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { RangeSelector } from "./RangeSelector";

export class Header implements Component {
  constructor(private rangeSelector: RangeSelector) {}

  render(width: number): string[] {
    const title = chalk.bold("Pi Usage");
    const subtitle = chalk.dim(`v 0.0.1`);

    // Right side: range
    const rangesWitdth = 15;
    const ranges = this.rangeSelector.render(rangesWitdth);

    // Line 1: title (left) + tabs (right)
    const titleW = visibleWidth(title);
    const gap = " ".repeat(Math.max(0, width - titleW - rangesWitdth));
    const line1 = title + gap + ranges;

    // Line 2: subtitle only (tabs only appear on line 1)
    const line2 = truncateToWidth(subtitle, width, "...");

    return [line1, line2];
  }

  invalidate(): void {
    this.rangeSelector.invalidate();
  }
}
