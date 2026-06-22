import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { join } from "node:path";
import { getCacheTimestamp, loadAggregate } from "./cache";
import { Dashboard } from "./components/Dashboard";
import { LoadingView } from "./components/LoadingView";
import { summarize } from "./compute";
import { formatCacheTimestamp } from "./format";
import type { TimeRange } from "./types";
import { RangeSelector, type RangeOption } from "./components/RangeSelector";

const SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");
const CACHE_PATH = join(homedir(), ".pi", "pi-atlas-cache.json");

export default function (pi: ExtensionAPI) {
  pi.registerCommand("atlas", {
    description: "Show Pi Atlas usage dashboard",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) {
        ctx.ui.notify("Stats dashboard requires interactive mode", "error");
        return;
      }

      const overlayOpts = {
        overlay: true as const,
        overlayOptions: {
          minWidth: 100,
          width: "50%" as const,
          maxHeight: "80%" as const,
          anchor: "center" as const,
          margin: 2,
        },
      };

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
      const rangesToSummarize: TimeRange[] = ["1d", "7d", "30d", "All"];
      const summaries = new Map(rangesToSummarize.map((r) => [r, summarize(days, r)] as const));

      await ctx.ui.custom((tui, theme, _kb, done) => {
        const rangeOptions: RangeOption[] = [
          { label: "Today", value: "1d" },
          { label: "Last 7 days", value: "7d" },
          { label: "Last 30 days", value: "30d" },
          { label: "All time", value: "All" },
        ];
        const rangeSelector = new RangeSelector(theme, rangeOptions, rangeOptions.length - 1);
        const dashboard = new Dashboard(summaries, theme, tui, updateLabel, rangeSelector, () =>
          done(undefined),
        );
        return {
          render: (w: number) => dashboard.render(w),
          handleInput: (d: string) => {
            dashboard.handleInput(d);
            tui.requestRender();
          },
          invalidate: () => dashboard.invalidate(),
        };
      }, overlayOpts);
    },
  });
}
