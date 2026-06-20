import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";
import { getCacheTimestamp, loadAggregate } from "./cache";
import { Dashboard } from "./components/Dashboard";
import { DashboardPopup } from "./components/DashboardPopup";
import { LoadingView } from "./components/LoadingView";
import { summarize } from "./compute";
import { formatCacheTimestamp } from "./format";

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

      // Read last update timestamp before loading (cache may be rewritten)
      const lastUpdate = await getCacheTimestamp(CACHE_PATH);
      const updateLabel = lastUpdate ? `Last update : ${formatCacheTimestamp(lastUpdate)}` : null;

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
              .catch(() => done([]));

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
      const summaries = new Map(ranges.map((r) => [r, summarize(days, r)] as const));

      await ctx.ui.custom((tui, theme, _kb, done) => {
        const dashboard = new Dashboard(summaries, theme, usePopup, updateLabel, tui, () =>
          done(undefined),
        );
        // Wrap in popup border only when using overlay mode
        const component = usePopup ? new DashboardPopup(dashboard, theme) : dashboard;
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
