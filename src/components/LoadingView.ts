import { type Component } from "@earendil-works/pi-tui";

export class LoadingView implements Component {
  private progress = 0;
  private message: string;
  private cachedLines: string[] | null = null;
  private cachedWidth = -1;
  private tui: { requestRender: () => void } | null;

  constructor(message = "Parsing session logs...", tui?: { requestRender: () => void }) {
    this.message = message;
    this.tui = tui ?? null;
  }

  setProgress(p: number): void {
    this.progress = p;
    this.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const barW = Math.min(40, width - 10);
    const filled = Math.round((this.progress / 100) * barW);
    const bar = "█".repeat(filled) + "░".repeat(barW - filled);

    const lines = ["", `  ${this.message}`, `  [${bar}] ${this.progress}%`, ""];

    this.cachedLines = lines;
    this.cachedWidth = width;
    return lines;
  }

  invalidate(): void {
    this.cachedLines = null;
    this.cachedWidth = -1;
  }
}
