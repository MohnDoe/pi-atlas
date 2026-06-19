import { StatsSummary } from "../types";

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
  languages: [],
  models: [],
  projects: [],
  tools: [],
  dailySpend: [
    { date: "2026-06-06", cost: 1.0 },
    { date: "2026-06-07", cost: 2.0 },
    { date: "2026-06-08", cost: 2.0 },
  ],
  hourlySpend: [],
});
