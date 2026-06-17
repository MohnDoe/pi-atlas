/**
 * Render a horizontal bar using ■ characters.
 *
 * @param width  Total character width for the bar
 * @param fillPct  Fill percentage (0–100, clamped)
 * @param filledStyle  Styling function for the filled portion (e.g. chalk.green)
 * @param emptyStyle  Styling function for the empty/unfilled portion (e.g. s => theme.fg("dim", s))
 */
export function renderBar(
  width: number,
  fillPct: number,
  filledStyle: (text: string) => string,
  emptyStyle: (text: string) => string,
): string {
  const clamped = Math.max(0, Math.min(100, fillPct));
  const filledCount = Math.round((clamped / 100) * Math.max(0, width));
  const emptyCount = Math.max(0, width - filledCount);
  return filledStyle("■".repeat(filledCount)) + emptyStyle("■".repeat(emptyCount));
}
