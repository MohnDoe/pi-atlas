import type { DayAgg, SessionLogEntry, SessionProjectMap } from "./types.js";
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

function langFromPath(path: string): string {
  const ext = basename(path).split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "Other";
}

// ---- Project name extraction ----

function projectNameFromCwd(cwd: string): string {
  return basename(cwd);
}

// ---- Day helpers ----

// Tracks session ID → project name for cost attribution
const sessionProject: SessionProjectMap = new Map();

function ensureDay(map: Map<string, DayAgg>, date: string): DayAgg {
  let day = map.get(date);
  if (!day) {
    day = {
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
    map.set(date, day);
  }
  return day;
}

function dateFromTimestamp(ts: string): string {
  return ts.slice(0, 10);
}

// ---- Parse single entry ----

export function parseLine(entry: SessionLogEntry, map: Map<string, DayAgg>): void {
  // Runtime resilience: JSONL files may contain corrupt data despite typing
  if (!entry || typeof entry !== "object") return;

  if (entry.type === "session") {
    const date = dateFromTimestamp(entry.timestamp);
    const day = ensureDay(map, date);
    day.sessionIds.add(entry.id);

    // project tracking
    if (entry.cwd) {
      const proj = projectNameFromCwd(entry.cwd);
      sessionProject.set(entry.id, proj);
      day.projectCost[proj] = day.projectCost[proj] ?? 0;
      if (!day.projectSessions[proj]) day.projectSessions[proj] = new Set();
      day.projectSessions[proj].add(entry.id);
    }
    return;
  }

  // entry.type === "message"
  const { message: msg } = entry;
  const date = dateFromTimestamp(entry.timestamp);
  const day = ensureDay(map, date);

  if (msg.role === "user") {
    day.userMsgs++;
    return;
  }

  if (msg.role === "toolResult") {
    day.toolResults++;
    if (msg.toolName) {
      day.toolCount[msg.toolName] = (day.toolCount[msg.toolName] ?? 0) + 1;
    }
    return;
  }

  if (msg.role === "assistant") {
    day.asstMsgs++;

    let msgCost = 0;
    if (msg.usage) {
      day.inTok += msg.usage.input;
      day.outTok += msg.usage.output;
      day.crTok += msg.usage.cacheRead;
      day.cwTok += msg.usage.cacheWrite;

      if (msg.usage.cost) {
        msgCost = msg.usage.cost.total;
        day.cost += msgCost;
      }
    }

    // attribute cost to all projects active on this day
    if (msgCost > 0) {
      for (const proj of Object.keys(day.projectCost)) {
        day.projectCost[proj] = (day.projectCost[proj] ?? 0) + msgCost;
      }
    }

    // model stats
    if (msg.model && msg.usage?.cost) {
      const totalCost = msg.usage.cost.total;
      day.modelCost[msg.model] = (day.modelCost[msg.model] ?? 0) + totalCost;
      day.modelCount[msg.model] = (day.modelCount[msg.model] ?? 0) + 1;
    }

    // tool calls in assistant content
    if (msg.content) {
      for (const block of msg.content) {
        if (block.type === "toolCall") {
          day.toolCount[block.name] = (day.toolCount[block.name] ?? 0) + 1;

          // Language detection from edit/write tool calls
          if (block.name === "edit" || block.name === "write") {
            const path = block.arguments?.path as string | undefined;
            if (path) {
              const lang = langFromPath(path);
              if (block.name === "edit") {
                const edits = block.arguments?.edits as
                  | Array<{ newText?: string; oldText?: string }>
                  | undefined;
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
                // write
                const contentStr = block.arguments?.content as string | undefined;
                const lines = contentStr?.length ?? 0;
                if (lines > 0) {
                  day.langLines[lang] = (day.langLines[lang] ?? 0) + lines;
                }
              }
            }
          }
        }
      }
    }
  }
}

// ---- Parse a full JSONL file ----

export function parseFile(
  filePath: string,
  map: Map<string, DayAgg>,
  onWarning?: (count: number) => void,
): void {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  const lines = content.split("\n");
  let corruptCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const entry = JSON.parse(trimmed) as SessionLogEntry;
      parseLine(entry, map);
    } catch {
      corruptCount++;
      if (onWarning) onWarning(corruptCount);
    }
  }
}
