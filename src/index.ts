import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadAggregate, summarize } from "./engine.js";
import { Dashboard, LoadingView } from "./components.js";
import { homedir } from "node:os";
import { join } from "node:path";

const SESSIONS_DIR = join(homedir(), ".pi", "agent", "sessions");
const CACHE_PATH = join(homedir(), ".pi", "pi-usage-cache.json");

export default function (pi: ExtensionAPI) {
  pi.registerCommand("stats", {
    description: "Show pi usage statistics dashboard",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") {
        ctx.ui.notify("Stats dashboard requires interactive mode", "error");
        return;
      }

      // Show loading spinner
      const loadingView = new LoadingView();
      const loadingHandle = ctx.ui.custom(loadingView);

      // Parse session logs
      const days = await loadAggregate(CACHE_PATH, SESSIONS_DIR, false, (p) => {
        loadingView.setProgress(p);
        loadingHandle.requestRender();
      });

      // Close loading, open dashboard
      loadingHandle.close();

      if (days.length === 0) {
        ctx.ui.notify("No session logs found in " + SESSIONS_DIR, "warning");
        return;
      }

      // Pre-compute all 4 range summaries
      const ranges: Array<"1d" | "7d" | "30d" | "All"> = ["1d", "7d", "30d", "All"];
      const summaries = ranges.map((r) => summarize(days, r));

      await ctx.ui.custom((_tui, _theme, _kb, done) => {
        const dashboard = new Dashboard(summaries, () => done(undefined));
        return {
          render: (w: number) => dashboard.render(w),
          handleInput: (d: string) => { dashboard.handleInput(d); },
          invalidate: () => dashboard.invalidate(),
        };
      });
    },
  });
}
