import type { Api } from "@earendil-works/pi-ai";
import { describe, expect, it } from "bun:test";
import { summarize } from "./compute";
import { makeSessionAgg } from "./helpers/session.helper";
import type { SessionAgg } from "./types";

// Helper: add a model to a session
function addModelToSession(
  s: SessionAgg,
  modelName: string,
  opts: {
    cost?: number;
    calls?: number;
    inTok?: number;
    outTok?: number;
    crTok?: number;
    cwTok?: number;
    asstMsgs?: number;
    tools?: Record<string, number>;
    languages?: Record<string, { lines: number; edits: number }>;
  } = {},
  provider?: string,
  api?: Api,
): void {
  if (!s.models[provider || "p"]) {
    s.models[provider || "p"] = {};
  }
  s.models[provider || "p"]![modelName] = {
    provider: provider ?? "p",
    api: api ?? "openai-completions",
    usage: {
      cost: {
        total: opts.cost ?? 0,
        cacheRead: 0,
        cacheWrite: 0,
        input: 0,
        output: 0,
      },
      cacheRead: opts.crTok ?? 0,
      cacheWrite: opts.cwTok ?? 0,
      input: opts.inTok ?? 0,
      output: opts.outTok ?? 0,
      totalTokens: (opts.inTok ?? 0) + (opts.outTok ?? 0) + (opts.crTok ?? 0) + (opts.cwTok ?? 0),
    },
    calls: opts.calls ?? 0,
    asstMsgs: opts.asstMsgs ?? 0,
    tools: opts.tools ?? {},
    languages: opts.languages ?? {},
  };
}

