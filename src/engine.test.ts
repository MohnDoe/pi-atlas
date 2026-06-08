import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { summarize, computeSignature, writeCache, readCache } from "./engine.js";
import type { DayAgg, CachePayload } from "./types.js";
import { mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

function day(date: string, overrides: Partial<DayAgg> = {}): DayAgg {
  return {
    date,
    cost: 0, inTok: 0, outTok: 0, crTok: 0, cwTok: 0,
    userMsgs: 0, asstMsgs: 0, toolResults: 0,
    sessionIds: new Set(),
    langLines: {}, langEdits: {}, modelCost: {},
    modelCount: {}, projectCost: {},
    projectSessions: {}, toolCount: {},
    ...overrides,
  };
}

describe("summarize", () => {
  it("returns zeros for empty day list", () => {
    const s = summarize([], "All");
    expect(s.totalCost).toBe(0);
    expect(s.sessionCount).toBe(0);
    expect(s.totalMessages).toBe(0);
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
    const days = [
      day("2026-06-08", {
        cost: 1.50,
        sessionIds: new Set(["s1", "s2"]),
        userMsgs: 3,
        asstMsgs: 5,
        toolResults: 4,
        inTok: 1000,
        outTok: 500,
        crTok: 100,
        cwTok: 50,
        modelCost: { "sonnet": 1.00, "haiku": 0.50 },
        modelCount: { "sonnet": 2, "haiku": 3 },
        toolCount: { "bash": 2, "read": 2 },
        langLines: { "typescript": 100 },
        langEdits: { "typescript": 5 },
      }),
    ];

    const s = summarize(days, "1d");
    expect(s.totalCost).toBe(1.50);
    expect(s.sessionCount).toBe(2);
    expect(s.totalMessages).toBe(12); // 3+5+4
    expect(s.totalTokens).toBe(1650); // 1000+500+100+50
    expect(s.daysActive).toBe(1);
    expect(s.avgCostPerDay).toBe(1.50);

    expect(s.models).toHaveLength(2);
    expect(s.models[0]).toEqual({ model: "sonnet", cost: 1.00, calls: 2 });
    expect(s.models[1]).toEqual({ model: "haiku", cost: 0.50, calls: 3 });

    expect(s.tools).toHaveLength(2);
    expect(s.tools).toContainEqual({ tool: "bash", count: 2 });
    expect(s.tools).toContainEqual({ tool: "read", count: 2 });

    expect(s.languages).toEqual([{ language: "typescript", lines: 100, edits: 5 }]);
  });

  it("filters by time range", () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString().slice(0, 10);

    const days = [
      day(today, { cost: 1, sessionIds: new Set(["a"]) }),
      day(yesterday, { cost: 2, sessionIds: new Set(["b"]) }),
      day(eightDaysAgo, { cost: 3, sessionIds: new Set(["c"]) }),
    ];

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
    const days = [
      day("2026-06-05", { cost: 1 }),
      day("2026-06-08", { cost: 2 }),
    ];

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

  it("sorts models by cost descending, tools by count descending", () => {
    const days = [
      day("2026-06-08", {
        modelCost: { cheap: 0.10, expensive: 5.00, mid: 1.00 },
        modelCount: { cheap: 10, expensive: 2, mid: 5 },
        toolCount: { bash: 1, read: 10, edit: 5 },
      }),
    ];

    const s = summarize(days, "All");
    expect(s.models.map((m) => m.model)).toEqual(["expensive", "mid", "cheap"]);
    expect(s.tools.map((t) => t.tool)).toEqual(["read", "edit", "bash"]);
  });

  it("reports todayCost separately", () => {
    const today = new Date().toISOString().slice(0, 10);
    const days = [
      day("2026-01-01", { cost: 100 }),
      day(today, { cost: 5 }),
    ];

    const s = summarize(days, "All");
    expect(s.todayCost).toBe(5);
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
    const days: DayAgg[] = [
      day("2026-06-08", { cost: 1.5, sessionIds: new Set(["s1"]) }),
    ];
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
});
