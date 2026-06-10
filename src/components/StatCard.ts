import { Box, Component, Text } from "@earendil-works/pi-tui";
import chalk from "chalk";
import { StatsTheme } from "../types";

export class StatCard implements Component {
  private box: Box;

  constructor(label: string, value: string, theme: StatsTheme, accentFn = chalk.green) {
    this.box = new Box(1, 0);
    this.box.addChild(new Text(theme.fg("dim", label), 1, 0));
    this.box.addChild(new Text(accentFn(value), 1, 0));
  }

  render(width: number): string[] {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}
