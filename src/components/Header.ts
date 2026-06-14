import { Component, visibleWidth } from "@earendil-works/pi-tui";
import { BorderBox } from "./BorderBox";
import { RangeSelector, type RangeSelectorTheme } from "./RangeSelector";

/** Theme subset needed by Header — bold for title, fg for dim version + passes to RangeSelector. */
export interface HeaderTheme {
  fg: (color: "accent" | "dim", text: string) => string;
  bold: (text: string) => string;
}

const RANGE_BOX_WIDTH = 17;

export class Header implements Component {
  private rangeBox: BorderBox;

  constructor(
    private theme: HeaderTheme,
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

    const line1 = title + " ".repeat(Math.max(0, leftWidth - visibleWidth(title)));
    const line2 = version + " ".repeat(Math.max(0, leftWidth - visibleWidth(version)));
    const line3 = " ".repeat(leftWidth);

    return [line1 + boxLines[0], line2 + boxLines[1], line3 + boxLines[2]];
  }

  invalidate(): void {
    this.rangeBox.invalidate();
  }
}
