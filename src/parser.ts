import { readFileSync } from "node:fs";
import { basename } from "node:path";
import type {
  AssistantMessageBody,
  DayAgg,
  MessageEntry,
  SessionEntry,
  SessionLogEntry,
  SessionProjectMap,
  ToolResultMessageBody,
} from "./types";

export const EXT_TO_LANG: Record<string, string> = {
  astro: "Astro",
  bash: "Shell",
  c: "C",
  cc: "C++",
  cjs: "JavaScript",
  clj: "Clojure",
  cljs: "Clojure",
  coffee: "CoffeeScript",
  cpp: "C++",
  cr: "Crystal",
  cs: "C#",
  css: "CSS",
  cts: "TypeScript",
  dart: "Dart",
  dockerfile: "Dockerfile",
  ejs: "EJS",
  elm: "Elm",
  env: "Env",
  erl: "Erlang",
  ex: "Elixir",
  exs: "Elixir",
  fs: "F#",
  fsi: "F#",
  fsx: "F#",
  gitignore: "Gitignore",
  gleam: "Gleam",
  go: "Go",
  gql: "GraphQL",
  graphql: "GraphQL",
  graphqls: "GraphQL",
  groovy: "Groovy",
  h: "C",
  hbs: "Handlebars",
  hpp: "C++",
  hs: "Haskell",
  htm: "HTML",
  html: "HTML",
  "html.j2": "Jinja",
  j2: "Jinja",
  java: "Java",
  jinja: "Jinja",
  jinja2: "Jinja",
  jl: "Julia",
  js: "JavaScript",
  json: "JSON",
  jsx: "JavaScript",
  kt: "Kotlin",
  kts: "Kotlin",
  less: "Less",
  liquid: "Liquid",
  lua: "Lua",
  m: "Objective-C",
  md: "Markdown",
  mdx: "Markdown",
  mjs: "JavaScript",
  mm: "Objective-C",
  mts: "TypeScript",
  mustache: "Mustache",
  nix: "Nix",
  njk: "Nunjucks",
  php: "PHP",
  phtml: "PHP",
  pl: "Perl",
  pm: "Perl",
  prisma: "Prisma",
  proto: "Protobuf",
  ps1: "PowerShell",
  psd1: "PowerShell",
  psm1: "PowerShell",
  pug: "Pug",
  py: "Python",
  pyi: "Python",
  qml: "QML",
  r: "R",
  raku: "Raku",
  rb: "Ruby",
  rs: "Rust",
  scala: "Scala",
  scss: "SCSS",
  sh: "Shell",
  sol: "Solidity",
  sql: "SQL",
  styl: "Stylus",
  svelte: "Svelte",
  swift: "Swift",
  tf: "Terraform",
  toml: "TOML",
  ts: "TypeScript",
  tsx: "TypeScript",
  twig: "Twig",
  vue: "Vue",
  wasm: "WebAssembly",
  wat: "WebAssembly",
  xml: "XML",
  yaml: "YAML",
  yml: "YAML",
  zig: "Zig",
  zsh: "Shell",
};

export function langFromPath(path: string): string {
  const ext = basename(path).split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? "Other";
}

// ---- Project name extraction ----

export function projectNameFromCwd(cwd: string): string {
  return basename(cwd);
}

// Tracks session ID → project name for cost attribution
export const sessionProjectMap: SessionProjectMap = new Map();

export function dateFromISOString(str: string): string {
  return str.slice(0, 10);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}

export function formatCost(n: number): string {
  if (n >= 1_000_000) return "$" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "$" + (n / 1_000).toFixed(1) + "k";
  return "$" + n.toFixed(2);
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatTime(d: Date): string {
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function datePart(iso: string): string {
  return iso.slice(0, 10);
}

export function formatCacheTimestamp(iso: string): string {
  const d = new Date(iso);
  const time = formatTime(d);

  const now = new Date();
  const today = datePart(now.toISOString());
  const yesterday = datePart(new Date(now.getTime() - 86400000).toISOString());
  const thisYear = now.getUTCFullYear();

  const dayPart = datePart(iso);

  if (dayPart === today) {
    return time;
  }

  if (dayPart === yesterday) {
    return `Yesterday ${time}`;
  }

  const month = MONTH_NAMES[d.getUTCMonth()];
  const day = d.getUTCDate();

  if (d.getUTCFullYear() === thisYear) {
    return `${month} ${day}, ${time}`;
  }

  return `${month} ${day}, ${d.getUTCFullYear()}`;
}

export function formatModelName(raw: string): string {
  // Strip date suffix (YYYYMMDD or YYYY-MM-DD)
  let name = raw.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
  // Replace separators with spaces, title case each word
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
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

export function parseSessionEntry(entry: SessionEntry): DayAgg {
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

      const activeProjects = new Set(sessionProjectMap.values());
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
