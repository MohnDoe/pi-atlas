import chalk, { ChalkInstance } from "chalk";

export class ColorPalette {
  constructor(private mapping: Record<string, ChalkInstance>) {}

  getColor(name: string): ChalkInstance {
    return this.mapping[name] ?? chalk.white;
  }
}
