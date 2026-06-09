import type {
  AssistantMessageBody,
  DayAgg,
  MessageEntry,
  SessionEntry,
  SessionLogEntry,
  SessionProjectMap,
  ToolResultMessageBody,
} from "./types.js";
import { readFileSync } from "node:fs";
import { basename } from "node:path";

// ---- Language detection ----

const EXT_TO_LANG: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  py: "Python",
  pyi: "Python",
  rs: "Rust",
  go: "Go",
  rb: "Ruby",
  java: "Java",
  kt: "Kotlin",
  kts: "Kotlin",
  swift: "Swift",
  c: "C",
  h: "C",
  cpp: "C++",
  hpp: "C++",
  cc: "C++",
  cxx: "C++",
  cs: "C#",
  php: "PHP",
  scala: "Scala",
  dart: "Dart",
  lua: "Lua",
  r: "R",
  m: "Objective-C",
  mm: "Objective-C",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  sql: "SQL",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "SCSS",
  less: "Less",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  xml: "XML",
  md: "Markdown",
  mdx: "Markdown",
  graphql: "GraphQL",
  gql: "GraphQL",
  proto: "Protobuf",
  tf: "Terraform",
  dockerfile: "Dockerfile",
  env: "Env",
  gitignore: "Gitignore",
  prisma: "Prisma",
  vue: "Vue",
  svelte: "Svelte",
};

export function langFromPath(path: string): string {
  const ext = basename(path).split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "Other";
}

// ---- Project name extraction ----

export function projectNameFromCwd(cwd: string): string {
  return basename(cwd);
}

// ---- Day helpers ----

// Tracks session ID → project name for cost attribution
export const sessionProject: SessionProjectMap = new Map();

export function dateFromISOString(str: string): string {
  return str.slice(0, 10);
}

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
    projectCost: {},
    projectSessions: {},
    toolCount: {},
  };
}

// ---- Merge two DayAggs ----

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
}

// ---- Session entry ----

export function parseSessionEntry(entry: SessionEntry): DayAgg {
  const day = emptyDay(dateFromISOString(entry.timestamp));
  day.sessionIds.add(entry.id);

  if (entry.cwd) {
    const proj = projectNameFromCwd(entry.cwd);
    sessionProject.set(entry.id, proj);
    day.projectCost[proj] = 0;
    day.projectSessions[proj] = new Set([entry.id]);
  }

  return day;
}

// ---- Message entry ----

export function parseUserMessage(): DayAgg {
  const day = emptyDay("");
  day.userMsgs = 1;
  return day;
}

export function parseToolResultMessage(msg: ToolResultMessageBody): DayAgg {
  const day = emptyDay("");
  day.toolResults = 1;
  if (msg.toolName) {
    day.toolCount[msg.toolName] = 1;
  }
  return day;
}

export function parseAssistantMessage(msg: AssistantMessageBody): DayAgg {
  const day = emptyDay("");
  day.asstMsgs = 1;

  if (msg.usage) {
    day.inTok = msg.usage.input;
    day.outTok = msg.usage.output;
    day.crTok = msg.usage.cacheRead;
    day.cwTok = msg.usage.cacheWrite;

    if (msg.usage.cost) {
      day.cost = msg.usage.cost.total;

      const activeProjects = new Set(sessionProject.values());
      for (const proj of activeProjects) {
        day.projectCost[proj] = (day.projectCost[proj] ?? 0) + msg.usage.cost.total;
      }
    }
  }

  if (msg.model && msg.usage?.cost) {
    day.modelCost[msg.model] = msg.usage.cost.total;
    day.modelCount[msg.model] = 1;
  }

  if (msg.content) {
    for (const block of msg.content) {
      if (block.type === "toolCall") {
        day.toolCount[block.name] = (day.toolCount[block.name] ?? 0) + 1;

        if (block.name === "edit" || block.name === "write") {
          mergeDay(
            day,
            detectLanguage(block.name, block.arguments as Record<string, unknown> | undefined),
          );
        }
      }
    }
  }

  return day;
}

export function detectLanguage(
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

export function parseMessageEntry(entry: MessageEntry): DayAgg {
  const day = emptyDay(dateFromISOString(entry.timestamp));
  const { message: msg } = entry;

  if (msg.role === "user") {
    mergeDay(day, parseUserMessage());
  } else if (msg.role === "toolResult") {
    mergeDay(day, parseToolResultMessage(msg));
  } else if (msg.role === "assistant") {
    mergeDay(day, parseAssistantMessage(msg));
  }

  return day;
}

export function parseSessionLogEntry(entry: SessionLogEntry): DayAgg | null {
  // Runtime resilience: JSONL files may contain corrupt data despite typing
  if (!entry || typeof entry !== "object") return null;

  if (entry.type === "session") return parseSessionEntry(entry);
  return parseMessageEntry(entry);
}

// ---- Parse a full JSONL file ----

export function parseFile(
  filePath: string,
  onWarning?: (count: number) => void,
): Map<string, DayAgg> {
  // Each JSONL file represents one session; reset global session→project
  // tracking so costs from previous files don't leak across projects.
  sessionProject.clear();

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
      const entry = JSON.parse(trimmed) as SessionLogEntry;
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
