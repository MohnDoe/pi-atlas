import type { DayAgg } from "./types.js";
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
const sessionProject = new Map<string, string>();

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

type ToolCallBlock = {
  type?: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
};

type TextBlock = {
  type?: string;
  text?: string;
};

export function parseLine(entry: unknown, map: Map<string, DayAgg>): void {
  if (!entry || typeof entry !== "object") return;
  const e = entry as Record<string, unknown>;

  const ts = e.timestamp as string | undefined;
  if (!ts) return;

  const date = dateFromTimestamp(ts);

  if (e.type === "session") {
    const day = ensureDay(map, date);
    const id = e.id as string;
    if (id) day.sessionIds.add(id);

    // project tracking
    const cwd = e.cwd as string | undefined;
    if (cwd && id) {
      const proj = projectNameFromCwd(cwd);
      sessionProject.set(id, proj);
      day.projectCost[proj] = day.projectCost[proj] ?? 0;
      if (!day.projectSessions[proj]) day.projectSessions[proj] = new Set();
      day.projectSessions[proj].add(id);
    }
    return;
  }

  if (e.type !== "message") return;

  const msg = e.message as Record<string, unknown> | undefined;
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
    let msgCost = 0;
    if (usage) {
      day.inTok += (usage.input as number) ?? 0;
      day.outTok += (usage.output as number) ?? 0;
      day.crTok += (usage.cacheRead as number) ?? 0;
      day.cwTok += (usage.cacheWrite as number) ?? 0;

      const cost = usage.cost as Record<string, number> | undefined;
      if (cost) {
        msgCost = cost.total ?? 0;
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
    const model = msg.model as string | undefined;
    if (model && usage?.cost) {
      const cost = usage.cost as Record<string, number>;
      const totalCost = cost.total ?? 0;
      day.modelCost[model] = (day.modelCost[model] ?? 0) + totalCost;
      day.modelCount[model] = (day.modelCount[model] ?? 0) + 1;
    }

    // tool calls in assistant content
    const content = msg.content as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === "toolCall") {
          const tcName = block.name as string | undefined;
          if (tcName) {
            day.toolCount[tcName] = (day.toolCount[tcName] ?? 0) + 1;
          }

          // Language detection from edit/write tool calls
          if (tcName === "edit" || tcName === "write") {
            const args = block.arguments as Record<string, unknown> | undefined;
            const path = args?.path as string | undefined;
            if (path) {
              const lang = langFromPath(path);
              if (tcName === "edit") {
                const edits = args?.edits as
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
                const contentStr = args?.content as string | undefined;
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
      const entry = JSON.parse(trimmed);
      parseLine(entry, map);
    } catch {
      corruptCount++;
      if (onWarning) onWarning(corruptCount);
    }
  }
}
