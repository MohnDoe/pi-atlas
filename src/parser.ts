import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ToolResultMessage } from "@earendil-works/pi-ai";
import type {
  CompactionEntry,
  FileEntry,
  ModelChangeEntry,
  SessionHeader,
  SessionMessageEntry,
  ThinkingLevelChangeEntry,
} from "@earendil-works/pi-coding-agent";
import { readFileSync } from "node:fs";

import { dateFromISOString, langFromPath, projectNameFromCwd } from "./format";
import type { DayAgg, SessionAgg, SessionModelUsage } from "./types";

// ---- Legacy DayAgg helpers (kept for cache.ts compatibility) ----

export function emptyDay(date: string): DayAgg {
  return {
    date,
    cost: 0,
    hourCost: {},
    inTok: 0,
    outTok: 0,
    crTok: 0,
    cwTok: 0,
    userMsgs: 0,
    asstMsgs: 0,
    toolResults: 0,
    sessionIds: new Set(),
    langLines: {},
    langEdits: {},
    modelCost: {},
    modelCount: {},
    providerCost: {},
    providerCount: {},
    modelToProvider: new Map(),
    projectCost: {},
    projectSessions: {},
    toolCount: {},
    compactionCount: 0,
    compactedTokens: 0,
    modelChanges: 0,
    thinkingLevelCount: {},
  };
}

