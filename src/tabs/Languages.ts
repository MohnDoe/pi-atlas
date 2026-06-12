import { Container, Text, visibleWidth, Spacer } from "@earendil-works/pi-tui";
import { LangStat, StatsTheme } from "../types";
import { RankedBarList } from "../components/RankedBarList";
import { ColorPalette } from "../colorPalette.js";
import { formatNumber } from "../format";

export class Languages extends Container {
  private theme: StatsTheme;

  constructor(
    private languages: LangStat[],
    theme: StatsTheme,
    private palette: ColorPalette,
  ) {
    super();
    this.theme = theme;
  }

  render(width: number): string[] {
    this.clear();
    if (this.languages.length > 0) {
      const title = this.theme.bold("Languages");
      const subtitle = this.theme.fg("muted", "by lines written");
      const gap = " ".repeat(Math.max(0, width - visibleWidth(title) - visibleWidth(subtitle)));
      this.addChild(new Text(title + gap + subtitle, 0, 0));
      this.addChild(new Spacer(1));

      this.addChild(new RankedBarList(
        this.languages.map((l) => ({
          name: l.language,
          primaryValue: l.lines,
          mainValueText: formatNumber(l.lines) + " ln",
          secondaryValueText: formatNumber(l.edits) + " edits",
          color: this.palette.getColor(l.language),
        })),
        this.theme,
      ));
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
