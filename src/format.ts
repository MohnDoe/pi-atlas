import { basename } from "node:path";

// ---- Language detection ----

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

// ---- Date utilities ----

export function dateFromISOString(str: string): string {
  return str.slice(0, 10);
}

// ---- Month / day constants ----

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// ---- Number formatting ----

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

// ---- Timestamp formatting ----

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

// ---- Model name formatting ----

export function formatModelName(raw: string): string {
  // Strip date suffix (YYYYMMDD or YYYY-MM-DD)
  let name = raw.replace(/-\d{8}$/, "").replace(/-\d{4}-\d{2}-\d{2}$/, "");
  // Replace separators with spaces, title case each word
  return name.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
