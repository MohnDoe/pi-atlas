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
import { mergeUsage } from "./helpers/usage.helper";
import { makeEmptySession } from "./helpers/session.helper";
import type { SessionAgg, SessionModelUsage } from "./types";

// ---- Parse Context ----
// Carries skill-tracking state through the parse call chain.
// Created and owned by parseFile(); threaded through every parse function.
// Immutable — each mutation returns a new ParseResult with updated ctx.

export interface SkillState {
  name: string;
  counted: boolean;
}

export interface ParseContext {
  activeSkill: SkillState | null;
}

export interface ParseResult {
  session: SessionAgg;
  ctx: ParseContext;
}

export const emptyContext: ParseContext = { activeSkill: null };

/** Merge a partial SessionAgg into the base session. */
export function mergeToSession(base: SessionAgg, update: SessionAgg): void {
  base.userMsgs += update.userMsgs;
  base.toolResults += update.toolResults;
  base.compactionCount += update.compactionCount;
  base.compactedTokens += update.compactedTokens;
  base.modelChanges += update.modelChanges;

  for (const [level, count] of Object.entries(update.thinkingLevelCount)) {
    base.thinkingLevelCount[level] =
      (base.thinkingLevelCount[level] ?? 0) + count;
  }

  for (const [skill, skillUsage] of Object.entries(update.skills)) {
    const existing = base.skills[skill];
    if (!existing) {
      base.skills[skill] = {
        ...skillUsage,
      };
    } else {
      existing.usage = mergeUsage(existing.usage, skillUsage.usage);
      existing.calls += skillUsage.calls;
    }
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
        existing.usage = mergeUsage(existing.usage, modelUsage.usage);
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

// ---- Safe JSON parse ----

/** Parse JSON, returning undefined on failure instead of throwing. */
function safeJsonParse(raw: unknown): Record<string, unknown> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") {
    if (typeof raw === "object" && raw !== null)
      return raw as Record<string, unknown>;
    return undefined;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    console.warn(
      "Failed to parse JSON tool arguments:",
      String(raw).slice(0, 200),
    );
    return undefined;
  }
}

// ---- Strip control chars from tool names ----

/** Strip control characters (\n, \r, \t, etc.) from a tool name. */
function sanitizeToolName(name: string): string {
  return name.replace(
    /[\x00-\x09\x0A-\x1F\x7F\u200B-\u200F\u2028-\u2029\uFEFF]/g,
    "",
  );
}

// ---- Session header ----

export function parseSessionHeader(
  entry: SessionHeader,
  ctx: ParseContext,
): ParseResult {
  const project = entry.cwd ? projectNameFromCwd(entry.cwd) : "";
  const cwd = entry.cwd ?? "";
  const session = makeEmptySession(
    entry.id,
    new Date(entry.timestamp),
    project,
    cwd,
  );
  return { session, ctx };
}

// ---- Message parsing ----

export function parseUserMessage(
  msg: UserMessage,
  ctx: ParseContext,
): ParseResult {
  const session = makeEmptySession("", new Date(msg.timestamp * 1000), "");
  session.userMsgs = 1;

  // Reset active skill stack at the start of each user message
  let activeSkill: SkillState | null = null;

  // Detect explicit skill invocations via <skill name="...">
  // Only one skill can be active at a time — last tag wins.
  const content = typeof msg.content === "string" ? msg.content : "";
  const skillTagRegex = /<skill\s+name="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = skillTagRegex.exec(content)) !== null) {
    activeSkill = { name: match[1]!, counted: false };
  }

  return { session, ctx: { activeSkill } };
}

export function parseToolResultMessage(
  msg: ToolResultMessage,
  ctx: ParseContext,
): ParseResult {
  const session = makeEmptySession("", new Date(msg.timestamp));
  session.toolResults = 1;
  // Tool results contribute to the session-level toolResults count.
  // The tool name is tracked via the most recent model's tools — but since
  // tool results don't carry a model, we simply count the result here.
  // The tool name is not attributed to any specific model in SessionAgg.
  return { session, ctx };
}

