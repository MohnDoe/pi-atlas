import type { DayAgg, CachePayload, DaySpend, LangStat, ModelStat, ProjectStat, SerializedDayAgg, StatsSummary, TimeRange, ToolStat } from "./types.js";
import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseFile } from "./parser.js";

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

// ---- Signature ----

export async function computeSignature(sessionsDir: string): Promise<string> {
  const hash = createHash("sha256");
  const entries: Array<{ path: string; size: number; mtimeMs: number }> = [];

  async function walk(dir: string): Promise<void> {
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirents) {
      const full = join(dir, d.name);
      if (d.isDirectory()) {
        await walk(full);
      } else if (d.isFile() && d.name.endsWith(".jsonl")) {
        const s = await stat(full);
        entries.push({ path: full, size: s.size, mtimeMs: s.mtimeMs });
      }
    }
  }

  await walk(sessionsDir);

  if (entries.length === 0) return "";

  // Sort by path for deterministic hashing
  entries.sort((a, b) => a.path.localeCompare(b.path));

  for (const e of entries) {
    hash.update(`${e.path}\n${e.size}\n${e.mtimeMs}\n`);
  }

  return hash.digest("hex");
}

// ---- Cache ----

function serializeDay(d: DayAgg): SerializedDayAgg {
  return {
    ...d,
    sessionIds: [...d.sessionIds],
    projectSessions: Object.fromEntries(
      Object.entries(d.projectSessions).map(([k, v]) => [k, [...v]])
    ),
  };
}

export async function writeCache(
  cachePath: string,
  signature: string,
  days: DayAgg[]
): Promise<void> {
  const payload: CachePayload = {
    signature,
    generatedAt: new Date().toISOString(),
    days: days.map(serializeDay),
  };
  await writeFile(cachePath, JSON.stringify(payload), "utf-8");
}

export async function readCache(cachePath: string): Promise<CachePayload | null> {
  try {
    const raw = await readFile(cachePath, "utf-8");
    const payload = JSON.parse(raw) as CachePayload;
    if (!payload.signature || !Array.isArray(payload.days)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Check if cache is still valid against current directory signature */
export async function isCacheValid(
  cachePath: string,
  sessionsDir: string
): Promise<boolean> {
  const cached = await readCache(cachePath);
  if (!cached) return false;
  const currentSig = await computeSignature(sessionsDir);
  return cached.signature === currentSig;
}

// ---- Aggregate loading ----

function deserializeDay(s: SerializedDayAgg): DayAgg {
  return {
    ...s,
    sessionIds: new Set(s.sessionIds),
    projectSessions: Object.fromEntries(
      Object.entries(s.projectSessions).map(([k, v]) => [k, new Set(v)])
    ),
  };
}

async function findAllJsonlFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(d: string) {
    let entries;
    try { entries = await readdir(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.endsWith(".jsonl")) result.push(full);
    }
  }
  await walk(dir);
  return result;
}

export async function loadAggregate(
  cachePath: string,
  sessionsDir: string,
  force = false,
  onProgress?: (p: number) => void,
): Promise<DayAgg[]> {
  // Try cache first
  if (!force) {
    const valid = await isCacheValid(cachePath, sessionsDir);
    if (valid) {
      const cached = await readCache(cachePath);
      if (cached) return cached.days.map(deserializeDay);
    }
  }

  // Parse all JSONL files
  const files = await findAllJsonlFiles(sessionsDir);
  const map = new Map<string, DayAgg>();

  for (let i = 0; i < files.length; i++) {
    parseFile(files[i], map);
    if (onProgress) onProgress(Math.round(((i + 1) / files.length) * 100));
  }

  const days = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Write cache
  const sig = await computeSignature(sessionsDir);
  await writeCache(cachePath, sig, days);

  return days;
}
