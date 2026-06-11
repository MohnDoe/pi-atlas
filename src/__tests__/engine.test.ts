import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeSignature, getCacheTimestamp, loadAggregate, readCache, summarize, writeCache } from "../engine.js";
import { dateFromISOString, emptyDay, mergeDay } from "../parser.js";
import { DayAgg } from "../types.js";

describe("summarize", () => {
  it("returns zeros for empty day list", () => {
    const s = summarize([], "All");
    expect(s.totalCost).toBe(0);
    expect(s.sessionCount).toBe(0);
    expect(s.totalMessages).toBe(0);
    expect(s.totalOutputTokens).toBe(0);
    expect(s.totalInputTokens).toBe(0);
    expect(s.totalCacheWriteTokens).toBe(0);
    expect(s.totalCacheReadTokens).toBe(0);
    expect(s.totalTokens).toBe(0);
    expect(s.daysActive).toBe(0);
    expect(s.avgCostPerDay).toBe(0);
    expect(s.dailySpend).toEqual([]);
    expect(s.languages).toEqual([]);
    expect(s.models).toEqual([]);
    expect(s.projects).toEqual([]);
    expect(s.tools).toEqual([]);
  });

  it("computes KPIs from a single day", () => {
    const today = dateFromISOString(new Date().toISOString());
    const d = emptyDay(today);
    mergeDay(d, {
      ...emptyDay(today),
      cost: 1.5,
      sessionIds: new Set(["s1", "s2"]),
      userMsgs: 3,
      asstMsgs: 5,
      toolResults: 4,
      inTok: 1000,
      outTok: 500,
      crTok: 100,
      cwTok: 50,
      modelCost: { sonnet: 1.0, haiku: 0.5 },
      modelCount: { sonnet: 2, haiku: 3 },
      toolCount: { bash: 2, read: 2 },
      langLines: { typescript: 100 },
      langEdits: { typescript: 5 },
    });
    const days = [d];

    const s = summarize(days, "1d");
    expect(s.totalCost).toBe(1.5);
    expect(s.sessionCount).toBe(2);
    expect(s.totalMessages).toBe(12); // 3+5+4
    expect(s.totalInputTokens).toBe(1000);
    expect(s.totalOutputTokens).toBe(500);
    expect(s.totalCacheReadTokens).toBe(100);
    expect(s.totalCacheWriteTokens).toBe(50);
    expect(s.totalTokens).toBe(1650); // 1000+500+100+50
    expect(s.daysActive).toBe(1);
    expect(s.avgCostPerDay).toBe(1.5);

    expect(s.models).toHaveLength(2);
    expect(s.models[0]).toEqual({ model: "sonnet", cost: 1.0, calls: 2 });
    expect(s.models[1]).toEqual({ model: "haiku", cost: 0.5, calls: 3 });

    expect(s.tools).toHaveLength(2);
    expect(s.tools).toContainEqual({ tool: "bash", count: 2 });
    expect(s.tools).toContainEqual({ tool: "read", count: 2 });

    expect(s.languages).toEqual([{ language: "typescript", lines: 100, edits: 5 }]);
  });

  it("filters by time range", () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);

    const d1 = emptyDay(today);
    d1.cost = 1;
    d1.sessionIds = new Set(["a"]);
    const d2 = emptyDay(yesterday);
    d2.cost = 2;
    d2.sessionIds = new Set(["b"]);
    const d3 = emptyDay(eightDaysAgo);
    d3.cost = 3;
    d3.sessionIds = new Set(["c"]);
    const days = [d1, d2, d3];

    // "1d" - only today
    expect(summarize(days, "1d").totalCost).toBe(1);

    // "7d" - today + yesterday
    const s7 = summarize(days, "7d");
    expect(s7.totalCost).toBe(3);
    expect(s7.daysActive).toBe(2);

    // "30d" - all three (since 8 days is within 30)
    const s30 = summarize(days, "30d");
    expect(s30.totalCost).toBe(6);
    expect(s30.daysActive).toBe(3);

    // "All"
    const sAll = summarize(days, "All");
    expect(sAll.totalCost).toBe(6);
    expect(sAll.daysActive).toBe(3);
  });

  it("computes daily spend with zero-fill for gaps", () => {
    const d1 = emptyDay("2026-06-05");
    d1.cost = 1;
    const d2 = emptyDay("2026-06-08");
    d2.cost = 2;
    const days = [d1, d2];

    const s = summarize(days, "7d");
    expect(s.dailySpend.length).toBeGreaterThanOrEqual(4);
    // Should include all dates from earliest to latest, with zeros for gaps
    const dates = s.dailySpend.map((d) => d.date);
    expect(dates).toContain("2026-06-05");
    expect(dates).toContain("2026-06-06");
    expect(dates).toContain("2026-06-07");
    expect(dates).toContain("2026-06-08");

    const spendByDate: Record<string, number> = {};
    for (const ds of s.dailySpend) spendByDate[ds.date] = ds.cost;
    expect(spendByDate["2026-06-05"]).toBe(1);
    expect(spendByDate["2026-06-06"]).toBe(0);
    expect(spendByDate["2026-06-07"]).toBe(0);
    expect(spendByDate["2026-06-08"]).toBe(2);
  });

  it("sorts models by cost descending (then calls descending), tools by count descending", () => {
    const d = emptyDay("2026-06-08");
    mergeDay(d, {
      ...emptyDay(""),
      modelCost: {
        free: 0,
        secondFree: 0,
        cheap: 0.1,
        duplicatedCheap: 0.1,
        expensive: 5.0,
        mid: 1.0,
      },
      modelCount: { free: 12, secondFree: 15, cheap: 10, duplicatedCheap: 8, expensive: 2, mid: 5 },
      toolCount: { bash: 1, read: 10, edit: 5 },
    });
    const days = [d];

    const s = summarize(days, "All");
    expect(s.models.map((m) => m.model)).toEqual([
      "expensive",
      "mid",
      "cheap",
      "duplicatedCheap",
      "secondFree",
      "free",
    ]);
    expect(s.tools.map((t) => t.tool)).toEqual(["read", "edit", "bash"]);
  });

  it("reports todayCost separately", () => {
    const today = new Date().toISOString().slice(0, 10);
    const d1 = emptyDay("2026-01-01");
    d1.cost = 100;
    const todayAgg = emptyDay(today);
    todayAgg.cost = 5;
    const days = [d1, todayAgg];

    const s = summarize(days, "All");
    expect(s.todayCost).toBe(5);
  });

  it("returns todayCost 0 when today is not in filtered range", () => {
    const d1 = emptyDay("2026-06-01");
    d1.cost = 10;
    d1.sessionIds = new Set(["s1"]);
    const days = [d1];

    // 1d range filters to today only, which has no data
    const s = summarize(days, "1d");
    expect(s.todayCost).toBe(0);
    expect(s.totalCost).toBe(0);
  });

  it("dailySpend for All range is sorted dates without zero-fill", () => {
    const d1 = emptyDay("2026-06-01");
    d1.cost = 1;
    d1.sessionIds = new Set(["a"]);
    const d2 = emptyDay("2026-06-05");
    d2.cost = 5;
    d2.sessionIds = new Set(["b"]);
    const d3 = emptyDay("2026-06-10");
    d3.cost = 10;
    d3.sessionIds = new Set(["c"]);
    const days = [d3, d1, d2]; // unsorted input

    const s = summarize(days, "All");
    // All range does NOT zero-fill gaps — returns only days with data
    expect(s.dailySpend).toHaveLength(3);
    expect(s.dailySpend[0]).toEqual({ date: "2026-06-01", cost: 1 });
    expect(s.dailySpend[1]).toEqual({ date: "2026-06-05", cost: 5 });
    expect(s.dailySpend[2]).toEqual({ date: "2026-06-10", cost: 10 });
  });

  it("computes all KPIs for multiple-day 7d range", () => {
    const d1 = emptyDay("2026-06-05");
    mergeDay(d1, {
      ...emptyDay(""),
      cost: 2.5,
      sessionIds: new Set(["s1"]),
      userMsgs: 5,
      asstMsgs: 8,
      toolResults: 3,
      inTok: 500,
      outTok: 200,
      crTok: 10,
      cwTok: 5,
      modelCost: { sonnet: 2.0, haiku: 0.5 },
      modelCount: { sonnet: 4, haiku: 2 },
      toolCount: { bash: 3, read: 2 },
      langLines: { TypeScript: 100, Python: 50 },
      langEdits: { TypeScript: 3, Python: 1 },
    });
    const d2 = emptyDay("2026-06-06");
    mergeDay(d2, {
      ...emptyDay(""),
      cost: 1.5,
      sessionIds: new Set(["s2"]),
      userMsgs: 3,
      asstMsgs: 4,
      toolResults: 1,
      inTok: 300,
      outTok: 100,
      crTok: 0,
      cwTok: 0,
      modelCost: { sonnet: 1.5 },
      modelCount: { sonnet: 3 },
      toolCount: { edit: 1, write: 1 },
      langLines: { Python: 200 },
      langEdits: { Python: 2 },
    });
    // June 05-08 are within 7d range (assuming today is June 08+)
    const days = [d1, d2];

    const s = summarize(days, "7d");
    expect(s.totalCost).toBe(4.0);
    expect(s.sessionCount).toBe(2);
    expect(s.totalMessages).toBe(24); // 5+8+3 + 3+4+1
    expect(s.totalInputTokens).toBe(800); // 500 + 300
    expect(s.totalOutputTokens).toBe(300); // 200 + 100
    expect(s.totalCacheReadTokens).toBe(10); // 10 + 0
    expect(s.totalCacheWriteTokens).toBe(5); // 5 + 0
    expect(s.totalTokens).toBe(1115); // 500+200+10+5 + 300+100
    expect(s.daysActive).toBe(2);
    expect(s.avgCostPerDay).toBeCloseTo(2.0);

    // Languages sorted by lines descending
    expect(s.languages).toEqual([
      { language: "Python", lines: 250, edits: 3 },
      { language: "TypeScript", lines: 100, edits: 3 },
    ]);

    // Models sorted by cost
    expect(s.models).toEqual([
      { model: "sonnet", cost: 3.5, calls: 7 },
      { model: "haiku", cost: 0.5, calls: 2 },
    ]);
  });
});

