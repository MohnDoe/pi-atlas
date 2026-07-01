import type { Provider } from "@earendil-works/pi-ai";
import { dateFromISOString } from "./format";
import type {
  DaySpend,
  Filters,
  HourSpend,
  LangStat,
  ModelStat,
  ProjectStat,
  ProviderStat,
  SkillStat,
  SessionAgg,
  StatsSummary,
  TimeRange,
  ToolStat,
} from "./types";

function daysInRange(sessions: SessionAgg[], range: TimeRange): SessionAgg[] {
  if (range === "All") return sessions;

  const todayStr = dateFromISOString(new Date().toISOString());

  if (range === "1d") {
    return sessions.filter((s) => dateFromISOString(s.timestamp) === todayStr);
  }

  // Build cutoff as a Date, then convert back to ISO string for comparison
  const cutoff = new Date(todayStr + "T00:00:00Z");
  if (range === "7d") {
    cutoff.setUTCDate(cutoff.getUTCDate() - 6);
  } else if (range === "30d") {
    cutoff.setUTCDate(cutoff.getUTCDate() - 29);
  }

  const cutoffStr = dateFromISOString(cutoff.toISOString());
  return sessions.filter((s) => dateFromISOString(s.timestamp) >= cutoffStr);
}

function fillDailySpend(sessions: SessionAgg[], range: TimeRange): DaySpend[] {
  if (sessions.length === 0) return [];

  // Group by date
  const spendByDate = new Map<string, number>();
  for (const s of sessions) {
    let dayCost = 0;
    for (const [provider, models] of Object.entries(s.models)) {
      for (const [modelName, modelUsage] of Object.entries(models)) {
        dayCost += modelUsage.usage.cost.total;
      }
    }

    const dateStr = dateFromISOString(s.timestamp);
    spendByDate.set(dateStr, (spendByDate.get(dateStr) ?? 0) + dayCost);
  }

  const sortedDates = [...spendByDate.keys()].sort();
  if (sortedDates.length === 0) return [];

  if (range === "All") {
    return sortedDates.map((date) => ({ date, cost: spendByDate.get(date) ?? 0 }));
  }

  // For bounded ranges, zero-fill gaps
  const first = sortedDates[0]!;
  const last = sortedDates[sortedDates.length - 1]!;

  const result: DaySpend[] = [];
  const d = new Date(first + "T00:00:00Z");
  const end = new Date(last + "T00:00:00Z");

  while (d <= end) {
    const ds = d.toISOString().slice(0, 10);
    result.push({ date: ds, cost: spendByDate.get(ds) ?? 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }

  return result;
}

function buildHourlySpend(filtered: SessionAgg[], range: TimeRange): HourSpend[] {
  if (range !== "1d" || filtered.length === 0) return [];

  const totalHourCost: Record<number, number> = {};
  for (const session of filtered) {
    const hour = new Date(session.timestamp).getHours();
    for (const models of Object.values(session.models)) {
      const cost = Object.values(models).reduce((val, s) => val + s.usage.cost.total, 0);
      totalHourCost[hour] = (totalHourCost[hour] ?? 0) + cost;
    }
  }

  const hourly: HourSpend[] = [];
  for (let h = 0; h < 24; h++) {
    hourly.push({ hour: h, cost: totalHourCost[h] ?? 0 });
  }
  return hourly;
}

function buildSkills(
  skillCost: DayAgg["skillCost"],
  skillCount: DayAgg["skillCount"],
  skillTokens: DayAgg["skillTokens"],
  skillToolCount: DayAgg["skillToolCount"],
  skillToolBreakdown: DayAgg["skillToolBreakdown"],
): SkillStat[] {
  return Object.entries(skillCost)
    .map(([name, cost]) => ({
      name,
      cost,
      invocations: skillCount[name] ?? 0,
      tokens: skillTokens[name] ?? 0,
      toolCalls: {
        total: skillToolCount[name] ?? 0,
        avg: (skillCount[name] ?? 0) > 0 ? (skillToolCount[name] ?? 0) / (skillCount[name] ?? 0) : 0,
        calls: skillToolBreakdown[name] ?? {},
      },
    }))
    .sort((a, b) => b.cost - a.cost);
}

export function summarize(days: DayAgg[], range: TimeRange): StatsSummary {
  const filtered = daysInRange(days, range);
/**
 * Filter a session's models according to the given filters.
 * Returns the filtered model entries that pass all active filters.
 */
function* filteredModels(
  session: SessionAgg,
  filters?: Filters,
): Generator<{ model: string; usage: SessionAgg["models"][Provider][string] }> {
  for (const models of Object.values(session.models)) {
    for (const [modelName, usage] of Object.entries(models)) {
      if (filters?.model && modelName !== filters.model) continue;
      if (filters?.provider && usage.provider !== filters.provider) continue;
      yield { model: modelName, usage };
    }
  }
}

export function summarize(
  sessions: SessionAgg[],
  range: TimeRange,
  filters?: Filters,
): StatsSummary {
  const filtered = daysInRange(sessions, range);

  // Filter by project
  const projectFiltered = filters?.project
    ? filtered.filter((s) => s.project === filters.project)
    : filtered;

  const todayStr = dateFromISOString(new Date().toISOString());
  let todayCost = 0;

  let totalCost = 0;
  let sessionCount = 0;
  let totalMessages = 0;
  let totalTokens = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCacheReadTokens = 0;
  let totalCacheWriteTokens = 0;

  // accumulators
  const langLines: Record<string, number> = {};
  const langEdits: Record<string, number> = {};
  const modelUsage: Record<
    Provider,
    {
      models: Record<string, { cost: number; calls: number }>;
    }
  > = {};
  const projectCost: Record<string, number> = {};
  const projectSessions: Record<string, Set<string>> = {};
  const toolCount: Record<string, number> = {};
  let compactionCount = 0;
  let compactedTokens = 0;
  let modelChanges = 0;
  const thinkingLevelCount: Record<string, number> = {};
  const skillCost: DayAgg["skillCost"] = {};
  const skillCount: DayAgg["skillCount"] = {};
  const skillTokens: DayAgg["skillTokens"] = {};
  const skillToolCount: DayAgg["skillToolCount"] = {};
  const skillToolBreakdown: DayAgg["skillToolBreakdown"] = {};

  for (const session of projectFiltered) {
    // Project attribution: the session's project gets attributed its total cost
    let sessionCost = 0;
    let sessionHasModels = false;
    for (const { model: modelName, usage } of filteredModels(session, filters)) {
      const provider = usage.provider;
      sessionHasModels = true;
      totalCost += usage.usage.cost.total;
      sessionCost += usage.usage.cost.total;
      totalTokens += usage.usage.totalTokens;
      totalInputTokens += usage.usage.input;
      totalOutputTokens += usage.usage.output;
      totalCacheReadTokens += usage.usage.cacheRead;
      totalCacheWriteTokens += usage.usage.cacheWrite;

      // Count asstMsgs from model usage toward totalMessages
      totalMessages += usage.asstMsgs;

      if (!modelUsage[provider]) {
        modelUsage[provider] = { models: {} };
      }

      if (!modelUsage[provider].models[modelName]) {
        modelUsage[provider].models[modelName] = { cost: 0, calls: 0 };
      }
      // Model
      modelUsage[provider].models[modelName] = {
        cost: modelUsage[provider].models[modelName].cost + usage.usage.cost.total,
        calls: modelUsage[provider].models[modelName].calls + usage.calls,
      };

      // Tools
      for (const [tool, count] of Object.entries(usage.tools)) {
        toolCount[tool] = (toolCount[tool] ?? 0) + count;
      }

      // Languages
      for (const [lang, lu] of Object.entries(usage.languages)) {
        langLines[lang] = (langLines[lang] ?? 0) + lu.lines;
        langEdits[lang] = (langEdits[lang] ?? 0) + lu.edits;
      }
    }

    // Count session-level data only for sessions that have matching models
    if (sessionHasModels) {
      // Session-level messages are only counted when the session has at least
      // one model matching the active filters.
      totalMessages += session.userMsgs + session.toolResults;

      compactionCount += session.compactionCount;
      compactedTokens += session.compactedTokens;
      modelChanges += session.modelChanges;
      for (const [level, count] of Object.entries(session.thinkingLevelCount)) {
        thinkingLevelCount[level] = (thinkingLevelCount[level] ?? 0) + count;
      }
    }

    // Only track project cost if the session has any models matching the filter
    if (sessionHasModels && session.project) {
      projectCost[session.project] = (projectCost[session.project] ?? 0) + sessionCost;
      if (!projectSessions[session.project]) projectSessions[session.project] = new Set();
      projectSessions[session.project]!.add(session.sessionId);
    }

    compactionCount += day.compactionCount;
    compactedTokens += day.compactedTokens;
    modelChanges += day.modelChanges;
    for (const [level, count] of Object.entries(day.thinkingLevelCount)) {
      thinkingLevelCount[level] = (thinkingLevelCount[level] ?? 0) + count;
    }

    // merge skills
    for (const [skill, cost] of Object.entries(day.skillCost)) {
      skillCost[skill] = (skillCost[skill] ?? 0) + cost;
    }
    for (const [skill, count] of Object.entries(day.skillCount)) {
      skillCount[skill] = (skillCount[skill] ?? 0) + count;
    }
    for (const [skill, tokens] of Object.entries(day.skillTokens)) {
      skillTokens[skill] = (skillTokens[skill] ?? 0) + tokens;
    }
    for (const [skill, count] of Object.entries(day.skillToolCount)) {
      skillToolCount[skill] = (skillToolCount[skill] ?? 0) + count;
    }
    for (const [skill, tools] of Object.entries(day.skillToolBreakdown)) {
      if (!skillToolBreakdown[skill]) skillToolBreakdown[skill] = {};
      for (const [tool, count] of Object.entries(tools)) {
        skillToolBreakdown[skill][tool] = (skillToolBreakdown[skill][tool] ?? 0) + count;
      }
    }
    if (dateFromISOString(session.timestamp) === todayStr) todayCost += sessionCost;
  }

  // Sessions that have at least one model matching filters
  const sessionsWithModels = projectFiltered.filter((s) => {
    for (const _ of filteredModels(s, filters)) return true;
    return false;
  });
  const uniqueSessionIds = new Set(sessionsWithModels.map((s) => s.sessionId));
  sessionCount = uniqueSessionIds.size;

  // Days active: unique dates that have sessions with matching models
  const activeDates = new Set(sessionsWithModels.map((s) => dateFromISOString(s.timestamp)));
  const daysActive = activeDates.size;
  const avgCostPerDay = daysActive > 0 ? totalCost / daysActive : 0;

  // build sorted result arrays
  const languages: LangStat[] = Object.entries(langLines)
    .map(([language, lines]) => ({ language, lines, edits: langEdits[language] ?? 0 }))
    .sort((a, b) => b.lines - a.lines);

  const models: ModelStat[] = [];
  for (const [providerName, provider] of Object.entries(modelUsage)) {
    for (const [modelName, model] of Object.entries(provider.models)) {
      models.push({
        provider: providerName,
        model: modelName,
        cost: model.cost,
        calls: model.calls,
      });
    }
  }
  models.sort((a, b) => b.calls - a.calls).sort((a, b) => b.cost - a.cost);

  const projects: ProjectStat[] = Object.entries(projectCost)
    .map(([project, cost]) => ({
      project,
      cost,
      sessions: projectSessions[project]?.size ?? 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .sort((a, b) => b.cost - a.cost);

  const tools: ToolStat[] = Object.entries(toolCount)
    .map(([tool, count]) => ({ name: tool, count }))
    .sort((a, b) => b.count - a.count);

  const providers: ProviderStat[] = Object.entries(modelUsage)
    .map(([providerName, provider]) => ({
      provider: providerName,
      ...Object.values(provider.models).reduce(
        (val, m) => ({ cost: val.cost + m.cost, calls: val.calls + m.calls }),
        { cost: 0, calls: 0 },
      ),
    }))
    .sort((a, b) => b.cost - a.cost || b.calls - a.calls);

  const hourlySpend = buildHourlySpend(projectFiltered, range);

  return {
    totalCost,
    sessionCount,
    totalMessages,
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCacheReadTokens,
    totalCacheWriteTokens,
    daysActive,
    avgCostPerDay,
    todayCost,
    languages,
    models,
    projects,
    tools,
    providers,
    compactionCount,
    compactedTokens,
    modelChanges,
    thinkingLevelCount,
    skills: buildSkills(skillCost, skillCount, skillTokens, skillToolCount, skillToolBreakdown),
    dailySpend: fillDailySpend(filtered, range),
    hourlySpend,
  };
}
