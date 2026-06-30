import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type {
  AssistantMessage,
  ToolCall,
  ToolResultMessage,
  UserMessage,
} from "@earendil-works/pi-ai";
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
export function emptySession(
  sessionId: string,
  date: Date,
  project?: string,
  cwd?: string,
): SessionAgg {
  return {
    timestamp: date.toISOString(),
    sessionId,
    project: project ?? "",
    cwd: cwd ?? "",
    models: {},
    userMsgs: 0,
    toolResults: 0,
    compactionCount: 0,
    compactedTokens: 0,
    modelChanges: 0,
    thinkingLevelCount: {},
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

  for (const [provider, models] of Object.entries(update.models)) {
    if (!base.models[provider]) {
      base.models[provider] = {};
    }
    for (const [modelName, modelUsage] of Object.entries(models)) {
      const existing = base.models[provider][modelName];
      if (!existing) {
        base.models[provider][modelName] = {
          ...modelUsage,
          tools: { ...modelUsage.tools },
          languages: { ...modelUsage.languages },
        };
      } else {
        existing.usage = {
          cost: {
            total: existing.usage.cost.total + modelUsage.usage.cost.total,
            cacheRead: existing.usage.cost.cacheRead + modelUsage.usage.cost.cacheRead,
            cacheWrite: existing.usage.cost.cacheWrite + modelUsage.usage.cost.cacheWrite,
            input: existing.usage.cost.input + modelUsage.usage.cost.input,
            output: existing.usage.cost.output + modelUsage.usage.cost.output,
          },
          output: existing.usage.output + modelUsage.usage.output,
          input: existing.usage.input + modelUsage.usage.input,
          cacheWrite: existing.usage.cacheWrite + modelUsage.usage.cacheWrite,
          cacheRead: existing.usage.cacheRead + modelUsage.usage.cacheRead,
          totalTokens: existing.usage.totalTokens + modelUsage.usage.totalTokens,
        };
        existing.calls += modelUsage.calls;
        existing.asstMsgs += modelUsage.asstMsgs;

        for (const [tool, count] of Object.entries(modelUsage.tools)) {
          existing.tools[tool] = (existing.tools[tool] ?? 0) + count;
        }
        for (const [lang, lu] of Object.entries(modelUsage.languages)) {
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
}

// ---- Strip control chars from tool names ----

/** Strip control characters (\n, \r, \t, etc.) from a tool name. */
function sanitizeToolName(name: string): string {
  return name.replace(/[\x00-\x09\x0A-\x1F\x7F\u200B-\u200F\u2028-\u2029\uFEFF]/g, "");
}

// ---- Session header ----

export function parseSessionHeader(entry: SessionHeader): SessionAgg {
  const project = entry.cwd ? projectNameFromCwd(entry.cwd) : "";
  const cwd = entry.cwd ?? "";
  const session = emptySession(entry.id, new Date(entry.timestamp), project, cwd);
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

  // Build this model's usage entry
  const modelUsage: SessionModelUsage = {
    provider,
    api: msg.api,
    calls: 1,
    usage: msg.usage,
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
  if (!session.models[provider]) {
    session.models[provider] = {};
  }
  session.models[provider][modelName] = modelUsage;

  return session;
}

function mergeLangUsage(
  modelUsage: SessionModelUsage,
  toolName: ToolCall["name"],
  args: ToolCall["arguments"] | undefined,
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
      return emptySession("", new Date(msg.timestamp));
  }
}

// ---- New entry types ----

export function parseModelChangeEntry(entry: ModelChangeEntry): SessionAgg {
  const session = emptySession("", new Date(entry.timestamp));
  session.modelChanges = 1;
  return session;
}

export function parseThinkingLevelChangeEntry(entry: ThinkingLevelChangeEntry): SessionAgg {
  const session = emptySession("", new Date(entry.timestamp));
  session.thinkingLevelCount[entry.thinkingLevel] = 1;
  return session;
}

export function parseCompactionEntry(entry: CompactionEntry): SessionAgg {
  const session = emptySession("", new Date(entry.timestamp));
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
      const day = emptySession("", new Date(entry.timestamp));
      const agentResult = parseAgentMessage(msgEntry.message);
      mergeToSession(day, agentResult);

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
