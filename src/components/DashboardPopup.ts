import { type Component } from "@earendil-works/pi-tui";
import { Dashboard } from "./Dashboard";
import { BorderBox } from "./BorderBox";
import { Theme } from "@earendil-works/pi-coding-agent";

/**
 * Wraps Dashboard in a rounded border for popup/overlay display.
 * Delegates rendering and input to a BorderBox around the dashboard.
 */
export class DashboardPopup implements Component {
  private borderBox: BorderBox;

  constructor(dashboard: Dashboard, theme: Theme) {
    this.borderBox = new BorderBox(
      {
        title: theme.bold("Pi Usage") + " " + theme.fg("muted", "v0.1"),
        child: dashboard,
        color: "text",
        paddingX: 1,
      },
      theme,
    );
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
