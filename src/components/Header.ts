import { Component, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { RangeSelector } from "./RangeSelector";

export class Header implements Component {
  constructor(private rangeSelector: RangeSelector) {}

  render(width: number): string[] {
    const title = chalk.bold("Pi Usage") + " · " + chalk.dim(`v 0.0.1`);

    // Right side: range
    const rangesWitdth = 15;
    const ranges = this.rangeSelector.render(rangesWitdth);

    // Line 1: title (left) + tabs (right)
    const titleW = visibleWidth(title);
    const gap = " ".repeat(Math.max(0, width - titleW - rangesWitdth));
    const line = title + gap + ranges;

    return [line];
  }

  invalidate(): void {
    this.rangeSelector.invalidate();
  }
}
