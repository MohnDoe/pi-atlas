import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage, ToolResultMessage, UserMessage } from "@earendil-works/pi-ai";
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
import type { DayAgg } from "./types";

/** Strip control characters (\n, \r, \t, etc.) from a tool name. */
function sanitizeToolName(name: string): string {
  // Remove any character below 0x20 (control chars) except 0x09 (\t) which
  // we also strip, plus 0x7F (DEL) and Unicode general category Cc/Cf.
  return name.replace(/[\x00-\x09\x0A-\x1F\x7F\u200B-\u200F\u2028-\u2029\uFEFF]/g, "");
}

// Tracks session ID → project name for cost attribution
const sessionProjectMap = new Map<string, string>();

export { sessionProjectMap };

// Tracks the active skill name for cost/token/tool attribution
// across subsequent assistant and tool messages.
const _activeSkill: { current: string | null } = { current: null };
export { _activeSkill as activeSkill };

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
    skillCost: {},
    skillCount: {},
    skillTokens: {},
    skillToolCount: {},
    skillToolBreakdown: {},
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

  for (const [k, v] of Object.entries(update.skillCost)) {
    base.skillCost[k] = (base.skillCost[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.skillCount)) {
    base.skillCount[k] = (base.skillCount[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.skillTokens)) {
    base.skillTokens[k] = (base.skillTokens[k] ?? 0) + v;
  }
  for (const [k, v] of Object.entries(update.skillToolCount)) {
    base.skillToolCount[k] = (base.skillToolCount[k] ?? 0) + v;
  }
  for (const [skill, tools] of Object.entries(update.skillToolBreakdown)) {
    if (!base.skillToolBreakdown[skill]) base.skillToolBreakdown[skill] = {};
    for (const [tool, count] of Object.entries(tools)) {
      base.skillToolBreakdown[skill][tool] = (base.skillToolBreakdown[skill][tool] ?? 0) + count;
    }
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

/** Extract text content from a UserMessage as a single string. */
function userMessageContent(msg: UserMessage): string {
  if (typeof msg.content === "string") return msg.content;
  return msg.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export function parseUserMessage(msg: UserMessage): DayAgg {
  const day = emptyDay("");
  day.userMsgs = 1;

  const content = userMessageContent(msg);
  const match = /<skill\s+name="([^"]+)"/i.exec(content);
  if (match && match.length >= 2) {
    _activeSkill.current = match[1]!;
    day.skillCount[match[1]!] = 1;
  } else {
    _activeSkill.current = null;
  }

  return day;
}

export function parseToolResultMessage(msg: ToolResultMessage): DayAgg {
  const day = emptyDay("");
  day.toolResults = 1;
  if (msg.toolName) {
    const sanitized = sanitizeToolName(msg.toolName);
    day.toolCount[sanitized] = 1;

    // Attribute tool call to active skill
    if (_activeSkill.current) {
      day.skillToolCount[_activeSkill.current] = 1;
      if (!day.skillToolBreakdown[_activeSkill.current]) {
        day.skillToolBreakdown[_activeSkill.current] = {};
      }
      day.skillToolBreakdown[_activeSkill.current]![sanitized] = 1;
    }
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

  // Attribute cost and tokens to active skill
  if (_activeSkill.current) {
    day.skillCost[_activeSkill.current] = day.cost;
    const totalTokens = day.inTok + day.outTok + day.crTok + day.cwTok;
    if (totalTokens > 0) {
      day.skillTokens[_activeSkill.current] = totalTokens;
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

        // Attribute tool call to active skill
        if (_activeSkill.current) {
          day.skillToolCount[_activeSkill.current] =
            (day.skillToolCount[_activeSkill.current] ?? 0) + 1;
          if (!day.skillToolBreakdown[_activeSkill.current]) {
            day.skillToolBreakdown[_activeSkill.current] = {};
          }
          day.skillToolBreakdown[_activeSkill.current]![sanitized] =
            (day.skillToolBreakdown[_activeSkill.current]![sanitized] ?? 0) + 1;
        }

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

function countNewLines(s: string): number {
  return (s.match(/\n/g) ?? []).length;
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
      // +1 because no new line is still a line
      day.langLines[lang] = (day.langLines[lang] ?? 0) + countNewLines(contentStr);
    }
    day.langLines[lang] = (day.langLines[lang] ?? 0) + 1;
  }

  return day;
}

function parseAgentMessage(msg: AgentMessage): DayAgg {
  switch (msg.role) {
    case "user":
      return parseUserMessage(msg as UserMessage);
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
      const hour = new Date(msgEntry.timestamp).getHours();
      const day = emptyDay(dateFromISOString(msgEntry.timestamp));
      mergeDay(day, parseAgentMessage(msgEntry.message));
      if (day.cost > 0) {
        day.hourCost[hour] = (day.hourCost[hour] ?? 0) + day.cost;
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
): Map<string, DayAgg> {
  // Each JSONL file represents one session; reset global session→project
  // tracking so costs from previous files don't leak across projects.
  sessionProjectMap.clear();
  _activeSkill.current = null;

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
