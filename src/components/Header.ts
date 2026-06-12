import { Component } from "@earendil-works/pi-tui";
import { BorderBox } from "./BorderBox";
import { RangeSelector } from "./RangeSelector";
import { StatsTheme } from "../types";

const RANGE_BOX_WIDTH = 17;

/** Strip ANSI escapes and test theme tags to compute visible length. */
function visibleLen(s: string): number {
  return s
    .replace(/\x1b\[[0-9;]*m/g, "")
    .replace(/<[/]?(?:b|fg:[^>]+|bg:[^>]+)>/g, "")
    .length;
}

export class Header implements Component {
  private rangeBox: BorderBox;

  constructor(
    private theme: StatsTheme,
    private rangeSelector: RangeSelector,
  ) {
    this.rangeBox = new BorderBox({
      child: this.rangeSelector,
      title: "Range (r)",
      rounded: true,
    });
  }

  render(width: number): string[] {
    const title = this.theme.bold("Pi Usage");
    const version = this.theme.fg("dim", "v 0.0.1");

    const boxLines = this.rangeBox.render(RANGE_BOX_WIDTH);
    const leftWidth = width - RANGE_BOX_WIDTH;

    const line1 = title + " ".repeat(Math.max(0, leftWidth - visibleLen(title)));
    const line2 = version + " ".repeat(Math.max(0, leftWidth - visibleLen(version)));
    const line3 = " ".repeat(leftWidth);

    return [line1 + boxLines[0], line2 + boxLines[1], line3 + boxLines[2]];
  }

  invalidate(): void {
    this.rangeBox.invalidate();
  }
}
