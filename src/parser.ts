import type { DayAgg } from "./types.js";

function ensureDay(map: Map<string, DayAgg>, date: string): DayAgg {
  let day = map.get(date);
  if (!day) {
    day = {
      date,
      cost: 0, inTok: 0, outTok: 0, crTok: 0, cwTok: 0,
      userMsgs: 0, asstMsgs: 0, toolResults: 0,
      sessionIds: new Set(),
      langLines: {}, langEdits: {}, modelCost: {},
      modelCount: {}, projectCost: {},
      projectSessions: {}, toolCount: {},
    };
    map.set(date, day);
  }
  return day;
}

function dateFromTimestamp(ts: string): string {
  return ts.slice(0, 10); // "2026-06-08T..." → "2026-06-08"
}

export function parseLine(entry: Record<string, unknown>, map: Map<string, DayAgg>): void {
  const ts = entry.timestamp as string | undefined;
  if (!ts) return;

  const date = dateFromTimestamp(ts);

  if (entry.type === "session") {
    const day = ensureDay(map, date);
    const id = entry.id as string;
    if (id) day.sessionIds.add(id);
    return;
  }

  if (entry.type !== "message") return;

  const msg = entry.message as Record<string, unknown> | undefined;
  if (!msg) return;

  const role = msg.role as string | undefined;
  if (!role) return;

  const day = ensureDay(map, date);

  if (role === "user") {
    day.userMsgs++;
    return;
  }

  if (role === "toolResult") {
    day.toolResults++;
    const toolName = msg.toolName as string | undefined;
    if (toolName) {
      day.toolCount[toolName] = (day.toolCount[toolName] ?? 0) + 1;
    }
    return;
  }

  if (role === "assistant") {
    day.asstMsgs++;

    const usage = msg.usage as Record<string, unknown> | undefined;
    if (usage) {
      day.inTok += (usage.input as number) ?? 0;
      day.outTok += (usage.output as number) ?? 0;
      day.crTok += (usage.cacheRead as number) ?? 0;
      day.cwTok += (usage.cacheWrite as number) ?? 0;

      const cost = usage.cost as Record<string, number> | undefined;
      if (cost) {
        day.cost += cost.total ?? 0;
      }
    }

    // model stats
    const model = msg.model as string | undefined;
    if (model && usage?.cost) {
      const cost = (usage.cost as Record<string, number>);
      day.modelCost[model] = (day.modelCost[model] ?? 0) + (cost.total ?? 0);
      day.modelCount[model] = (day.modelCount[model] ?? 0) + 1;
    }
  }
}