describe("computeSignature", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-usage-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty string for empty directory", async () => {
    const sig = await computeSignature(tmpDir);
    expect(sig).toBe("");
  });

  it("returns a non-empty hash for a directory with files", async () => {
    await writeFile(join(tmpDir, "a.jsonl"), "line1\n");
    await writeFile(join(tmpDir, "b.jsonl"), "line2\n");

    const sig1 = await computeSignature(tmpDir);
    expect(sig1).toBeTruthy();
    expect(sig1.length).toBeGreaterThan(0);

    // Same directory, same signature
    const sig2 = await computeSignature(tmpDir);
    expect(sig2).toBe(sig1);
  });

  it("changes when a file is modified", async () => {
    await writeFile(join(tmpDir, "a.jsonl"), "original\n");
    const sig1 = await computeSignature(tmpDir);

    await writeFile(join(tmpDir, "a.jsonl"), "modified\n");
    const sig2 = await computeSignature(tmpDir);

    expect(sig2).not.toBe(sig1);
  });

  it("changes when a file is added", async () => {
    await writeFile(join(tmpDir, "a.jsonl"), "data\n");
    const sig1 = await computeSignature(tmpDir);

    await writeFile(join(tmpDir, "b.jsonl"), "more\n");
    const sig2 = await computeSignature(tmpDir);

    expect(sig2).not.toBe(sig1);
  });

  it("scans subdirectories", async () => {
    const subDir = join(tmpDir, "project-a");
    await mkdir(subDir);
    await writeFile(join(subDir, "s1.jsonl"), "data\n");

    const sig = await computeSignature(tmpDir);
    expect(sig).toBeTruthy();
    expect(sig.length).toBeGreaterThan(0);
  });

  it("ignores non-.jsonl files", async () => {
    await writeFile(join(tmpDir, "README.md"), "docs\n");
    const sig = await computeSignature(tmpDir);
    expect(sig).toBe("");
  });
});

