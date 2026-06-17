import { truncateToWidth } from "@earendil-works/pi-tui";

export interface CellState {
  isFocused: boolean;
  sortDirection: "asc" | "desc" | null;
}

export interface CellComponent {
  render(width: number, state: CellState): string;
  invalidate(): void;
}

class TextCell implements CellComponent {
  constructor(private content: string) {}

  render(width: number, _state: CellState): string {
    return truncateToWidth(this.content, width, "");
  }

  invalidate(): void {
    // No internal cache
  }
}

class HeaderCell implements CellComponent {
  constructor(private content: string) {}

  render(width: number, state: CellState): string {
    const indicator =
      state.sortDirection === "asc"
        ? " ▲"
        : state.sortDirection === "desc"
          ? " ▼"
          : "";
    const contentWidth = Math.max(0, width - indicator.length);
    const truncated = truncateToWidth(this.content, contentWidth, "");
    return truncated + indicator;
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
};
