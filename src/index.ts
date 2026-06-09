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

      await ctx.ui.custom((_tui, _theme, _kb, done) => {
        const dashboard = new Dashboard(summaries, () => done(undefined));
        return {
          render: (w: number) => dashboard.render(w),
          handleInput: (d: string) => {
            dashboard.handleInput(d);
          },
          invalidate: () => dashboard.invalidate(),
        };
      });
    },
  });
}
