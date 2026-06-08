import type { DayAgg, DaySpend, LangStat, ModelStat, ProjectStat, StatsSummary, TimeRange, ToolStat } from "./types.js";

function daysInRange(days: DayAgg[], range: TimeRange): DayAgg[] {
  if (range === "All") return days;

  const todayStr = new Date().toISOString().slice(0, 10);

  if (range === "1d") {
    return days.filter((d) => d.date === todayStr);
  }

  // Build cutoff as a Date, then convert back to ISO string for comparison
  const cutoff = new Date(todayStr + "T00:00:00Z");
  if (range === "7d") {
    cutoff.setUTCDate(cutoff.getUTCDate() - 6);
  } else if (range === "30d") {
    cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  }

  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return days.filter((d) => d.date >= cutoffStr);
}

function fillDailySpend(days: DayAgg[], range: TimeRange): DaySpend[] {
  if (days.length === 0) return [];

  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  if (range === "All") {
    return sorted.map((d) => ({ date: d.date, cost: d.cost }));
  }

  // For bounded ranges, zero-fill gaps
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;

  const spendMap = new Map<string, number>();
  for (const d of sorted) spendMap.set(d.date, d.cost);

  const result: DaySpend[] = [];
  const d = new Date(first + "T00:00:00Z");
  const end = new Date(last + "T00:00:00Z");

  while (d <= end) {
    const ds = d.toISOString().slice(0, 10);
    result.push({ date: ds, cost: spendMap.get(ds) ?? 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return result;
}

export function summarize(days: DayAgg[], range: TimeRange): StatsSummary {
  const filtered = daysInRange(days, range);

  const todayStr = new Date().toISOString().slice(0, 10);
  let todayCost = 0;

  let totalCost = 0;
  let sessionCount = 0;
  let totalMessages = 0;
  let totalTokens = 0;
  const allSessions = new Set<string>();

  // accumulators
  const langLines: Record<string, number> = {};
  const langEdits: Record<string, number> = {};
  const modelCost: Record<string, number> = {};
  const modelCount: Record<string, number> = {};
  const projectCost: Record<string, number> = {};
  const projectSessions: Record<string, Set<string>> = {};
  const toolCount: Record<string, number> = {};

  for (const day of filtered) {
    totalCost += day.cost;
    totalMessages += day.userMsgs + day.asstMsgs + day.toolResults;
    totalTokens += day.inTok + day.outTok + day.crTok + day.cwTok;

    if (day.date === todayStr) todayCost += day.cost;

    for (const id of day.sessionIds) allSessions.add(id);
    sessionCount = allSessions.size;

    // merge languages
    for (const [lang, lines] of Object.entries(day.langLines)) {
      langLines[lang] = (langLines[lang] ?? 0) + lines;
    }
    for (const [lang, edits] of Object.entries(day.langEdits)) {
      langEdits[lang] = (langEdits[lang] ?? 0) + edits;
    }

    // merge models
    for (const [model, cost] of Object.entries(day.modelCost)) {
      modelCost[model] = (modelCost[model] ?? 0) + cost;
    }
    for (const [model, count] of Object.entries(day.modelCount)) {
      modelCount[model] = (modelCount[model] ?? 0) + count;
    }

    // merge projects
    for (const [proj, cost] of Object.entries(day.projectCost)) {
      projectCost[proj] = (projectCost[proj] ?? 0) + cost;
    }
    for (const [proj, sessions] of Object.entries(day.projectSessions)) {
      if (!projectSessions[proj]) projectSessions[proj] = new Set();
      for (const s of sessions) projectSessions[proj].add(s);
    }

    // merge tools
    for (const [tool, count] of Object.entries(day.toolCount)) {
      toolCount[tool] = (toolCount[tool] ?? 0) + count;
    }
  }

  const daysActive = filtered.filter((d) => d.sessionIds.size > 0).length;
  const avgCostPerDay = daysActive > 0 ? totalCost / daysActive : 0;

  // build sorted result arrays
  const languages: LangStat[] = Object.entries(langLines)
    .map(([language, lines]) => ({ language, lines, edits: langEdits[language] ?? 0 }))
    .sort((a, b) => b.lines - a.lines);

  const models: ModelStat[] = Object.entries(modelCost)
    .map(([model, cost]) => ({ model, cost, calls: modelCount[model] ?? 0 }))
    .sort((a, b) => b.cost - a.cost);

  const projects: ProjectStat[] = Object.entries(projectCost)
    .map(([project, cost]) => ({ project, cost, sessions: projectSessions[project]?.size ?? 0 }))
    .sort((a, b) => b.cost - a.cost);

  const tools: ToolStat[] = Object.entries(toolCount)
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCost,
    sessionCount,
    totalMessages,
    totalTokens,
    daysActive,
    avgCostPerDay,
    todayCost,
    languages,
    models,
    projects,
    tools,
    dailySpend: fillDailySpend(filtered, range),
  };
}
