import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeMockTUI, makeRangeSelector, makeTheme } from "../components/components.fixtures";
import { Dashboard } from "../components/Dashboard";
import { allRanges } from "../components/Dashboard.test";
import { summarize } from "../compute";
import { parseFile } from "../parser";
import type { DayAgg } from "../types";

const mockTui = makeMockTUI();

describe("JSONL → Dashboard", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-integration-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  function daysFromMap(map: Map<string, DayAgg>): DayAgg[] {
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  it("end-to-end: JSONL with session and messages → Dashboard Overview shows KPIs", async () => {
    const filePath = join(tmpDir, "session.jsonl");
    const jsonlLines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      }),
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:01:00.000Z",
        message: { role: "user", content: [{ type: "text", text: "hello" }] },
      }),
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-08T10:02:00.000Z",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "hi there" },
            {
              type: "toolCall",
              id: "t1",
              name: "read",
              arguments: { path: "/src/foo.ts" },
            },
          ],
          model: "claude-sonnet-4-20250514",
          usage: {
            input: 200,
            output: 100,
            cacheRead: 10,
            cacheWrite: 0,
            totalTokens: 310,
            cost: {
              input: 0.001,
              output: 0.0005,
              cacheRead: 0.00001,
              cacheWrite: 0,
              total: 0.00151,
            },
          },
        },
      }),
    ];
    await writeFile(filePath, jsonlLines.join("\n"));

    // Parse
    const map = parseFile(filePath);
    const days = daysFromMap(map);
    expect(days.length).toBeGreaterThan(0);

    // Summarize for all ranges
    const ranges = allRanges;
    const summaries = new Map(ranges.map((r) => [r, summarize(days, r)] as const));

    // Render dashboard
    const dash = new Dashboard(
      summaries,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
    const rendered = dash.render(80);
    const text = rendered.join("\n");

    // Should contain dashboard chrome
    expect(text).toContain("Overview");
    expect(text).toContain("Languages");
    expect(text).toContain("Models");
    expect(text).toContain("Projects");
    expect(text).toContain("Usage");

    // Range selector
    expect(rendered[0]).toContain("Pi Atlas");
    expect(rendered[0]).toContain("All time [r]");
  });

  it("end-to-end: Navigate to Languages tab shows ranked table from parsed data", async () => {
    const filePath = join(tmpDir, "lang-session.jsonl");
    const jsonlLines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      }),
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:01:00.000Z",
        message: {
          role: "assistant",
          content: [
            {
              type: "toolCall",
              id: "t1",
              name: "edit",
              arguments: { path: "/src/main.ts", edits: [{ newText: "console.log('hi')" }] },
            },
            {
              type: "toolCall",
              id: "t2",
              name: "write",
              arguments: { path: "/src/lib.rs", content: "fn main() {}" },
            },
          ],
          model: "sonnet",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          },
        },
      }),
    ];
    await writeFile(filePath, jsonlLines.join("\n"));

    const map = parseFile(filePath);
    const days = daysFromMap(map);
    const ranges = allRanges;
    const summaries = new Map(ranges.map((r) => [r, summarize(days, r)] as const));

    const dash = new Dashboard(
      summaries,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
    // Navigate to Languages tab (index 1)
    dash.handleInput("\x1b[C"); // right arrow

    const rendered = dash.render(80);
    const text = rendered.join("\n");

    // Should show language data from parsed file
    expect(text).toContain("TypeScript");
    expect(text).toContain("Rust");
  });
});
