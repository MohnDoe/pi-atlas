import type { Theme } from "@earendil-works/pi-coding-agent";
import { matchesKey, Spacer, Text } from "@earendil-works/pi-tui";
import { BorderBox } from "@mohndoe/pi-tui-extras";
import { alignInWidthLR } from "@mohndoe/pi-tui-extras/src/core/align";
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
  private loadingText: Text;

  constructor(
    private message = "Parsing session logs...",
    private theme: Theme,
    private onClose: (() => void) | null = null,
  ) {
    super({
      titles: [
        { text: theme.bold("Pi Atlas") + theme.fg("dim", ` · v${pkg.version}`), align: "left" },
      ],
      padding: {
        top: 1,
        bottom: 0,
        left: 1,
        right: 1,
      },
    });

    this.bar = new Text("", 0, 0);
    this.loadingText = new Text(this.theme.fg("text", message), 0, 0);

    this.addChild(this.loadingText);
    this.addChild(this.bar);

    this.addChild(new Spacer(1));
    this.addChild(new Text(this.theme.fg("dim", "Esc/q to cancel and close"), 0, 0));
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
        (s) => this.theme.bold(this.theme.fg("success", s)),
        (s) => this.theme.fg("muted", s),
        "█",
        "░",
      ),
    );

    const progressSplitText = this.progress.done + this.theme.fg("dim", "/" + this.progress.total);
    this.loadingText.setText(
      alignInWidthLR(this.theme.fg("text", this.message), progressSplitText, innerWidth),
    );

    return super.render(width);
  }

  override handleInput(data: string): void {
    if (matchesKey(data, "escape") || data === "q" || data === "Q") {
      this.onClose?.();
      return;
    }
  }

  override invalidate(): void {
    super.invalidate();
    this.bar.invalidate();
    this.loadingText.invalidate();
  }
}
