import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";
import chalk from "chalk";
import { Dashboard } from "./components/Dashboard";
import { DashboardPopup } from "./components/DashboardPopup";
import { LoadingView } from "./components/LoadingView";
import { ColorPalette } from "./colorPalette.js";
import { loadAggregate, summarize } from "./engine";
import { StatsTheme } from "./types";

const SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");
const CACHE_PATH = join(homedir(), ".pi", "pi-usage-cache.json");

/** Minimum terminal dimensions for popup mode. Below this, full-screen is used. */
const MIN_POPUP_WIDTH = 60;
const MIN_POPUP_HEIGHT = 20;

export default function (pi: ExtensionAPI) {
  pi.registerCommand("usage", {
    description: "Show pi usage statistics dashboard",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Stats dashboard requires interactive mode", "error");
        return;
      }

      // Determine terminal size for popup vs full-screen mode
      const termWidth = process.stdout.columns || 80;
      const termHeight = process.stdout.rows || 24;
      const usePopup = termWidth >= MIN_POPUP_WIDTH && termHeight >= MIN_POPUP_HEIGHT;

      const overlayOpts = usePopup
        ? {
            overlay: true as const,
            overlayOptions: {
              minWidth: 100,
              width: "50%" as const,
              maxHeight: "80%" as const,
              anchor: "center" as const,
              margin: 2,
            },
          }
        : {};

      // Phase 1: Show loading, parse session logs
      let days: Awaited<ReturnType<typeof loadAggregate>>;
      try {
        days = await ctx.ui.custom<Awaited<ReturnType<typeof loadAggregate>>>(
          (tui, _theme, _kb, done) => {
            const loadingView = new LoadingView("Parsing session logs...", tui);

            loadAggregate(CACHE_PATH, SESSIONS_DIR, false, (p) => {
              loadingView.setProgress(p);
              tui.requestRender();
            })
              .then((result) => done(result))
              .catch((err) => done(err));

            return loadingView;
          },
          overlayOpts,
        );
      } catch {
        ctx.ui.notify("Failed to parse session logs", "error");
        return;
      }

      // Phase 2: Show dashboard (handles empty state internally)
      const ranges: Array<"1d" | "7d" | "30d" | "All"> = ["1d", "7d", "30d", "All"];
      const summaries = ranges.map((r) => summarize(days, r));

      const langPalette = new ColorPalette({
        TypeScript: chalk.green,
        Python: chalk.blue,
        JavaScript: chalk.yellow,
        TypeScript: chalk.green,
        JSON: chalk.yellow,
      });
      const modelPalette = new ColorPalette({
        claude-sonnet-4-20250514: chalk.magenta,
        "claude-sonnet-4": chalk.magenta,
        claude: chalk.magenta,
        "gemini-2.5-pro": chalk.cyan,
        gemini: chalk.cyan,
        "gpt-4o": chalk.red,
        gpt: chalk.red,
      });

      // Effective rows for the Dashboard: popup mode uses 80% maxHeight minus
      // 2 border lines (top + bottom) added by DashboardPopup; full-screen uses
      // full terminal. Dashboard internally subtracts its own chrome (CHROME_ROWS)
      // from this value to compute content height.
      const dashRows = usePopup ? Math.floor(termHeight * 0.8) - 2 : termHeight;

      await ctx.ui.custom((tui, theme, _kb, done) => {
        const dashboard = new Dashboard(
          summaries,
          theme as StatsTheme,
          dashRows,
          langPalette,
          modelPalette,
          () => done(undefined),
        );
        // Wrap in popup border only when using overlay mode
        const component = usePopup ? new DashboardPopup(dashboard) : dashboard;
        return {
          render: (w: number) => component.render(w),
          handleInput: (d: string) => {
            component.handleInput(d);
            tui.requestRender();
          },
          invalidate: () => component.invalidate(),
        };
      }, overlayOpts);
    },
  });
}
