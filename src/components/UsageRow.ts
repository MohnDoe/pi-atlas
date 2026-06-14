import { Component, visibleWidth } from "@earendil-works/pi-tui";
import type { ChalkInstance } from "chalk";
import type { Theme } from "@earendil-works/pi-coding-agent";

export class UsageRow implements Component {
  constructor(
    private lang: {
      name: string;
      mainValueText: string;
      secondaryValueText?: string;
      barPct: number;
      pct: number;
    },
    private color: ChalkInstance,
    private theme: Theme,
  ) {}

  render(width: number): string[] {
    const { name, mainValueText, secondaryValueText } = this.lang;
    let { barPct, pct } = this.lang;

    barPct = Math.max(0, barPct);
    pct = Math.max(0, pct);

    // Line 1: name (left) + [secondary(?) - mainStr ] (right)
    const nameStr = this.theme.bold(name);

    let valueStr = "";
    if (secondaryValueText) {
      valueStr += this.theme.fg("muted", secondaryValueText) + " · ";
    }
    valueStr += this.theme.bold(mainValueText);

    const firstLineGap = " ".repeat(
      Math.max(0, width - visibleWidth(nameStr) - visibleWidth(valueStr)),
    );

    // Line 2: progress bar - [percentage]
    const pctString = this.theme.fg("dim", `${pct.toFixed(2)}%`);
    const pctStringWidth = visibleWidth(pctString);
    // const pctStringWidth = 6; // always same size as XX.XX%
    const secondLineGap = "  ";

    const barWidth = width - pctStringWidth - visibleWidth(secondLineGap);

    const filled = Math.round((barPct / 100) * barWidth);
    const bar = this.color("■".repeat(filled)) + this.theme.fg("dim", "■".repeat(barWidth - filled));

    return [
      nameStr + firstLineGap + valueStr,
      bar + secondLineGap + pctString,
      "", // spacer between rows
    ];
  }

  invalidate(): void {}
}