export function mergeDay(base: DayAgg, update: DayAgg): void {
  base.cost += update.cost;
  base.inTok += update.inTok;
  base.outTok += update.outTok;
  base.crTok += update.crTok;
  base.cwTok += update.cwTok;
  base.userMsgs += update.userMsgs;
  base.asstMsgs += update.asstMsgs;
  base.toolResults += update.toolResults;

  for (const id of update.sessionIds) base.sessionIds.add(id);

  for (const [h, c] of Object.entries(update.hourCost)) {
    base.hourCost[Number(h)] = (base.hourCost[Number(h)] ?? 0) + c;
  }

  for (const [k, v] of Object.entries(update.langLines)) {
    base.langLines[k] = (base.langLines[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.langEdits)) {
    base.langEdits[k] = (base.langEdits[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.modelCost)) {
    base.modelCost[k] = (base.modelCost[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.modelCount)) {
    base.modelCount[k] = (base.modelCount[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.providerCost)) {
    base.providerCost[k] = (base.providerCost[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.providerCount)) {
    base.providerCount[k] = (base.providerCount[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.projectCost)) {
    base.projectCost[k] = (base.projectCost[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.projectSessions)) {
    if (!base.projectSessions[k]) base.projectSessions[k] = new Set();
    for (const id of v) base.projectSessions[k].add(id);
  }
  for (const [k, v] of Object.entries(update.toolCount)) {
    base.toolCount[k] = (base.toolCount[k] ?? 0) + v;
  }

  // New fields
  base.compactionCount += update.compactionCount;
  base.compactedTokens += update.compactedTokens;
  base.modelChanges += update.modelChanges;
  for (const [k, v] of Object.entries(update.thinkingLevelCount)) {
    base.thinkingLevelCount[k] = (base.thinkingLevelCount[k] ?? 0) + v;
  }

  base.modelToProvider = new Map([
    ...(base.modelToProvider.size > 0 ? base.modelToProvider.entries() : []),
    ...(update.modelToProvider.size > 0 ? update.modelToProvider.entries() : []),
  ]);
}

// ---- New SessionAgg helpers ----

/** Create a zeroed SessionAgg with session identity. */
export function emptySession(sessionId: string, date: string, project: string): SessionAgg {
  return {
    date,
    sessionId,
    project,
    models: {},
    userMsgs: 0,
    toolResults: 0,
    compactionCount: 0,
    compactedTokens: 0,
    modelChanges: 0,
    thinkingLevelCount: {},
    hourCost: {},
  };
}

/** Create a zeroed per-model usage entry. */
function emptyModelUsage(provider: string): SessionModelUsage {
  return {
    provider,
    cost: 0,
    calls: 0,
    inTok: 0,
    outTok: 0,
    crTok: 0,
    cwTok: 0,
    asstMsgs: 0,
    tools: {},
    languages: {},
  };
}

/** Merge a partial SessionAgg into the base session. */
export function mergeToSession(base: SessionAgg, update: SessionAgg): void {
  base.userMsgs += update.userMsgs;
  base.toolResults += update.toolResults;
  base.compactionCount += update.compactionCount;
  base.compactedTokens += update.compactedTokens;
  base.modelChanges += update.modelChanges;

  for (const [level, count] of Object.entries(update.thinkingLevelCount)) {
    base.thinkingLevelCount[level] = (base.thinkingLevelCount[level] ?? 0) + count;
  }

  for (const [h, c] of Object.entries(update.hourCost)) {
    base.hourCost[Number(h)] = (base.hourCost[Number(h)] ?? 0) + c;
  }

  for (const [modelName, usage] of Object.entries(update.models)) {
    const existing = base.models[modelName];
    if (!existing) {
      base.models[modelName] = { ...usage, tools: { ...usage.tools }, languages: { ...usage.languages } };
    } else {
      existing.cost += usage.cost;
      existing.calls += usage.calls;
      existing.inTok += usage.inTok;
      existing.outTok += usage.outTok;
      existing.crTok += usage.crTok;
      existing.cwTok += usage.cwTok;
      existing.asstMsgs += usage.asstMsgs;

      for (const [tool, count] of Object.entries(usage.tools)) {
        existing.tools[tool] = (existing.tools[tool] ?? 0) + count;
      }
      for (const [lang, lu] of Object.entries(usage.languages)) {
        const existingLang = existing.languages[lang];
        if (!existingLang) {
          existing.languages[lang] = { ...lu };
        } else {
          existingLang.lines += lu.lines;
          existingLang.edits += lu.edits;
        }
      }
    }
  }
}

// ---- Strip control chars from tool names ----

/** Strip control characters (\n, \r, \t, etc.) from a tool name. */
function sanitizeToolName(name: string): string {
  return name.replace(/[\x00-\x09\x0A-\x1F\x7F\u200B-\u200F\u2028-\u2029\uFEFF]/g, "");
}

// ---- Session header ----

export function parseSessionHeader(entry: SessionHeader): SessionAgg {
  const date = dateFromISOString(entry.timestamp);
  const project = entry.cwd ? projectNameFromCwd(entry.cwd) : "";
  const session = emptySession(entry.id, date, project);
  return session;
}

// ---- Message parsing ----

export function parseUserMessage(): SessionAgg {
  const session = emptySession("", "", "");
  session.userMsgs = 1;
  return session;
}

export function parseToolResultMessage(msg: ToolResultMessage): SessionAgg {
  const session = emptySession("", "", "");
  session.toolResults = 1;
  // Tool results contribute to the session-level toolResults count.
  // The tool name is tracked via the most recent model's tools — but since
  // tool results don't carry a model, we simply count the result here.
  // The tool name is not attributed to any specific model in SessionAgg.
  return session;
}

export function parseAssistantMessage(msg: AssistantMessage): SessionAgg {
  const session = emptySession("", "", "");
  session.asstMsgs = 0; // handled via model tracking below

  const modelName = msg.model;
  const provider = msg.provider ?? "";

  if (!modelName) {
    // No model — nothing to track per-model, but count asstMsgs
    session.userMsgs = 0;
    return session;
  }

  const usage = msg.usage;
  const costTotal = usage?.cost?.total ?? 0;

  // Build this model's usage entry
  const modelUsage: SessionModelUsage = {
    provider,
    cost: costTotal,
    calls: usage ? 1 : 0,
    inTok: usage?.input ?? 0,
    outTok: usage?.output ?? 0,
    crTok: usage?.cacheRead ?? 0,
    cwTok: usage?.cacheWrite ?? 0,
    asstMsgs: 1,
    tools: {},
    languages: {},
  };

  // Extract tool calls from content blocks and attribute to this model
  if (msg.content) {
    for (const block of msg.content) {
      if (block.type === "toolCall") {
        const sanitized = sanitizeToolName(block.name);
        modelUsage.tools[sanitized] = (modelUsage.tools[sanitized] ?? 0) + 1;

        if (block.name === "edit" || block.name === "write") {
          const parsedArgs =
            block.arguments !== undefined
              ? typeof block.arguments === "string"
                ? JSON.parse(block.arguments)
                : block.arguments
              : undefined;
          mergeLangUsage(modelUsage, block.name, parsedArgs as Record<string, unknown> | undefined);
        }
      }
    }
  }

  session.models[modelName] = modelUsage;

  // Cost-aware messages get hourCost tracking
  if (costTotal > 0) {
    // hourCost is set at the session level by parseSessionLogEntry which
    // has access to the timestamp. Here we don't set hourCost since we
    // lack the timestamp.
  }

  return session;
}

function mergeLangUsage(
  modelUsage: SessionModelUsage,
  toolName: string,
  args: Record<string, unknown> | undefined,
): void {
  const path = args?.path as string | undefined;
  if (!path) return;

  const lang = langFromPath(path);

  if (toolName === "edit") {
    const edits = args?.edits as Array<{ newText?: string; oldText?: string }> | undefined;
    if (Array.isArray(edits)) {
      let totalNewLines = 0;
      for (const edit of edits) {
        totalNewLines += countNewLines(edit.newText ?? "") + countNewLines(edit.oldText ?? "") + 1;
        const existing = modelUsage.languages[lang];
        if (existing) {
          existing.edits += 1;
        } else {
          modelUsage.languages[lang] = { lines: 0, edits: 1 };
        }
      }
      const existing = modelUsage.languages[lang];
      if (existing) {
        existing.lines += totalNewLines;
      } else {
        modelUsage.languages[lang] = { lines: totalNewLines, edits: 0 };
      }
    } else {
      // Single-line edit or non-array edits
      const existing = modelUsage.languages[lang];
      if (existing) {
        existing.lines += 1;
        existing.edits += 1;
      } else {
        modelUsage.languages[lang] = { lines: 1, edits: 1 };
      }
    }
  } else {
    // write tool
    const contentStr = args?.content as string | undefined;
    let lines = 1;
    if (contentStr) {
      lines += countNewLines(contentStr);
    }
    const existing = modelUsage.languages[lang];
    if (existing) {
      existing.lines += lines;
    } else {
      modelUsage.languages[lang] = { lines, edits: 0 };
    }
  }
}

function countNewLines(s: string): number {
  return (s.match(/\n/g) ?? []).length;
}

/** Re-export parseLanguageUsage for backward compatibility / testing — now delegates to mergeLangUsage. */
export function parseLanguageUsage(
  toolName: string,
  args: Record<string, unknown> | undefined,
): DayAgg {
  // Legacy wrapper — returns a DayAgg for backward compat
  const day = emptyDay("");
  const path = args?.path as string | undefined;
  if (!path) return day;

  const lang = langFromPath(path);

  if (toolName === "edit") {
    const edits = args?.edits as Array<{ newText?: string; oldText?: string }> | undefined;
    if (Array.isArray(edits)) {
      let totalNewLines = 0;
      for (const edit of edits) {
        totalNewLines += countNewLines(edit.newText ?? "") + countNewLines(edit.oldText ?? "") + 1;
        day.langEdits[lang] = (day.langEdits[lang] ?? 0) + 1;
      }
      day.langLines[lang] = (day.langLines[lang] ?? 0) + totalNewLines;
    } else {
      day.langLines[lang] = (day.langLines[lang] ?? 0) + 1;
      day.langEdits[lang] = (day.langEdits[lang] ?? 0) + 1;
    }
  } else {
    const contentStr = args?.content as string | undefined;
    if (contentStr) {
      day.langLines[lang] = (day.langLines[lang] ?? 0) + countNewLines(contentStr);
    }
    day.langLines[lang] = (day.langLines[lang] ?? 0) + 1;
  }

  return day;
}

function parseAgentMessage(msg: AgentMessage): SessionAgg {
  switch (msg.role) {
    case "user":
      return parseUserMessage();
    case "toolResult":
      return parseToolResultMessage(msg as ToolResultMessage);
    case "assistant":
      return parseAssistantMessage(msg as AssistantMessage);
    // skip non-cost-relevant message types
    case "bashExecution":
    case "custom":
    case "branchSummary":
    case "compactionSummary":
    default:
      return emptySession("", "", "");
  }
}

// ---- New entry types ----

export function parseModelChangeEntry(entry: ModelChangeEntry): SessionAgg {
  const session = emptySession("", "", "");
  session.modelChanges = 1;
  return session;
}

export function parseThinkingLevelChangeEntry(entry: ThinkingLevelChangeEntry): SessionAgg {
  const session = emptySession("", "", "");
  session.thinkingLevelCount[entry.thinkingLevel] = 1;
  return session;
}

export function parseCompactionEntry(entry: CompactionEntry): SessionAgg {
  const session = emptySession("", "", "");
  session.compactionCount = 1;
  session.compactedTokens = entry.tokensBefore;
  return session;
}

// ---- Top-level dispatch ----

export function parseSessionLogEntry(entry: FileEntry): SessionAgg | null {
  // Runtime resilience: JSONL files may contain corrupt data despite typing
  if (!entry || typeof entry !== "object") return null;

  switch (entry.type) {
    case "session":
      return parseSessionHeader(entry as SessionHeader);
    case "message": {
      const msgEntry = entry as SessionMessageEntry;
      const hour = new Date(msgEntry.timestamp).getHours();
      const day = emptySession("", "", "");
      const agentResult = parseAgentMessage(msgEntry.message);
      mergeToSession(day, agentResult);

      // If this message has a cost, record the hour at the session level
      // Check if any model has cost
      let hasCost = false;
      for (const modelUsage of Object.values(day.models)) {
        if (modelUsage.cost > 0) {
          hasCost = true;
          break;
        }
      }
      if (hasCost) {
        // Find the total cost across all models in this message
        let msgCost = 0;
        for (const modelUsage of Object.values(day.models)) {
          msgCost += modelUsage.cost;
        }
        day.hourCost[hour] = (day.hourCost[hour] ?? 0) + msgCost;
      }
      return day;
    }
    case "model_change":
      return parseModelChangeEntry(entry as ModelChangeEntry);
    case "thinking_level_change":
      return parseThinkingLevelChangeEntry(entry as ThinkingLevelChangeEntry);
    case "compaction":
      return parseCompactionEntry(entry as CompactionEntry);
    // Silently skip entry types with no cost-relevant data
    case "branch_summary":
    case "custom":
    case "custom_message":
    case "label":
    case "session_info":
    default:
      return null;
  }
}

// ---- Parse a full JSONL file ----

export function parseFile(
  filePath: string,
  onWarning?: (count: number) => void,
): SessionAgg | null {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  const lines = content.split("\n");
  let corruptCount = 0;
  let session: SessionAgg | null = null;
  let entriesFound = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const entry = JSON.parse(trimmed) as FileEntry;
      const result = parseSessionLogEntry(entry);
      if (result) {
        entriesFound = true;
        if (!session) {
          session = result;
        } else {
          mergeToSession(session, result);
        }
      }
    } catch {
      corruptCount++;
      if (onWarning) onWarning(corruptCount);
    }
  }

  // Return null if no valid entries or only corrupt entries
  return entriesFound ? session : null;
}