describe("cache read/write", () => {
  let tmpDir: string;
  let cachePath: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-usage-cache-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    cachePath = join(tmpDir, "cache.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads cache", async () => {
    const d = emptyDay("2026-06-08");
    d.cost = 1.5;
    d.sessionIds = new Set(["s1"]);
    const days: DayAgg[] = [d];
    await writeCache(cachePath, "sig-abc", days);

    const payload = await readCache(cachePath);
    expect(payload).toBeDefined();
    expect(payload!.signature).toBe("sig-abc");
    expect(payload!.days).toHaveLength(1);
    expect(payload!.days[0].date).toBe("2026-06-08");
    expect(payload!.days[0].cost).toBe(1.5);
    // Sets are serialized as arrays
    expect(payload!.days[0].sessionIds).toEqual(["s1"]);
  });

  it("returns null for missing cache file", async () => {
    const payload = await readCache("/nonexistent/path/cache.json");
    expect(payload).toBeNull();
  });

  it("returns null for corrupt cache", async () => {
    await writeFile(cachePath, "not-json");
    const payload = await readCache(cachePath);
    expect(payload).toBeNull();
  });

  it("returns generatedAt from valid cache", async () => {
    const d = emptyDay("2026-06-08");
    await writeCache(cachePath, "sig-abc", [d]);
    const ts = await getCacheTimestamp(cachePath);
    expect(ts).not.toBeNull();
    // generatedAt is an ISO string
    expect(new Date(ts!).toISOString()).toBe(ts);
  });

  it("returns null for missing cache", async () => {
    const ts = await getCacheTimestamp("/nonexistent/cache.json");
    expect(ts).toBeNull();
  });

  it("returns null for corrupt cache", async () => {
    await writeFile(cachePath, "not-json");
    const ts = await getCacheTimestamp(cachePath);
    expect(ts).toBeNull();
  });
});

