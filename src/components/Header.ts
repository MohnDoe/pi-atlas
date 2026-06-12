import { Component, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { BorderBox } from "./BorderBox";
import { RangeSelector } from "./RangeSelector";

const RANGE_BOX_WIDTH = 17;

export class Header implements Component {
  private rangeBox: BorderBox;

  constructor(private rangeSelector: RangeSelector) {
    this.rangeBox = new BorderBox({
      child: this.rangeSelector,
      title: "Range (r)",
      rounded: true,
    });
  }

  render(width: number): string[] {
    const title = chalk.bold("Pi Usage") + " · " + chalk.dim(`v 0.0.1`);

    // Line 1: title on the left
    const line1 = title + " ".repeat(Math.max(0, width - visibleWidth(title)));

    // Lines 2-4: BorderBox right-aligned, fixed width
    const gap = " ".repeat(Math.max(0, width - RANGE_BOX_WIDTH));
    const boxLines = this.rangeBox.render(RANGE_BOX_WIDTH).map((line) => gap + line);

    return [line1, ...boxLines];
  }

  invalidate(): void {
    this.rangeBox.invalidate();
  }
}
