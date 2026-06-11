import { Container, Text, visibleWidth, Spacer } from "@earendil-works/pi-tui";
import { LangStat, StatsTheme } from "../types";
import { UsageRow } from "../components/UsageRow";
import chalk from "chalk";
import { formatNumber } from "../parser";

export class Languages extends Container {
  private theme: StatsTheme;

  constructor(
    private languages: LangStat[],
    theme: StatsTheme,
  ) {
    super();
    this.theme = theme;
  }

  render(width: number): string[] {
    this.clear();
    if (this.languages.length > 0) {
      const title = this.theme.bold("Languages");
      const subtitle = this.theme.fg("dim", "by lines written");
      const gap = " ".repeat(Math.max(0, width - visibleWidth(title) - visibleWidth(subtitle)));
      this.addChild(new Text(title + gap + subtitle, 0, 0));
      this.addChild(new Spacer(1));

      const totalLines = this.languages.reduce((prev, curr) => prev + curr.lines, 0);
      const highestPct = (this.languages[0].lines * 100) / totalLines;
      for (const langStat of this.languages) {
        const pct = (langStat.lines * 100) / totalLines;
        const barPct = (pct * 100) / highestPct;
        const row = new UsageRow({
          name: langStat.language,
          color: chalk.white,
          editCount: formatNumber(langStat.edits),
          lineCount: formatNumber(langStat.lines),
          pct,
          barPct,
        });
        this.addChild(row);
      }
    } else {
      this.addChild(new Text(this.theme.fg("muted", "No language data for this time range.")));
    }
    return super.render(width);
  }

  handleInput(_data: string): void {
    this.invalidate();
  }

  invalidate(): void {
    super.invalidate();
  }
}
