import { Component } from "@earendil-works/pi-tui";

export class GridRow implements Component {
  constructor(
    private children: Component[],
    private cols: number[],
  ) {}
  // cols = [33, 33, 33] meaning % widths, or absolute chars

  render(width: number): string[] {
    const colWidths = this.cols.map((c) => Math.floor((width * c) / 100));
    const rendered = this.children.map((c, i) => c.render(colWidths[i]));
    const maxLines = Math.max(...rendered.map((r) => r.length));
    return Array.from({ length: maxLines }, (_, i) =>
      rendered.map((r, j) => (r[i] ?? "").padEnd(colWidths[j])).join(""),
    );
  }

  invalidate(): void {
    this.children.forEach((c) => c.invalidate?.());
  }
}
