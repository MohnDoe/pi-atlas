import { type Component } from "@earendil-works/pi-tui";
import { Dashboard } from "./Dashboard";
import { BorderBox } from "./BorderBox";

/**
 * Wraps Dashboard in a rounded border for popup/overlay display.
 * Delegates rendering and input to a BorderBox around the dashboard.
 */
export class DashboardPopup implements Component {
  private borderBox: BorderBox;

  constructor(dashboard: Dashboard) {
    this.borderBox = new BorderBox({ child: dashboard });
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
