import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";
import { Dashboard } from "./components/Dashboard";
import { DashboardPopup } from "./components/DashboardPopup";
import { LoadingView } from "./components/LoadingView";
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
        );
      } catch {
        ctx.ui.notify("Failed to parse session logs", "error");
        return;
      }

      // Phase 2: Show dashboard (handles empty state internally)
      const ranges: Array<"1d" | "7d" | "30d" | "All"> = ["1d", "7d", "30d", "All"];
      const summaries = ranges.map((r) => summarize(days, r));

      // Popup mode: floating overlay above pi.dev (terminal ≥ 60×20)
      // Full-screen mode: same behaviour as before (terminal < 60×20)
      const termWidth = process.stdout.columns || 80;
      const termHeight = process.stdout.rows || 24;
      const usePopup = termWidth >= MIN_POPUP_WIDTH && termHeight >= MIN_POPUP_HEIGHT;

      await ctx.ui.custom((tui, theme, _kb, done) => {
        const dashboard = new Dashboard(summaries, theme as StatsTheme, () => done(undefined));
        const popup = new DashboardPopup(dashboard);
        return {
          render: (w: number) => popup.render(w),
          handleInput: (d: string) => {
            popup.handleInput(d);
            tui.requestRender();
          },
          invalidate: () => popup.invalidate(),
        };
      }, usePopup ? {
        overlay: true,
        overlayOptions: {
          width: "80%",
          maxHeight: "80%",
          anchor: "center",
          margin: 1,
        },
      } : {});
    },
  });
}
