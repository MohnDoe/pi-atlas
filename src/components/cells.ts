import type { TUI } from "@earendil-works/pi-tui";
import { truncateToWidth } from "@earendil-works/pi-tui";
import { MarqueeText } from "./MarqueeText";
import { renderBar } from "./shared/Bar";

export interface CellState {
  isFocused?: boolean;
  sortDirection?: "asc" | "desc" | null;
}

export interface CellComponent {
  render(width: number, state?: CellState): string;
  invalidate(): void;
}

class TextCell implements CellComponent {
  constructor(private content: string) {}

  render(width: number, _state?: CellState): string {
    return truncateToWidth(this.content, width, "");
  }

  invalidate(): void {
    // No internal cache
  }
}

class HeaderCell implements CellComponent {
  constructor(private content: string) {}

  render(width: number, state?: CellState): string {
    const indicator =
      state?.sortDirection === "asc" ? " ▲" : state?.sortDirection === "desc" ? " ▼" : "";
    const contentWidth = Math.max(0, width - indicator.length);
    const truncated = truncateToWidth(this.content, contentWidth, "");
    return truncated + indicator;
  }

  invalidate(): void {
    // No internal cache
  }
}

class MarqueeCell implements CellComponent {
  private marquee: MarqueeText | undefined;

  constructor(
    private content: string,
    private tui: TUI,
  ) {}

  render(width: number, state?: CellState): string {
    if ((state?.isFocused ?? false) && this.content.length > width) {
      if (!this.marquee) {
        this.marquee = new MarqueeText(this.content, this.tui);
      }
      return this.marquee.render(width)[0]!;
    }

    // Unfocused or content fits — truncate with ellipsis
    return truncateToWidth(this.content, width, "…");
  }

  invalidate(): void {
    if (this.marquee) {
      this.marquee.destroy();
      this.marquee = undefined;
    }
  }
}

class BarCell implements CellComponent {
  constructor(
    private fillPct: number,
    private filledStyle: (text: string) => string,
    private emptyStyle: "transparent" | ((text: string) => string),
  ) {}

  render(width: number, _state?: CellState): string {
    return renderBar(width, this.fillPct, this.filledStyle, this.emptyStyle);
  }

  invalidate(): void {
    // No internal cache
  }
}

export const cell = {
  text(content: string): CellComponent {
    return new TextCell(content);
  },

  header(content: string): CellComponent {
    return new HeaderCell(content);
  },

  marquee(content: string, tui: TUI): CellComponent {
    return new MarqueeCell(content, tui);
  },

  bar(
    fillPct: number,
    filledStyle: (text: string) => string,
    emptyStyle: "transparent" | ((text: string) => string),
  ): CellComponent {
    return new BarCell(fillPct, filledStyle, emptyStyle);
  },
};
