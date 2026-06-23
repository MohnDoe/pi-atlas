import { describe, expect, it } from "bun:test";
import { summarize } from "../compute";
import { dateFromISOString } from "../format";
import { emptyDay, mergeDay } from "../parser";

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
    expect(s.tools).toContainEqual({ name: "bash", count: 2 });
    expect(s.tools).toContainEqual({ name: "read", count: 2 });

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
    const today = new Date();
    // day0 = 6 days ago, day3 = 3 days ago (both within 7d range)
    const d0 = new Date(today);
    d0.setUTCDate(d0.getUTCDate() - 6);
    const day0 = dateFromISOString(d0.toISOString());
    const d3 = new Date(today);
    d3.setUTCDate(d3.getUTCDate() - 3);
    const day3 = dateFromISOString(d3.toISOString());

    const d1 = emptyDay(day0);
    d1.cost = 1;
    const d2 = emptyDay(day3);
    d2.cost = 2;
    const days = [d1, d2];

    const s = summarize(days, "7d");
    expect(s.dailySpend.length).toBeGreaterThanOrEqual(4);
    // Should include all dates from earliest to latest, with zeros for gaps
    const dates = s.dailySpend.map((d) => d.date);
    expect(dates).toContain(day0);
    expect(dates).toContain(day3);

    // Check gaps are zero-filled (dates between day0 and day3)
    const spendByDate: Record<string, number> = {};
    for (const ds of s.dailySpend) spendByDate[ds.date] = ds.cost;
    expect(spendByDate[day0]).toBe(1);
    expect(spendByDate[day3]).toBe(2);

    // Verify zeros in between
    const dMid = new Date(d0);
    dMid.setUTCDate(dMid.getUTCDate() + 1);
    const midStr = dateFromISOString(dMid.toISOString());
    expect(spendByDate[midStr]).toBe(0);
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
    expect(s.tools.map((t) => t.name)).toEqual(["read", "edit", "bash"]);
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
    const today = new Date();
    const day2ago = new Date(today);
    day2ago.setUTCDate(day2ago.getUTCDate() - 1);
    const day1ago = new Date(today);
    day1ago.setUTCDate(day1ago.getUTCDate() - 0);

    const d1date = dateFromISOString(day2ago.toISOString());
    const d2date = dateFromISOString(day1ago.toISOString());

    const d1 = emptyDay(d1date);
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
    const d2 = emptyDay(d2date);
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

  it("hourlySpend for 1d range has 24 zero-filled entries when no hourly cost", () => {
    const today = dateFromISOString(new Date().toISOString());
    const d = emptyDay(today);
    d.cost = 5;
    d.sessionIds = new Set(["s1"]);
    const days = [d];

    const s = summarize(days, "1d");
    expect(s.hourlySpend).toHaveLength(24);
    for (const h of s.hourlySpend) {
      expect(h.cost).toBe(0);
    }
    // Zero-cost days still produce 24 entries
    const d2 = emptyDay(dateFromISOString(new Date().toISOString()));
    d2.cost = 0;
    d2.sessionIds = new Set(["s2"]);
    const s2 = summarize([d2], "1d");
    expect(s2.hourlySpend).toHaveLength(24);
  });

  it("hourlySpend for 1d maps cost to correct hours", () => {
    const today = dateFromISOString(new Date().toISOString());
    const d = emptyDay(today);
    mergeDay(d, {
      ...emptyDay(""),
      cost: 3.5,
      hourCost: { 10: 1.5, 14: 2.0 },
    });
    const days = [d];

    const s = summarize(days, "1d");
    expect(s.hourlySpend).toHaveLength(24);
    expect(s.hourlySpend[10]!.cost).toBe(1.5);
    expect(s.hourlySpend[14]!.cost).toBe(2.0);
    expect(s.hourlySpend[0]!.cost).toBe(0);
    expect(s.hourlySpend[23]!.cost).toBe(0);
  });

  it("returns providers sorted by cost descending", () => {
    const d = emptyDay("2026-06-08");
    mergeDay(d, {
      ...emptyDay(""),
      providerCost: { anthropic: 5.0, openai: 1.0, free: 0 },
      providerCount: { anthropic: 15, openai: 5, free: 100 },
    });
    const days = [d];

    const s = summarize(days, "All");
    expect(s.providers).toEqual([
      { provider: "anthropic", cost: 5.0, calls: 15 },
      { provider: "openai", cost: 1.0, calls: 5 },
      { provider: "free", cost: 0, calls: 100 },
    ]);
  });

  it("surfaces entry-type fields (compaction, modelChanges, thinkingLevel)", () => {
    const d = emptyDay("2026-06-08");
    mergeDay(d, {
      ...emptyDay(""),
      compactionCount: 2,
      compactedTokens: 15000,
      modelChanges: 3,
      thinkingLevelCount: { low: 1, high: 2 },
    });
    const days = [d];

    const s = summarize(days, "All");
    expect(s.compactionCount).toBe(2);
    expect(s.compactedTokens).toBe(15000);
    expect(s.modelChanges).toBe(3);
    expect(s.thinkingLevelCount).toEqual({ low: 1, high: 2 });
  });

  it("attaches provider to model stats from modelToProvider", () => {
    const d = emptyDay("2026-06-08");
    mergeDay(d, {
      ...emptyDay(""),
      modelCost: { sonnet: 2.0, haiku: 0.5 },
      modelCount: { sonnet: 5, haiku: 2 },
      modelToProvider: new Map([
        ["sonnet", "anthropic"],
        ["haiku", "anthropic"],
      ]),
    });
    const days = [d];

    const s = summarize(days, "All");
    expect(s.models).toHaveLength(2);
    expect(s.models.find((m) => m.model === "sonnet")?.provider).toBe("anthropic");
    expect(s.models.find((m) => m.model === "haiku")?.provider).toBe("anthropic");
  });

  it("deduplicates session IDs across days", () => {
    const d1 = emptyDay("2026-06-01");
    d1.cost = 1;
    d1.sessionIds = new Set(["shared-session"]);
    const d2 = emptyDay("2026-06-02");
    d2.cost = 2;
    d2.sessionIds = new Set(["shared-session"]);
    const d3 = emptyDay("2026-06-03");
    d3.cost = 3;
    d3.sessionIds = new Set(["unique-session"]);
    const days = [d1, d2, d3];

    const s = summarize(days, "All");
    expect(s.sessionCount).toBe(2);
    expect(s.totalCost).toBe(6);
    expect(s.daysActive).toBe(3);
  });

  it("accumulates project stats across days", () => {
    const d1 = emptyDay("2026-06-01");
    d1.cost = 10;
    d1.sessionIds = new Set(["s1"]);
    d1.projectCost = { pi: 10 };
    d1.projectSessions = { pi: new Set(["s1"]) };

    const d2 = emptyDay("2026-06-02");
    d2.cost = 5;
    d2.sessionIds = new Set(["s2"]);
    d2.projectCost = { pi: 5, other: 5 };
    d2.projectSessions = { pi: new Set(["s2"]), other: new Set(["s2"]) };

    const s = summarize([d1, d2], "All");
    expect(s.projects).toHaveLength(2);
    // pi: cost=15, sessions=2; other: cost=5, sessions=1
    // sorted by cost desc
    expect(s.projects[0]).toEqual({ project: "pi", cost: 15, sessions: 2 });
    expect(s.projects[1]).toEqual({ project: "other", cost: 5, sessions: 1 });
  });

  it("excludes days with zero sessions from daysActive", () => {
    const d1 = emptyDay("2026-06-01");
    d1.cost = 10;
    d1.sessionIds = new Set(["s1"]);
    const d2 = emptyDay("2026-06-02");
    d2.cost = 5;
    d2.sessionIds = new Set(["s2"]);
    const d3 = emptyDay("2026-06-03");
    d3.cost = 20;
    d3.sessionIds = new Set(); // no sessions

    const s = summarize([d1, d2, d3], "All");
    expect(s.daysActive).toBe(2);
    expect(s.totalCost).toBe(35); // d3 still counts toward total
    expect(s.avgCostPerDay).toBeCloseTo(17.5); // 35 / 2
  });

  it("fillDailySpend returns single entry for single day in bounded range", () => {
    const today = dateFromISOString(new Date().toISOString());
    const d = emptyDay(today);
    d.cost = 5;
    d.sessionIds = new Set(["s1"]);

    const s = summarize([d], "1d");
    expect(s.dailySpend).toHaveLength(1);
    expect(s.dailySpend[0]).toEqual({ date: today, cost: 5 });
  });

  it("hourlySpend is empty for 7d, 30d, All ranges", () => {
    const d = emptyDay("2026-06-01");
    d.cost = 5;
    d.sessionIds = new Set(["s1"]);
    const days = [d];

    expect(summarize(days, "7d").hourlySpend).toEqual([]);
    expect(summarize(days, "30d").hourlySpend).toEqual([]);
    expect(summarize(days, "All").hourlySpend).toEqual([]);
  });

  it("hourlySpend is empty when 1d range has no matching days", () => {
    // Date is in the past, not matching today
    const d = emptyDay("2026-06-01");
    d.cost = 5;
    d.sessionIds = new Set(["s1"]);

    const s = summarize([d], "1d");
    expect(s.hourlySpend).toEqual([]);
    expect(s.dailySpend).toEqual([]);
  });
});
