import { readFileSync } from "node:fs";

/** Strip control characters (\n, \r, \t, etc.) from a tool name. */
function sanitizeToolName(name: string): string {
  // Remove any character below 0x20 (control chars) except 0x09 (\t) which
  // we also strip, plus 0x7F (DEL) and Unicode general category Cc/Cf.
  return name.replace(/[\x00-\x08\x0A-\x1F\x7F\u200B-\u200F\u2028-\u2029\uFEFF]/g, "");
}

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

import { dateFromISOString, langFromPath, projectNameFromCwd } from "./format.js";
import type { DayAgg } from "./types";

// Tracks session ID → project name for cost attribution
const sessionProjectMap = new Map<string, string>();

export { sessionProjectMap };

export function emptyDay(date: string): DayAgg {
  return {
    date,
    cost: 0,
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

// ---- Session header ----

export function parseSessionHeader(entry: SessionHeader): DayAgg {
  const day = emptyDay(dateFromISOString(entry.timestamp));
  day.sessionIds.add(entry.id);

  if (entry.cwd) {
    const proj = projectNameFromCwd(entry.cwd);
    sessionProjectMap.set(entry.id, proj);
    day.projectCost[proj] = 0;
    day.projectSessions[proj] = new Set([entry.id]);
  }

  return day;
}

// ---- Message parsing ----

export function parseUserMessage(): DayAgg {
  const day = emptyDay("");
  day.userMsgs = 1;
  return day;
}

export function parseToolResultMessage(msg: ToolResultMessage): DayAgg {
  const day = emptyDay("");
  day.toolResults = 1;
  if (msg.toolName) {
    day.toolCount[sanitizeToolName(msg.toolName)] = 1;
  }
  return day;
}

export function parseAssistantMessage(msg: AssistantMessage): DayAgg {
  const day = emptyDay("");
  day.asstMsgs = 1;

  if (msg.usage) {
    day.inTok = msg.usage.input;
    day.outTok = msg.usage.output;
    day.crTok = msg.usage.cacheRead;
    day.cwTok = msg.usage.cacheWrite;

    if (msg.usage.cost) {
      day.cost = msg.usage.cost.total;

      const activeProjects = new Set(sessionProjectMap.values());
      for (const proj of activeProjects) {
        day.projectCost[proj] = (day.projectCost[proj] ?? 0) + msg.usage.cost.total;
      }
    }
  }

  if (msg.model) {
    day.modelCost[msg.model] = msg.usage?.cost?.total || 0;
    day.modelCount[msg.model] = 1;
    if (msg.provider) {
      day.modelToProvider.set(msg.model, msg.provider);
      day.providerCost[msg.provider] = msg.usage?.cost?.total || 0;
      day.providerCount[msg.provider] = 1;
    }
  }

  if (msg.content) {
    for (const block of msg.content) {
      if (block.type === "toolCall") {
        const parsedArgs =
          block.arguments !== undefined
            ? typeof block.arguments === "string"
              ? JSON.parse(block.arguments)
              : block.arguments
            : undefined;
        const sanitized = sanitizeToolName(block.name);
        day.toolCount[sanitized] = (day.toolCount[sanitized] ?? 0) + 1;

        if (block.name === "edit" || block.name === "write") {
          mergeDay(
            day,
            parseLanguageUsage(block.name, parsedArgs as Record<string, unknown> | undefined),
          );
        }
      }
    }
  }

  return day;
}

export function parseLanguageUsage(
  toolName: string,
  args: Record<string, unknown> | undefined,
): DayAgg {
  const day = emptyDay("");
  const path = args?.path as string | undefined;
  if (!path) return day;

  const lang = langFromPath(path);

  if (toolName === "edit") {
    const edits = args?.edits as Array<{ newText?: string; oldText?: string }> | undefined;
    if (Array.isArray(edits)) {
      let totalNewChars = 0;
      for (const edit of edits) {
        totalNewChars += edit.newText?.length ?? 0;
      }
      if (totalNewChars > 0) {
        day.langLines[lang] = (day.langLines[lang] ?? 0) + totalNewChars;
      }
    }
    day.langEdits[lang] = (day.langEdits[lang] ?? 0) + 1;
  } else {
    const contentStr = args?.content as string | undefined;
    if (contentStr) {
      day.langLines[lang] = (day.langLines[lang] ?? 0) + contentStr.length;
    }
  }

  return day;
}

function parseAgentMessage(msg: AgentMessage): DayAgg {
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
      return emptyDay("");
  }
}

// ---- New entry types ----

export function parseModelChangeEntry(entry: ModelChangeEntry): DayAgg {
  const day = emptyDay(dateFromISOString(entry.timestamp));
  day.modelChanges = 1;
  return day;
}

export function parseThinkingLevelChangeEntry(entry: ThinkingLevelChangeEntry): DayAgg {
  const day = emptyDay(dateFromISOString(entry.timestamp));
  day.thinkingLevelCount[entry.thinkingLevel] = 1;
  return day;
}

export function parseCompactionEntry(entry: CompactionEntry): DayAgg {
  const day = emptyDay(dateFromISOString(entry.timestamp));
  day.compactionCount = 1;
  day.compactedTokens = entry.tokensBefore;
  return day;
}

// ---- Top-level dispatch ----

export function parseSessionLogEntry(entry: FileEntry): DayAgg | null {
  // Runtime resilience: JSONL files may contain corrupt data despite typing
  if (!entry || typeof entry !== "object") return null;

  switch (entry.type) {
    case "session":
      return parseSessionHeader(entry as SessionHeader);
    case "message": {
      const msgEntry = entry as SessionMessageEntry;
      const day = emptyDay(dateFromISOString(msgEntry.timestamp));
      mergeDay(day, parseAgentMessage(msgEntry.message));
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
): Map<string, DayAgg> {
  // Each JSONL file represents one session; reset global session→project
  // tracking so costs from previous files don't leak across projects.
  sessionProjectMap.clear();

  const map = new Map<string, DayAgg>();

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return map;
  }

  const lines = content.split("\n");
  let corruptCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const entry = JSON.parse(trimmed) as FileEntry;
      const result = parseSessionLogEntry(entry);
      if (result) {
        const existing = map.get(result.date);
        if (existing) {
          mergeDay(existing, result);
        } else {
          map.set(result.date, result);
        }
      }
    } catch {
      corruptCount++;
      if (onWarning) onWarning(corruptCount);
    }
  }

  return map;
}
