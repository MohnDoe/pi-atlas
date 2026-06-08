import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const piTuiPath = resolve(
  "/home/doe/.local/share/mise/installs/node/24.9.0/lib/node_modules/@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui"
);

export default defineConfig({
  resolve: {
    alias: {
      "@earendil-works/pi-tui": piTuiPath,
    },
  },
  test: {
    globals: false,
    include: ["src/**/*.test.ts"],
  },
});
