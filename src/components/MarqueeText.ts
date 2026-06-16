import type { Component } from "@earendil-works/pi-tui";
import type { TUI } from "@earendil-works/pi-tui";

/**
 * A component that displays text with a marquee scroll effect when the text
 * overflows the available width. Text scrolls left at 1 character per 3 ticks,
 * wrapping around when reaching the end.
 *
 * Each instance manages its own tick counter and animation timer. When a TUI
 * reference is provided, the timer calls tui.requestRender() to animate.
 */
export class MarqueeText implements Component {
  private tickCounter = 0;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private text: string,
    private tui: TUI,
  ) {}

  render(width: number): string[] {
    if (this.text.length <= width) {
      this.stopTimer();
      return [this.text];
    }

    // Start animation timer on first render with overflow
    if (!this.timer) {
      this.timer = setInterval(() => {
        this.tickCounter++;
        this.tui.requestRender();
      }, 50);
    }

    const offset = Math.floor(this.tickCounter / 3) % this.text.length;
    const visible = (this.text + this.text).slice(offset, offset + width);
    return [visible];
  }

  /** Advance the tick counter by one (for testing or external control) */
  advance(): void {
    this.tickCounter++;
  }

  /** Reset the marquee to start position and restart animation */
  reset(): void {
    this.tickCounter = 0;
    this.stopTimer();
  }

  /** Stop the animation timer */
  destroy(): void {
    this.stopTimer();
  }

  invalidate(): void {
    // No internal cache to clear
  }

  private stopTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
