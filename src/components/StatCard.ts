import { Box, Component, Text } from "@earendil-works/pi-tui";
import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

interface Label {
  text: string;
  color: ThemeColor;
}

interface Value {
  text: string;
  color: ThemeColor;
}

interface StatCardParams {
  label: Label;
  value: Value;
}

export class StatCard implements Component {
  private box: Box;

  constructor(
    params: StatCardParams,
    private theme: Theme,
  ) {
    this.box = new Box(1, 0);
    this.box.addChild(new Text(this.theme.fg(params.label.color, params.label.text), 0, 0));
    this.box.addChild(new Text(this.theme.fg(params.value.color, params.value.text), 0, 0));
  }

  render(width: number): string[] {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}