describe("summarize", () => {
  it("returns zeros for empty session list", () => {
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

  it("computes KPIs from a single session", () => {
    const s = makeSessionAgg({ sessionId: "s1", timestamp: new Date().toISOString() });
    addModelToSession(
      s,
      "sonnet",
      {
        cost: 1.0,
        calls: 2,
        asstMsgs: 5,
        inTok: 1000,
        outTok: 500,
        crTok: 100,
        cwTok: 50,
      },
      "anthropic",
    );
    addModelToSession(
      s,
      "haiku",
      {
        cost: 0.5,
        calls: 3,
        asstMsgs: 4,
        inTok: 300,
        outTok: 150,
        crTok: 30,
        cwTok: 15,
      },
      "anthropic",
    );
    s.userMsgs = 3;
    s.toolResults = 4;

    const result = summarize([s], "All");
    expect(result.totalCost).toBe(1.5);
    expect(result.sessionCount).toBe(1);
    expect(result.totalMessages).toBe(16); // 3+4 + 5+4
    expect(result.totalInputTokens).toBe(1300);
    expect(result.totalOutputTokens).toBe(650);
    expect(result.totalCacheReadTokens).toBe(130);
    expect(result.totalCacheWriteTokens).toBe(65);
    expect(result.totalTokens).toBe(2145); // 1300+650+130+65

    expect(result.models).toHaveLength(2);
    expect(result.models[0]).toEqual({
      model: "sonnet",
      cost: 1.0,
      calls: 2,
      provider: "anthropic",
    });
    expect(result.models[1]).toEqual({
      model: "haiku",
      cost: 0.5,
      calls: 3,
      provider: "anthropic",
    });
  });

  it("filters by time range", () => {
    const today = new Date().toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();

    const s1 = makeSessionAgg({ sessionId: "a", timestamp: today });
    addModelToSession(s1, "m", { cost: 1, calls: 1 });

    const s2 = makeSessionAgg({ sessionId: "b", timestamp: yesterday });
    addModelToSession(s2, "m", { cost: 2, calls: 1 });

    const s3 = makeSessionAgg({ sessionId: "c", timestamp: eightDaysAgo });
    addModelToSession(s3, "m", { cost: 3, calls: 1 });

    const all = [s1, s2, s3];

    expect(summarize(all, "1d").totalCost).toBe(1);
    expect(summarize(all, "7d").totalCost).toBe(3); // today + yesterday
    expect(summarize(all, "30d").totalCost).toBe(6);
    expect(summarize(all, "All").totalCost).toBe(6);
  });

  it("computes daily spend with zero-fill for gaps", () => {
    const today = new Date();
    const d0 = new Date(today);
    d0.setUTCDate(d0.getUTCDate() - 6);
    const day0 = d0.toISOString();
    const day0Date = day0.slice(0, 10);
    const d3 = new Date(today);
    d3.setUTCDate(d3.getUTCDate() - 3);
    const day3 = d3.toISOString();
    const day3Date = day3.slice(0, 10);

    const s1 = makeSessionAgg({ sessionId: "s1", timestamp: day0 });
    addModelToSession(s1, "m", { cost: 1, calls: 1 });

    const s2 = makeSessionAgg({ sessionId: "s2", timestamp: day3 });
    addModelToSession(s2, "m", { cost: 2, calls: 1 });

    const result = summarize([s1, s2], "7d");
    expect(result.dailySpend.length).toBeGreaterThanOrEqual(4);
    const spendByDate: Record<string, number> = {};
    for (const ds of result.dailySpend) spendByDate[ds.date] = ds.cost;
    expect(spendByDate[day0Date]).toBe(1);
    expect(spendByDate[day3Date]).toBe(2);

    // Verify zeros in between
    const dMid = new Date(d0);
    dMid.setUTCDate(dMid.getUTCDate() + 1);
    const midStr = dMid.toISOString().slice(0, 10);
    expect(spendByDate[midStr]).toBe(0);
  });

  it("sorts models by cost descending (then calls descending), tools by count descending", () => {
    const s1 = makeSessionAgg({ sessionId: "s1", timestamp: new Date().toISOString() });
    addModelToSession(s1, "free", { cost: 0, calls: 12 });
    addModelToSession(s1, "secondFree", { cost: 0, calls: 15 });
    addModelToSession(s1, "cheap", { cost: 0.1, calls: 10 });
    addModelToSession(s1, "duplicatedCheap", { cost: 0.1, calls: 8 });
    addModelToSession(s1, "expensive", {
      cost: 5.0,
      calls: 2,
      tools: { bash: 1, read: 10, edit: 5 },
    });
    addModelToSession(s1, "mid", { cost: 1.0, calls: 5 });

    const result = summarize([s1], "All");
    expect(result.models.map((m) => m.model)).toEqual([
      "expensive",
      "mid",
      "cheap",
      "duplicatedCheap",
      "secondFree",
      "free",
    ]);
    expect(result.tools.map((t) => t.name)).toEqual(["read", "edit", "bash"]);
  });

  it("reports todayCost separately", () => {
    const today = new Date().toISOString();
    const s1 = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-01-01").toISOString() });
    addModelToSession(s1, "m", { cost: 100, calls: 1 });

    const s2 = makeSessionAgg({ sessionId: "s2", timestamp: today });
    addModelToSession(s2, "m", { cost: 5, calls: 1 });

    const result = summarize([s1, s2], "All");
    expect(result.todayCost).toBe(5);
  });

  it("returns todayCost 0 when today is not in filtered range", () => {
    const s1 = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-01").toISOString() });
    addModelToSession(s1, "m", { cost: 10, calls: 1 });

    const result = summarize([s1], "1d");
    expect(result.todayCost).toBe(0);
    expect(result.totalCost).toBe(0);
  });

  it("dailySpend for All range is sorted dates without zero-fill", () => {
    const s1 = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-01").toISOString() });
    addModelToSession(s1, "m", { cost: 1, calls: 1 });

    const s2 = makeSessionAgg({ sessionId: "s2", timestamp: new Date("2026-06-05").toISOString() });
    addModelToSession(s2, "m", { cost: 5, calls: 1 });

    const s3 = makeSessionAgg({ sessionId: "s3", timestamp: new Date("2026-06-10").toISOString() });
    addModelToSession(s3, "m", { cost: 10, calls: 1 });

    const result = summarize([s3, s1, s2], "All");
    expect(result.dailySpend).toHaveLength(3);
    expect(result.dailySpend[0]).toEqual({ date: "2026-06-01", cost: 1 });
    expect(result.dailySpend[1]).toEqual({ date: "2026-06-05", cost: 5 });
    expect(result.dailySpend[2]).toEqual({ date: "2026-06-10", cost: 10 });
  });

  it("computes all KPIs for multi-session 7d range", () => {
    const today = new Date();
    const day2ago = new Date(today);
    day2ago.setUTCDate(day2ago.getUTCDate() - 1);
    const day1ago = new Date(today);
    day1ago.setUTCDate(day1ago.getUTCDate() - 0);

    const d1 = day2ago.toISOString();
    const d2 = day1ago.toISOString();

    const s1 = makeSessionAgg({ sessionId: "s1", timestamp: d1, userMsgs: 5, toolResults: 3 });
    addModelToSession(
      s1,
      "sonnet",
      {
        cost: 2.0,
        calls: 4,
        asstMsgs: 8,
        inTok: 500,
        outTok: 200,
        crTok: 10,
        cwTok: 5,
      },
      "anthropic",
    );
    addModelToSession(
      s1,
      "haiku",
      {
        cost: 0.5,
        calls: 2,
        asstMsgs: 0,
        inTok: 100,
        outTok: 50,
        crTok: 0,
        cwTok: 0,
      },
      "anthropic",
    );
    s1.models["anthropic"]!["sonnet"]!.tools = { bash: 3, read: 2 };
    s1.models["anthropic"]!["sonnet"]!.languages = {
      TypeScript: { lines: 100, edits: 3 },
      Python: { lines: 50, edits: 1 },
    };
    s1.models["anthropic"]!["haiku"]!.tools = { bash: 1, read: 1 };

    const s2 = makeSessionAgg({ sessionId: "s2", timestamp: d2, userMsgs: 3, toolResults: 1 });
    addModelToSession(
      s2,
      "sonnet",
      {
        cost: 1.5,
        calls: 3,
        asstMsgs: 4,
        inTok: 300,
        outTok: 100,
        crTok: 0,
        cwTok: 0,
      },
      "anthropic",
    );
    s2.models["anthropic"]!["sonnet"]!.tools = { edit: 1, write: 1 };
    s2.models["anthropic"]!["sonnet"]!.languages = { Python: { lines: 200, edits: 2 } };

    const result = summarize([s1, s2], "7d");
    expect(result.totalCost).toBe(4.0);
    expect(result.sessionCount).toBe(2);
    expect(result.totalMessages).toBe(24); // (5+3+8) + (3+1+4)
    expect(result.totalInputTokens).toBe(900); // 500+100 + 300
    expect(result.totalOutputTokens).toBe(350); // 200+50 + 100
    expect(result.totalCacheReadTokens).toBe(10); // 10 + 0
    expect(result.totalCacheWriteTokens).toBe(5); // 5 + 0
    expect(result.totalTokens).toBe(1265); // 500+200+10+5+100+50 + 300+100
    expect(result.daysActive).toBe(2);
    expect(result.avgCostPerDay).toBeCloseTo(2.0);

    // Languages sorted by lines descending
    expect(result.languages).toEqual([
      { language: "Python", lines: 250, edits: 3 },
      { language: "TypeScript", lines: 100, edits: 3 },
    ]);

    // Models sorted by cost
    expect(result.models).toEqual([
      { model: "sonnet", cost: 3.5, calls: 7, provider: "anthropic" },
      { model: "haiku", cost: 0.5, calls: 2, provider: "anthropic" },
    ]);

    // Tools aggregated
    expect(result.tools).toContainEqual({ name: "bash", count: 4 });
    expect(result.tools).toContainEqual({ name: "read", count: 3 });
    expect(result.tools).toContainEqual({ name: "edit", count: 1 });
    expect(result.tools).toContainEqual({ name: "write", count: 1 });
  });

  it("hourlySpend for 1d range has 24 zero-filled entries when no hourly cost", () => {
    const today = new Date();
    today.setHours(15);
    const s = makeSessionAgg({ sessionId: "s1", timestamp: today.toISOString() });
    addModelToSession(s, "m", { cost: 5, calls: 1 });

    const result = summarize([s], "1d");
    expect(result.hourlySpend).toHaveLength(24);

    expect(result.hourlySpend[15]?.cost).toBe(5);
  });

  it("hourlySpend for 1d maps cost to correct hours", () => {
    const todayMorning = new Date();
    todayMorning.setHours(10);

    const todayAfternoon = new Date();
    todayAfternoon.setHours(15);
    const todayMorningSession = makeSessionAgg({
      sessionId: "s1",
      timestamp: todayMorning.toISOString(),
    });
    const todayAfternoonSession = makeSessionAgg({
      sessionId: "s2",
      timestamp: todayAfternoon.toISOString(),
    });
    addModelToSession(todayMorningSession, "m", { cost: 1.5, calls: 1 });
    addModelToSession(todayAfternoonSession, "m", { cost: 2, calls: 1 });

    const result = summarize([todayMorningSession, todayAfternoonSession], "1d");
    expect(result.hourlySpend).toHaveLength(24);
    expect(result.hourlySpend[10]!.cost).toBe(1.5);
    expect(result.hourlySpend[15]!.cost).toBe(2.0);
  });

  it("returns providers sorted by cost descending", () => {
    const s = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-08").toISOString() });
    addModelToSession(s, "sonnet", { cost: 5.0, calls: 15 }, "anthropic");
    addModelToSession(s, "gpt-5", { cost: 1.0, calls: 5 }, "openai");
    addModelToSession(s, "free-model", { cost: 0, calls: 100 }, "free-model");

    const result = summarize([s], "All");
    expect(result.providers).toEqual([
      { provider: "anthropic", cost: 5.0, calls: 15 },
      { provider: "openai", cost: 1.0, calls: 5 },
      { provider: "free-model", cost: 0, calls: 100 },
    ]);
  });

  it("surfaces entry-type fields (compaction, modelChanges, thinkingLevel)", () => {
    const s = makeSessionAgg({
      sessionId: "s1",
      timestamp: new Date("2026-06-08").toISOString(),
      compactionCount: 2,
      compactedTokens: 15000,
      modelChanges: 3,
      thinkingLevelCount: { low: 1, high: 2 },
    });
    addModelToSession(s, "m", { cost: 1, calls: 1 });

    const result = summarize([s], "All");
    expect(result.compactionCount).toBe(2);
    expect(result.compactedTokens).toBe(15000);
    expect(result.modelChanges).toBe(3);
    expect(result.thinkingLevelCount).toEqual({ low: 1, high: 2 });
  });

  it("attaches provider to model stats", () => {
    const s = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-08").toISOString() });
    addModelToSession(s, "sonnet", { cost: 2.0, calls: 5 }, "anthropic");
    addModelToSession(s, "haiku", { cost: 0.5, calls: 2 }, "anthropic");

    const result = summarize([s], "All");
    expect(result.models).toHaveLength(2);
    expect(result.models.find((m) => m.model === "sonnet")?.provider).toBe("anthropic");
    expect(result.models.find((m) => m.model === "haiku")?.provider).toBe("anthropic");
  });

  it("deduplicates session IDs across multiple sessions with same ID", () => {
    // With SessionAgg, each session has a unique ID, but test dedup
    const s1 = makeSessionAgg({
      sessionId: "shared",
      timestamp: new Date("2026-06-01").toISOString(),
    });
    addModelToSession(s1, "m", { cost: 1, calls: 1 });
    const s2 = makeSessionAgg({
      sessionId: "shared",
      timestamp: new Date("2026-06-02").toISOString(),
    });
    addModelToSession(s2, "m", { cost: 2, calls: 1 });
    const s3 = makeSessionAgg({
      sessionId: "unique",
      timestamp: new Date("2026-06-03").toISOString(),
    });
    addModelToSession(s3, "m", { cost: 3, calls: 1 });

    const result = summarize([s1, s2, s3], "All");
    expect(result.sessionCount).toBe(2);
    expect(result.totalCost).toBe(6);
    expect(result.daysActive).toBe(3);
  });

  it("accumulates project stats across sessions", () => {
    const s1 = makeSessionAgg({
      sessionId: "s1",
      timestamp: new Date("2026-06-01").toISOString(),
      project: "pi",
    });
    addModelToSession(s1, "m", { cost: 10, calls: 1 });

    const s2 = makeSessionAgg({
      sessionId: "s2",
      timestamp: new Date("2026-06-02").toISOString(),
      project: "pi",
    });
    addModelToSession(s2, "m", { cost: 5, calls: 1 });

    const s3 = makeSessionAgg({
      sessionId: "s3",
      timestamp: new Date("2026-06-02").toISOString(),
      project: "other",
    });
    addModelToSession(s3, "m", { cost: 5, calls: 1 });

    const result = summarize([s1, s2, s3], "All");
    expect(result.projects).toHaveLength(2);
    expect(result.projects[0]).toEqual({ project: "pi", cost: 15, sessions: 2 });
    expect(result.projects[1]).toEqual({ project: "other", cost: 5, sessions: 1 });
  });

  it("excludes sessions with zero models from daysActive", () => {
    const s1 = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-01").toISOString() });
    addModelToSession(s1, "m", { cost: 10, calls: 1 });

    const s2 = makeSessionAgg({ sessionId: "s2", timestamp: new Date("2026-06-02").toISOString() });
    addModelToSession(s2, "m", { cost: 5, calls: 1 });

    const s3 = makeSessionAgg({ sessionId: "s3", timestamp: new Date("2026-06-03").toISOString() }); // no models

    const result = summarize([s1, s2, s3], "All");
    expect(result.daysActive).toBe(2);
    expect(result.totalCost).toBe(15);
    expect(result.avgCostPerDay).toBeCloseTo(7.5); // 15 / 2
  });

  it("fillDailySpend returns single entry for single day in bounded range", () => {
    const todayISO = new Date().toISOString();
    const todayDate = todayISO.slice(0, 10);
    const s = makeSessionAgg({ sessionId: "s1", timestamp: todayISO });
    addModelToSession(s, "m", { cost: 5, calls: 1 });

    const result = summarize([s], "1d");
    expect(result.dailySpend).toHaveLength(1);
    expect(result.dailySpend[0]).toEqual({ date: todayDate, cost: 5 });
  });

  it("hourlySpend is empty for 7d, 30d, All ranges", () => {
    const s = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-01").toISOString() });
    addModelToSession(s, "m", { cost: 5, calls: 1 });

    expect(summarize([s], "7d").hourlySpend).toEqual([]);
    expect(summarize([s], "30d").hourlySpend).toEqual([]);
    expect(summarize([s], "All").hourlySpend).toEqual([]);
  });

  it("hourlySpend is empty when 1d range has no matching days", () => {
    const s = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-01").toISOString() });
    addModelToSession(s, "m", { cost: 5, calls: 1 });

    const result = summarize([s], "1d");
    expect(result.hourlySpend).toEqual([]);
    expect(result.dailySpend).toEqual([]);
  });

  // ================ FILTER TESTS ================

  it("filters by project", () => {
    const s1 = makeSessionAgg({
      sessionId: "s1",
      timestamp: new Date("2026-06-01").toISOString(),
      project: "alpha",
    });
    addModelToSession(s1, "m", { cost: 10, calls: 1 });

    const s2 = makeSessionAgg({
      sessionId: "s2",
      timestamp: new Date("2026-06-02").toISOString(),
      project: "beta",
    });
    addModelToSession(s2, "m", { cost: 20, calls: 1 });

    const result = summarize([s1, s2], "All", { project: "alpha" });
    expect(result.totalCost).toBe(10);
    expect(result.sessionCount).toBe(1);
    expect(result.projects).toHaveLength(1);
    expect(result.projects[0]!.project).toBe("alpha");
  });

  it("filters by model", () => {
    const s = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-01").toISOString() });
    addModelToSession(s, "sonnet", {
      cost: 10,
      calls: 2,
      inTok: 500,
      outTok: 200,
      tools: { bash: 3 },
      languages: { TS: { lines: 10, edits: 1 } },
    });
    addModelToSession(s, "haiku", {
      cost: 5,
      calls: 1,
      inTok: 100,
      outTok: 50,
      tools: { read: 2 },
      languages: { PY: { lines: 5, edits: 0 } },
    });

    const result = summarize([s], "All", { model: "sonnet" });
    expect(result.totalCost).toBe(10);
    expect(result.totalInputTokens).toBe(500);
    expect(result.totalOutputTokens).toBe(200);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.model).toBe("sonnet");
    expect(result.tools).toEqual([{ name: "bash", count: 3 }]);
    expect(result.languages).toEqual([{ language: "TS", lines: 10, edits: 1 }]);
  });

  it("filters by provider", () => {
    const s = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-01").toISOString() });
    addModelToSession(s, "sonnet", { cost: 10, calls: 2 }, "anthropic");
    addModelToSession(s, "gpt-5", { cost: 5, calls: 1 }, "openai");

    const result = summarize([s], "All", { provider: "anthropic" });
    expect(result.totalCost).toBe(10);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.model).toBe("sonnet");
    expect(result.providers).toEqual([{ provider: "anthropic", cost: 10, calls: 2 }]);
  });

  it("filters combined: project + model + provider", () => {
    const s1 = makeSessionAgg({
      sessionId: "s1",
      timestamp: new Date("2026-06-01").toISOString(),
      project: "alpha",
    });
    addModelToSession(
      s1,
      "sonnet",
      {
        cost: 10,
        calls: 2,
        inTok: 500,
        tools: { bash: 3 },
      },
      "anthropic",
    );
    addModelToSession(
      s1,
      "haiku",
      {
        cost: 3,
        calls: 1,
        inTok: 100,
        tools: { read: 1 },
      },
      "anthropic",
    );

    const s2 = makeSessionAgg({
      sessionId: "s2",
      timestamp: new Date("2026-06-01").toISOString(),
      project: "beta",
    });
    addModelToSession(
      s2,
      "sonnet",
      {
        cost: 20,
        calls: 4,
        inTok: 1000,
        tools: { edit: 2 },
      },
      "anthropic",
    );

    const s3 = makeSessionAgg({
      sessionId: "s3",
      timestamp: new Date("2026-06-01").toISOString(),
      project: "alpha",
    });
    addModelToSession(
      s3,
      "gpt-5",
      {
        cost: 5,
        calls: 1,
        inTok: 200,
        tools: { bash: 1 },
      },
      "openai",
    );

    const result = summarize([s1, s2, s3], "All", {
      project: "alpha",
      model: "sonnet",
      provider: "anthropic",
    });
    // Only s1's sonnet model matches all three filters
    expect(result.totalCost).toBe(10);
    expect(result.totalInputTokens).toBe(500);
    expect(result.sessionCount).toBe(1);
    expect(result.models).toHaveLength(1);
    expect(result.models[0]!.model).toBe("sonnet");
    expect(result.tools).toEqual([{ name: "bash", count: 3 }]);
  });

  it("filtering by model scopes tools and languages correctly", () => {
    const s = makeSessionAgg({ sessionId: "s1", timestamp: new Date("2026-06-01").toISOString() });
    addModelToSession(s, "sonnet", {
      tools: { bash: 5, edit: 2 },
      languages: { TS: { lines: 100, edits: 5 } },
    });
    addModelToSession(s, "haiku", {
      tools: { read: 3, bash: 1 },
      languages: { PY: { lines: 50, edits: 2 } },
    });

    const result = summarize([s], "All", { model: "haiku" });
    expect(result.tools).toEqual([
      { name: "read", count: 3 },
      { name: "bash", count: 1 },
    ]);
    expect(result.languages).toEqual([{ language: "PY", lines: 50, edits: 2 }]);
  });

  it("filter by project with sessions having matching models only", () => {
    const s1 = makeSessionAgg({
      sessionId: "s1",
      timestamp: new Date("2026-06-01").toISOString(),
      project: "alpha",
    });
    addModelToSession(s1, "m", { cost: 10, calls: 1 });
    const s2 = makeSessionAgg({
      sessionId: "s2",
      timestamp: new Date("2026-06-02").toISOString(),
      project: "alpha",
    });
    addModelToSession(s2, "m", { cost: 5, calls: 1 });

    const result = summarize([s1, s2], "All", { project: "alpha" });
    expect(result.totalCost).toBe(15);
    expect(result.sessionCount).toBe(2);
  });

  it("models with same name but different providers are not merged", () => {
    const s = makeSessionAgg({
      sessionId: "s1",
      timestamp: new Date("2026-06-01").toISOString(),
    });
    addModelToSession(s, "sonnet", { cost: 5.0, calls: 10 }, "anthropic");
    addModelToSession(s, "sonnet", { cost: 2.0, calls: 5 }, "openai");

    const result = summarize([s], "All");
    expect(result.models).toHaveLength(2);

    const anthropicSonnet = result.models.find(
      (m) => m.provider === "anthropic" && m.model === "sonnet",
    );
    const openaiSonnet = result.models.find(
      (m) => m.provider === "openai" && m.model === "sonnet",
    );

    expect(anthropicSonnet).toEqual({
      model: "sonnet",
      provider: "anthropic",
      cost: 5.0,
      calls: 10,
    });
    expect(openaiSonnet).toEqual({
      model: "sonnet",
      provider: "openai",
      cost: 2.0,
      calls: 5,
    });
  });

  it("same-named models from different providers aggregate across sessions without merging across providers", () => {
    const s1 = makeSessionAgg({
      sessionId: "s1",
      timestamp: new Date("2026-06-01").toISOString(),
    });
    addModelToSession(s1, "sonnet", { cost: 3.0, calls: 5 }, "anthropic");

    const s2 = makeSessionAgg({
      sessionId: "s2",
      timestamp: new Date("2026-06-02").toISOString(),
    });
    addModelToSession(s2, "sonnet", { cost: 4.0, calls: 7 }, "anthropic");
    addModelToSession(s2, "sonnet", { cost: 1.0, calls: 3 }, "openai");

    const result = summarize([s1, s2], "All");
    expect(result.models).toHaveLength(2);

    // anthropic sonnet is aggregated across sessions
    expect(result.models).toContainEqual({
      model: "sonnet",
      provider: "anthropic",
      cost: 7.0,
      calls: 12,
    });
    // openai sonnet is separate
    expect(result.models).toContainEqual({
      model: "sonnet",
      provider: "openai",
      cost: 1.0,
      calls: 3,
    });
  });

  describe("skills", () => {
    it("returns empty array when no skill data exists", () => {
      const d = emptyDay("2026-06-01");
      d.cost = 5;
      d.sessionIds = new Set(["s1"]);
      const s = summarize([d], "All");
      expect(s.skills).toEqual([]);
    });

    it("accumulates skill fields across days and sorts by cost descending", () => {
      const d1 = emptyDay("2026-06-01");
      mergeDay(d1, {
        ...emptyDay(""),
        skillCost: { tdd: 0.5, writing: 0.3 },
        skillCount: { tdd: 2, writing: 1 },
        skillTokens: { tdd: 500, writing: 200 },
        skillToolCount: { tdd: 3, writing: 1 },
        skillToolBreakdown: { tdd: { edit: 2, read: 1 }, writing: { bash: 1 } },
      });

      const d2 = emptyDay("2026-06-02");
      mergeDay(d2, {
        ...emptyDay(""),
        skillCost: { tdd: 0.2, coding: 0.1 },
        skillCount: { tdd: 1, coding: 1 },
        skillTokens: { tdd: 100, coding: 50 },
        skillToolCount: { tdd: 2, coding: 0 },
        skillToolBreakdown: { tdd: { write: 1 }, coding: {} },
      });

      const days = [d1, d2];
      const s = summarize(days, "All");

      expect(s.skills).toHaveLength(3);
      // Sorted by cost descending
      expect(s.skills[0]!.name).toBe("tdd");
      expect(s.skills[0]!.cost).toBeCloseTo(0.7);
      expect(s.skills[0]!.invocations).toBe(3);
      expect(s.skills[0]!.tokens).toBe(600);
      expect(s.skills[0]!.toolCalls.total).toBe(5);
      expect(s.skills[0]!.toolCalls.avg).toBeCloseTo(5 / 3);
      expect(s.skills[0]!.toolCalls.calls).toEqual({ edit: 2, read: 1, write: 1 });

      expect(s.skills[1]!.name).toBe("writing");
      expect(s.skills[1]!.cost).toBeCloseTo(0.3);
      expect(s.skills[1]!.invocations).toBe(1);
      expect(s.skills[1]!.tokens).toBe(200);
      expect(s.skills[1]!.toolCalls.total).toBe(1);
      expect(s.skills[1]!.toolCalls.avg).toBe(1);
      expect(s.skills[1]!.toolCalls.calls).toEqual({ bash: 1 });

      expect(s.skills[2]!.name).toBe("coding");
      expect(s.skills[2]!.cost).toBeCloseTo(0.1);
      expect(s.skills[2]!.invocations).toBe(1);
      expect(s.skills[2]!.tokens).toBe(50);
      expect(s.skills[2]!.toolCalls.total).toBe(0);
      expect(s.skills[2]!.toolCalls.avg).toBe(0);
      expect(s.skills[2]!.toolCalls.calls).toEqual({});
    });

    it("handles single skill with zero cost gracefully", () => {
      const d = emptyDay("2026-06-01");
      mergeDay(d, {
        ...emptyDay(""),
        skillCost: { free: 0 },
        skillCount: { free: 1 },
        skillTokens: { free: 0 },
        skillToolCount: { free: 0 },
        skillToolBreakdown: { free: {} },
      });
      const s = summarize([d], "All");
      expect(s.skills).toHaveLength(1);
      expect(s.skills[0]!.cost).toBe(0);
      expect(s.skills[0]!.toolCalls.avg).toBe(0);
    });
  });
});
