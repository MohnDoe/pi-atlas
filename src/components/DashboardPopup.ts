import { Theme } from "@earendil-works/pi-coding-agent";
import { type Component } from "@earendil-works/pi-tui";
import { BorderBox } from "@mohndoe/pi-tui-extras";
import { Dashboard } from "./Dashboard";

/**
 * Wraps Dashboard in a rounded border for popup/overlay display.
 * Delegates rendering and input to a BorderBox around the dashboard.
 */
export class DashboardPopup implements Component {
  private borderBox: BorderBox;

  constructor(dashboard: Dashboard, theme: Theme) {
    this.borderBox = new BorderBox({
      titles: [
        { text: theme.bold("Pi Atlas"), align: "left" },
        {
          text: theme.fg("muted", "v0.1"),
          align: "right",
        },
      ],
      footers: dashboard.updateLabel
        ? [{ text: theme.fg("dim", theme.italic(dashboard.updateLabel)), align: "right" }]
        : [],
      borderStyle: "singleRounded",
      borderFn: (s: string) => theme.fg("text", s),
      padding: { left: 1, right: 1 },
    });
    this.borderBox.addChild(dashboard);
  }

  render(width: number): string[] {
    return this.borderBox.render(width);
  }

  handleInput(data: string): void {
    this.borderBox.handleInput(data);
  }

  invalidate(): void {
    this.borderBox.invalidate();
  }
}