describe("loadAggregate", () => {
  let tmpDir: string;
  let sessionsDir: string;
  let cachePath: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-usage-load-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    sessionsDir = join(tmpDir, "sessions");
    await mkdir(sessionsDir, { recursive: true });
    cachePath = join(tmpDir, "cache.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for empty sessions dir", async () => {
    const days = await loadAggregate(cachePath, sessionsDir);
    expect(days).toEqual([]);
  });

  it("parses session files and returns DayAgg array", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: "2026-06-08T10:01:00.000Z",
          message: { role: "user", content: [{ type: "text", text: "hi" }] },
        }),
      ].join("\n"),
    );

    const days = await loadAggregate(cachePath, sessionsDir);
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-06-08");
    expect(days[0].userMsgs).toBe(1);
  });

  it("caches results and reuses them", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
      ].join("\n"),
    );

    const days1 = await loadAggregate(cachePath, sessionsDir);
    expect(days1).toHaveLength(1);

    // Second call should use cache
    const days2 = await loadAggregate(cachePath, sessionsDir);
    expect(days2).toHaveLength(1);
  });

  it("invalidates cache when session files change", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
      ].join("\n"),
    );

    await loadAggregate(cachePath, sessionsDir);

    // Add a new file
    await writeFile(
      join(subDir, "s2.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s2",
          timestamp: "2026-06-09T10:00:00.000Z",
          cwd: "/home/doe/proj-b",
        }),
      ].join("\n"),
    );

    const days = await loadAggregate(cachePath, sessionsDir);
    expect(days).toHaveLength(2); // two days now
  });

  it("logs corrupt line count to stderr", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "mixed.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
        "not valid json",
        "also broken {",
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: "2026-06-08T10:01:00.000Z",
          message: { role: "user", content: [{ type: "text", text: "hi" }] },
        }),
      ].join("\n"),
    );

    const errors: string[] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });

    try {
      await loadAggregate(cachePath, sessionsDir, true);

      expect(errors.length).toBeGreaterThan(0);
      const warning = errors.find((e) => e.includes("corrupt"));
      expect(warning).toBeDefined();
      expect(warning).toContain("2"); // 2 corrupt lines
    } finally {
      spy.mockRestore();
    }
  });

  it("calls onProgress during parsing", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
      ].join("\n"),
    );

    const progress: number[] = [];
    await loadAggregate(cachePath, sessionsDir, false, (p) => progress.push(p));

    // Should have reported some progress
    expect(progress.length).toBeGreaterThan(0);
  });
});
