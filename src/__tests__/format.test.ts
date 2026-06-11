import { describe, expect, it } from "vitest";
import {
  dateFromISOString,
  formatCacheTimestamp,
  formatCost,
  formatModelName,
  formatNumber,
  langFromPath,
  projectNameFromCwd,
} from "../format";

describe("formatModelName", () => {
  it("handles standard model names", () => {
    expect(formatModelName("deepseek-v4-pro")).toBe("Deepseek V4 Pro");
    expect(formatModelName("llama-3-70b")).toBe("Llama 3 70b");
    expect(formatModelName("claude-haiku-3.5")).toBe("Claude Haiku 3.5");
    expect(formatModelName("gemini-2.5-pro")).toBe("Gemini 2.5 Pro");
  });

  it("strips 8-digit date suffix", () => {
    expect(formatModelName("claude-opus-4-20250514")).toBe("Claude Opus 4");
  });

  it("strips YYYY-MM-DD date suffix", () => {
    expect(formatModelName("some-model-2025-05-14")).toBe("Some Model");
  });
});

describe("langFromPath", () => {
  it("maps .ts to TypeScript", () => {
    expect(langFromPath("/src/foo.ts")).toBe("TypeScript");
  });

  it("maps .rs to Rust", () => {
    expect(langFromPath("/src/lib.rs")).toBe("Rust");
  });

  it("maps .py to Python", () => {
    expect(langFromPath("/app/main.py")).toBe("Python");
  });

  it("maps common web extensions", () => {
    expect(langFromPath("/src/App.tsx")).toBe("TypeScript");
    expect(langFromPath("/src/App.jsx")).toBe("JavaScript");
    expect(langFromPath("/styles.css")).toBe("CSS");
    expect(langFromPath("/index.html")).toBe("HTML");
    expect(langFromPath("/data.json")).toBe("JSON");
    expect(langFromPath("/config.yaml")).toBe("YAML");
    expect(langFromPath("/README.md")).toBe("Markdown");
  });

  it("handles files without extension as 'Other'", () => {
    expect(langFromPath("/src/Makefile")).toBe("Other");
    expect(langFromPath("/src/justfile")).toBe("Other");
  });

  it("handles unknown extensions as 'Other'", () => {
    expect(langFromPath("/data/file.xyz")).toBe("Other");
    expect(langFromPath("/data/file.abcdef")).toBe("Other");
  });

  it("handles Dockerfile extension correctly", () => {
    expect(langFromPath("/app/Dockerfile")).toBe("Dockerfile");
  });

  it("is case-insensitive for extension lookup", () => {
    expect(langFromPath("/src/Foo.TS")).toBe("TypeScript");
    expect(langFromPath("/src/Foo.PY")).toBe("Python");
  });
});

describe("projectNameFromCwd", () => {
  it("extracts basename from Unix path", () => {
    expect(projectNameFromCwd("/home/doe/Work/dev/pi-usage")).toBe("pi-usage");
  });

  it("handles single-level path", () => {
    expect(projectNameFromCwd("/my-project")).toBe("my-project");
  });

  it("strips trailing slash like basename", () => {
    expect(projectNameFromCwd("/home/doe/proj/")).toBe("proj");
  });
});

describe("dateFromISOString", () => {
  it("extracts YYYY-MM-DD from ISO timestamp", () => {
    expect(dateFromISOString("2026-06-08T17:37:04.122Z")).toBe("2026-06-08");
  });

  it("works on date-only", () => {
    expect(dateFromISOString("2026-12-31")).toBe("2026-12-31");
  });
});

describe("formatNumber", () => {
  it("formats numbers below 1000 as-is", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(999)).toBe("999");
  });

  it("formats thousands with k", () => {
    expect(formatNumber(1000)).toBe("1.0k");
    expect(formatNumber(1500)).toBe("1.5k");
    expect(formatNumber(999999)).toBe("1000.0k");
  });

  it("formats millions with M", () => {
    expect(formatNumber(1_000_000)).toBe("1.00M");
    expect(formatNumber(2_500_000)).toBe("2.50M");
  });

  it("formats billions with B", () => {
    expect(formatNumber(1_000_000_000)).toBe("1.00B");
    expect(formatNumber(2_500_000_000)).toBe("2.50B");
  });
});

describe("formatCost", () => {
  it("formats small costs with $ and two decimals", () => {
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(1.5)).toBe("$1.50");
    expect(formatCost(999.99)).toBe("$999.99");
  });

  it("formats thousands with k", () => {
    expect(formatCost(1000)).toBe("$1.0k");
    expect(formatCost(1500)).toBe("$1.5k");
  });

  it("formats millions with M", () => {
    expect(formatCost(1_000_000)).toBe("$1.0M");
    expect(formatCost(2_500_000)).toBe("$2.5M");
  });
});

describe("formatCacheTimestamp", () => {
  it("shows time only for same day", () => {
    const now = new Date();
    const iso = now.toISOString();
    const result = formatCacheTimestamp(iso);
    expect(result).toMatch(/\d{1,2}:\d{2}/);
    expect(result).not.toContain("Yesterday");
    expect(result).not.toContain(",");
  });

  it("shows 'Yesterday' for previous day", () => {
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const iso = yesterday.toISOString();
    const result = formatCacheTimestamp(iso);
    expect(result).toMatch(/^Yesterday/);
  });

  it("shows date for older dates this year", () => {
    const old = new Date("2026-01-15T14:30:00Z");
    const iso = old.toISOString();
    const result = formatCacheTimestamp(iso);
    expect(result).toMatch(/^Jan 15,/);
  });

  it("shows date with year for previous year", () => {
    const old = new Date("2025-06-10T09:15:00Z");
    const iso = old.toISOString();
    const result = formatCacheTimestamp(iso);
    expect(result).toMatch(/2025/);
  });
});
