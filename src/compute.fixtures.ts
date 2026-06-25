import { emptyDay } from "./parser";
import type { DayAgg, ModelToProvider, StatsSummary } from "./types";

/**
 * Create base DayAggs that produce a non-trivial StatsSummary when summarized across "All".
 * Three days with staggered data so all four summary ranges have coverage.
 */
export function makeDayAggs(): { days: DayAgg[]; modelToProvider: ModelToProvider } {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

  const d1 = emptyDay(twoDaysAgo);
  d1.cost = 1.0;
  d1.sessionIds = new Set(["s1"]);
  d1.userMsgs = 8;
  d1.asstMsgs = 8;
  d1.toolResults = 9;
  d1.inTok = 100;
  d1.outTok = 100;
  d1.crTok = 50;
  d1.cwTok = 50;
  d1.langLines = { TypeScript: 3000 };
  d1.langEdits = { TypeScript: 2 };
  d1.modelCost = { "deeepseek-v4": 0.3 };
  d1.modelCount = { "deeepseek-v4": 300 };
  d1.toolCount = { bash: 3 };
  d1.projectCost = { "pi-atlas": 0 };
  d1.projectSessions = { "pi-atlas": new Set(["s1"]) };

  const d2 = emptyDay(yesterday);
  d2.cost = 2.0;
  d2.sessionIds = new Set(["s2"]);
  d2.userMsgs = 8;
  d2.asstMsgs = 8;
  d2.toolResults = 9;
  d2.inTok = 200;
  d2.outTok = 200;
  d2.crTok = 100;
  d2.cwTok = 100;
  d2.langLines = { TypeScript: 3500 };
  d2.langEdits = { TypeScript: 2 };
  d2.modelCost = { "deeepseek-v4": 0.3 };
  d2.modelCount = { "deeepseek-v4": 300 };
  d2.toolCount = { bash: 3 };
  d2.projectCost = { "pi-atlas": 0 };
  d2.projectSessions = { "pi-atlas": new Set(["s2"]) };

  const d3 = emptyDay(today);
  d3.cost = 2.0;
  d3.sessionIds = new Set(["s3"]);
  d3.userMsgs = 8;
  d3.asstMsgs = 8;
  d3.toolResults = 9;
  d3.inTok = 200;
  d3.outTok = 200;
  d3.crTok = 100;
  d3.cwTok = 100;
  d3.langLines = { TypeScript: 3500 };
  d3.langEdits = { TypeScript: 1 };
  d3.modelCost = { "deeepseek-v4": 0.4 };
  d3.modelCount = { "deeepseek-v4": 400 };
  d3.toolCount = { bash: 4 };
  d3.projectCost = { "pi-atlas": 0 };
  d3.projectSessions = { "pi-atlas": new Set(["s3"]) };

  const modelToProvider: ModelToProvider = new Map([
    ["deeepseek-v4", "deepseek"],
  ]);

  return { days: [d1, d2, d3], modelToProvider };
}

export const makeSummary = (): StatsSummary => ({
  totalCost: 5.0,
  sessionCount: 3,
  totalMessages: 50,
  totalInputTokens: 500,
  totalOutputTokens: 500,
  totalCacheReadTokens: 250,
  totalCacheWriteTokens: 250,
  totalTokens: 10000,
  daysActive: 3,
  avgCostPerDay: 1.67,
  todayCost: 1.0,
  languages: [
    {
      language: "TypeScript",
      lines: 10000,
      edits: 5,
    },
  ],
  models: [
    {
      model: "deeepseek-v4",
      cost: 0.5,
      provider: "deepseek",
      calls: 1000,
    },
  ],
  projects: [
    {
      cost: 0,
      project: "pi-atlas",
      sessions: 12,
    },
  ],
  tools: [
    {
      count: 10,
      name: "bash",
    },
  ],
  providers: [],
  compactionCount: 0,
  compactedTokens: 0,
  modelChanges: 0,
  thinkingLevelCount: {},
  dailySpend: [
    { date: "2026-06-06", cost: 1.0 },
    { date: "2026-06-07", cost: 2.0 },
    { date: "2026-06-08", cost: 2.0 },
  ],
  hourlySpend: [],
});
