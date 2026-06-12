import { Component, visibleWidth } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { BorderBox } from "./BorderBox";
import { RangeSelector } from "./RangeSelector";

const BOX_WIDTH = 20;

export class Header implements Component {
  private box: BorderBox;

  constructor(private rangeSelector: RangeSelector) {
    this.box = new BorderBox({
      child: rangeSelector,
      title: "[r] Range",
      rounded: true,
    });
  }

  render(width: number): string[] {
    const title = chalk.bold("Pi Usage") + " · " + chalk.dim(`v 0.0.1`);

    // Line 1: title on the left
    const line1 = title + " ".repeat(Math.max(0, width - visibleWidth(title)));

    // Lines 2-4: BorderBox right-aligned, fixed width
    const gap = " ".repeat(Math.max(0, width - BOX_WIDTH));
    const boxLines = this.box.render(BOX_WIDTH).map((line) => gap + line);

    return [line1, ...boxLines];
  }

  invalidate(): void {
    this.box.invalidate();
  }
}
