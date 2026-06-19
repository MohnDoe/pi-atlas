import { Box, Component, Text } from "@earendil-works/pi-tui";
import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { ChalkInstance } from "chalk";

interface Label {
  text: string;
  color?: ThemeColor | ChalkInstance;
}

interface Value {
  text: string;
  color: ThemeColor | ChalkInstance;
}

interface StatCardParams {
  label: Label;
  value: Value;
  paddingX?: number;
  paddingY?: number;
}

export class StatCard implements Component {
  private box: Box;
  private DEFAULT_PADDING_X = 0;
  private DEFAULT_PADDING_Y = 0;

  constructor(
    params: StatCardParams,
    private theme: Theme,
  ) {
    this.box = new Box(
      params.paddingX || this.DEFAULT_PADDING_X,
      params.paddingY || this.DEFAULT_PADDING_Y,
    );
    this.box.addChild(
      new Text(
        params.label.color
          ? typeof params.label.color === "string"
            ? this.theme.fg(params.label.color, params.label.text)
            : params.label.color(params.label.text)
          : params.label.text,
        0,
        0,
      ),
    );
    this.box.addChild(
      new Text(
        typeof params.value.color === "string"
          ? this.theme.fg(params.value.color, params.value.text)
          : params.value.color(params.value.text),
        0,
        0,
      ),
    );
  }

  render(width: number): string[] {
    return this.box.render(width);
  }

  invalidate(): void {
    this.box.invalidate();
  }
}