export function parseAssistantMessage(
  msg: AssistantMessage,
  ctx: ParseContext,
): ParseResult {
  const session = makeEmptySession("", new Date(msg.timestamp));

  const modelName = msg.model;
  const provider = msg.provider ?? "";
  let activeSkill = ctx.activeSkill;

  // Detect implicit skill invocation: agent reads a SKILL.md file via the read tool.
  // Only fires if no explicit skill tag is already active (explicit wins).
  if (!activeSkill && msg.content) {
    for (const block of msg.content) {
      if (block.type === "toolCall" && block.name === "read") {
        const parsedArgs = safeJsonParse(block.arguments);
        const path = parsedArgs?.path as string | undefined;
        if (path && /\/SKILL\.md$/.test(path)) {
          // Skill name is the directory containing SKILL.md
          const segments = path.split("/");
          const skillName = segments[segments.length - 2];
          if (skillName) {
            activeSkill = { name: skillName, counted: false };
          }
          break;
        }
      }
    }
  }

  // Attribute cost to the active skill (if any)
  if (activeSkill && msg.usage) {
    session.skills[activeSkill.name] = {
      usage: msg.usage,
      calls: activeSkill.counted ? 0 : 1,
    };
    activeSkill = { name: activeSkill.name, counted: true };
  }

  if (!modelName) {
    // No model — nothing to track per-model
    return { session, ctx: { activeSkill } };
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
          const parsedArgs = safeJsonParse(block.arguments);
          mergeLangUsage(modelUsage, block.name, parsedArgs);
        }
      }
    }
  }
  if (!session.models[provider]) {
    session.models[provider] = {};
  }
  session.models[provider][modelName] = modelUsage;

  return { session, ctx: { activeSkill } };
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
    const edits = args?.edits as
      | Array<{ newText?: string; oldText?: string }>
      | undefined;
    if (Array.isArray(edits)) {
      let totalNewLines = 0;
      for (const edit of edits) {
        totalNewLines +=
          countNewLines(edit.newText ?? "") +
          countNewLines(edit.oldText ?? "") +
          1;
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

function parseAgentMessage(msg: AgentMessage, ctx: ParseContext): ParseResult {
  switch (msg.role) {
    case "user":
      return parseUserMessage(msg, ctx);
    case "toolResult":
      return parseToolResultMessage(msg as ToolResultMessage, ctx);
    case "assistant":
      return parseAssistantMessage(msg as AssistantMessage, ctx);
    // skip non-cost-relevant message types
    case "bashExecution":
    case "custom":
    case "branchSummary":
    case "compactionSummary":
    default:
      return { session: makeEmptySession("", new Date(msg.timestamp)), ctx };
  }
}

// ---- New entry types ----

export function parseModelChangeEntry(
  entry: ModelChangeEntry,
  ctx: ParseContext,
): ParseResult {
  const session = makeEmptySession("", new Date(entry.timestamp));
  session.modelChanges = 1;
  return { session, ctx };
}

export function parseThinkingLevelChangeEntry(
  entry: ThinkingLevelChangeEntry,
  ctx: ParseContext,
): ParseResult {
  const session = makeEmptySession("", new Date(entry.timestamp));
  session.thinkingLevelCount[entry.thinkingLevel] = 1;
  return { session, ctx };
}

export function parseCompactionEntry(
  entry: CompactionEntry,
  ctx: ParseContext,
): ParseResult {
  const session = makeEmptySession("", new Date(entry.timestamp));
  session.compactionCount = 1;
  session.compactedTokens = entry.tokensBefore;
  return { session, ctx };
}

// ---- Top-level dispatch ----

export function parseSessionLogEntry(
  entry: FileEntry,
  ctx: ParseContext,
): ParseResult | null {
  // Runtime resilience: JSONL files may contain corrupt data despite typing
  if (!entry || typeof entry !== "object") return null;

  switch (entry.type) {
    case "session":
      return parseSessionHeader(entry as SessionHeader, ctx);
    case "message": {
      const msgEntry = entry as SessionMessageEntry;
      const day = makeEmptySession("", new Date(entry.timestamp));
      const agentResult = parseAgentMessage(msgEntry.message, ctx);
      mergeToSession(day, agentResult.session);

      return { session: day, ctx: agentResult.ctx };
    }
    case "model_change":
      return parseModelChangeEntry(entry as ModelChangeEntry, ctx);
    case "thinking_level_change":
      return parseThinkingLevelChangeEntry(
        entry as ThinkingLevelChangeEntry,
        ctx,
      );
    case "compaction":
      return parseCompactionEntry(entry as CompactionEntry, ctx);
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
  let ctx: ParseContext = emptyContext;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const entry = JSON.parse(trimmed) as FileEntry;
      const result = parseSessionLogEntry(entry, ctx);
      if (result) {
        entriesFound = true;
        ctx = result.ctx;
        if (!session) {
          session = result.session;
        } else {
          mergeToSession(session, result.session);
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
