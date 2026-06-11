import { Component, visibleWidth } from "@earendil-works/pi-tui";
import chalk, { ChalkInstance } from "chalk";

export class UsageRow implements Component {
  constructor(
    private lang: {
      name: string;
      mainValueText: string;
      secondaryValueText: string;
      barPct: number;
      pct: number;
    },
    private color: ChalkInstance,
  ) {}

  render(width: number): string[] {
    const {
      name,
      mainValueText: mainCountText,
      secondaryValueText: secondCountText,
      barPct,
      pct,
    } = this.lang;

    // Line 1: name (left) + [edits - ln ] (right)
    const nameStr = chalk.bold(name);
    const valueStr = chalk.dim(secondCountText) + " · " + chalk.bold(mainCountText);
    const firstLineGap = " ".repeat(
      Math.max(0, width - visibleWidth(nameStr) - visibleWidth(valueStr)),
    );

    // Line 2: progress bar - [percentage]
    const pctString = chalk.dim(`${pct.toFixed(2)}%`);
    const pctStringWidth = visibleWidth(pctString);
    // const pctStringWidth = 6; // always same size as XX.XX%
    const secondLineGap = "  ";

    const barWidth = width - pctStringWidth - visibleWidth(secondLineGap);

    const filled = Math.round((barPct / 100) * barWidth);
    const bar = this.color("█".repeat(filled)) + chalk.dim("░".repeat(barWidth - filled));

    return [
      nameStr + firstLineGap + valueStr,
      bar + secondLineGap + pctString,
      "", // spacer between rows
    ];
  }

  invalidate(): void {}
}
