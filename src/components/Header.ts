import { type Component, visibleWidth } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { BorderBox } from "./BorderBox";
import { RangeSelector } from "./RangeSelector";

const RANGE_BOX_WIDTH = 17;

export class Header implements Component {
  private rangeBox: BorderBox;

  constructor(
    theme: Theme,
    private rangeSelector: RangeSelector,
  ) {
    this.rangeBox = new BorderBox(
      {
        child: this.rangeSelector,
        title: "Range (r)",
        rounded: false,
        color: "dim",
      },
      theme,
    );
  }

  render(width: number): string[] {
    const title = "";
    const version = "";

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
