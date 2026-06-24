import type { Theme } from "@earendil-works/pi-coding-agent";
import { Spacer, Text } from "@earendil-works/pi-tui";
import { BorderBox } from "@mohndoe/pi-tui-extras";
import { alignInWidth } from "@mohndoe/pi-tui-extras/src/core/align";
import pkg from "../../package.json" with { type: "json" };
import type { LoadingProgress } from "../cache";
import { renderBar } from "./shared/Bar";

export class LoadingView extends BorderBox {
  private progress: LoadingProgress = {
    pct: 0,
    total: 0,
    done: 0,
  };
  private bar: Text;
  private progressText: Text;

  constructor(
    message = "Parsing session logs...",
    private theme: Theme,
  ) {
    super({
      titles: [
        { text: theme.bold("Pi Atlas") + theme.fg("dim", ` · v${pkg.version}`), align: "left" },
      ],
      padding: {
        top: 1,
        bottom: 1,
        left: 1,
        right: 1,
      },
    });

    this.bar = new Text("", 0, 0);
    this.progressText = new Text("", 0, 0);

    this.addChild(new Text(this.theme.fg("text", message), 0, 0));
    this.addChild(new Spacer(1));
    this.addChild(this.bar);
    this.addChild(this.progressText);
  }

  setProgress(p: LoadingProgress): void {
    this.progress = p;
    this.invalidate();
  }

  override render(width: number): string[] {
    const innerWidth = width - 2 - 2;
    this.bar.setText(
      renderBar(
        innerWidth,
        this.progress.pct,
        (s) => this.theme.fg("success", s),
        (s) => this.theme.fg("dim", s),
        "█",
        "░",
      ),
    );

    const progressText = this.progress.done + this.theme.fg("dim", "/" + this.progress.total);
    this.progressText.setText(alignInWidth(progressText, innerWidth, "right"));

    return super.render(width);
  }

  override invalidate(): void {
    super.invalidate();
    this.bar.invalidate();
    this.progressText.invalidate();
  }
}
