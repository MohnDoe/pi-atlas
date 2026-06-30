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

import { langFromPath, projectNameFromCwd } from "./format";
import type { SessionAgg, SessionModelUsage } from "./types";

// ---- SessionAgg helpers ----

/** Create a zeroed SessionAgg with session identity. */
export function emptySession(sessionId: string, date: Date, project: string): SessionAgg {
  return {
    timestamp: date.toISOString(),
    sessionId,
    project,
    models: {},
    userMsgs: 0,
    toolResults: 0,
    compactionCount: 0,
    compactedTokens: 0,
    modelChanges: 0,
    thinkingLevelCount: {},
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

  for (const [modelName, usage] of Object.entries(update.models)) {
    const existing = base.models[modelName];
    if (!existing) {
      base.models[modelName] = {
        ...usage,
        tools: { ...usage.tools },
        languages: { ...usage.languages },
      };
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
  const project = entry.cwd ? projectNameFromCwd(entry.cwd) : "";
  const session = emptySession(entry.id, new Date(entry.timestamp), project);
  return session;
}

// ---- Message parsing ----

export function parseUserMessage(msg: UserMessage): SessionAgg {
  const session = emptySession("", new Date(msg.timestamp * 1000), "");
  session.userMsgs = 1;
  return session;
}

export function parseToolResultMessage(msg: ToolResultMessage): SessionAgg {
  const session = emptySession("", new Date(msg.timestamp), "");
  session.toolResults = 1;
  // Tool results contribute to the session-level toolResults count.
  // The tool name is tracked via the most recent model's tools — but since
  // tool results don't carry a model, we simply count the result here.
  // The tool name is not attributed to any specific model in SessionAgg.
  return session;
}

export function parseAssistantMessage(msg: AssistantMessage): SessionAgg {
  const session = emptySession("", new Date(msg.timestamp), "");

  const modelName = msg.model;
  const provider = msg.provider ?? "";

  if (!modelName) {
    // No model — nothing to track per-model
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

function parseAgentMessage(msg: AgentMessage): SessionAgg {
  switch (msg.role) {
    case "user":
      return parseUserMessage(msg);
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
      return emptySession("", new Date(msg.timestamp), "");
  }
}

// ---- New entry types ----

export function parseModelChangeEntry(entry: ModelChangeEntry): SessionAgg {
  const session = emptySession("", new Date(entry.timestamp), "");
  session.modelChanges = 1;
  return session;
}

export function parseThinkingLevelChangeEntry(entry: ThinkingLevelChangeEntry): SessionAgg {
  const session = emptySession("", new Date(entry.timestamp), "");
  session.thinkingLevelCount[entry.thinkingLevel] = 1;
  return session;
}

export function parseCompactionEntry(entry: CompactionEntry): SessionAgg {
  const session = emptySession("", new Date(entry.timestamp), "");
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
      const day = emptySession("", new Date(entry.timestamp), "");
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
        // day.hourCost[hour] = (day.hourCost[hour] ?? 0) + msgCost;
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
    } catch (e) {
      corruptCount++;
      console.error(e);
      if (onWarning) onWarning(corruptCount);
    }
  }

  // Return null if no valid entries or only corrupt entries
  return entriesFound ? session : null;
}
