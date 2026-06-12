import { Box, Component, Text } from "@earendil-works/pi-tui";
import { StatsTheme } from "../types";

export class StatCard implements Component {
  private box: Box;

  constructor(
    label: string,
    value: string,
    private theme: StatsTheme,
    private accentColor = "accent",
  ) {
    this.box = new Box(1, 0);
    this.box.addChild(new Text(theme.fg("muted", label), 1, 0));
    this.box.addChild(new Text(theme.fg(accentColor, value), 1, 0));
  }

  render(width: number): string[] {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}
