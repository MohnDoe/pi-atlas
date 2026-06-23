import { describe, expect, it } from "bun:test";
import {
  EXT_TO_LANG,
  MONTH_NAMES,
  dateFromISOString,
  formatCacheTimestamp,
  formatCost,
  formatModelName,
  formatNumber,
  langFromPath,
  projectNameFromCwd,
  stripAnsi,
} from "./format";

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

  it("handles underscore separators", () => {
    expect(formatModelName("deepseek_v4_pro")).toBe("Deepseek V4 Pro");
  });

  it("handles mixed separators", () => {
    expect(formatModelName("claude-opus_4")).toBe("Claude Opus 4");
  });

  it("handles empty string", () => {
    expect(formatModelName("")).toBe("");
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

  it("handles multi-dot filenames", () => {
    expect(langFromPath("/src/foo.min.js")).toBe("JavaScript");
  });

  it("handles hidden files (dotfiles) as extensions", () => {
    expect(langFromPath("/src/.gitignore")).toBe("Gitignore");
  });

  it("handles Jinja compound extensions", () => {
    expect(langFromPath("/templates/page.html.j2")).toBe("Jinja");
  });

  it("handles file named only .extension", () => {
    expect(langFromPath("/src/.ts")).toBe("TypeScript");
  });

  it("maps all EXT_TO_LANG entries correctly", () => {
    for (const [ext, expected] of Object.entries(EXT_TO_LANG)) {
      expect(langFromPath(`/file.${ext}`)).toBe(expected);
    }
  });
});

describe("projectNameFromCwd", () => {
  it("extracts basename from Unix path", () => {
    expect(projectNameFromCwd("/home/mohndoe/Work/pi-atlas")).toBe("pi-atlas");
  });

  it("handles single-level path", () => {
    expect(projectNameFromCwd("/my-project")).toBe("my-project");
  });

  it("strips trailing slash like basename", () => {
    expect(projectNameFromCwd("/home/doe/proj/")).toBe("proj");
  });

  it("handles root path", () => {
    expect(projectNameFromCwd("/")).toBe("");
  });

  it("handles empty string", () => {
    expect(projectNameFromCwd("")).toBe("");
  });

  it("handles relative path components", () => {
    expect(projectNameFromCwd(".")).toBe(".");
    expect(projectNameFromCwd("..")).toBe("..");
  });
});

describe("dateFromISOString", () => {
  it("extracts YYYY-MM-DD from ISO timestamp", () => {
    expect(dateFromISOString("2026-06-08T17:37:04.122Z")).toBe("2026-06-08");
  });

  it("works on date-only", () => {
    expect(dateFromISOString("2026-12-31")).toBe("2026-12-31");
  });

  it("handles empty string", () => {
    expect(dateFromISOString("")).toBe("");
  });

  it("handles short string", () => {
    expect(dateFromISOString("2026")).toBe("2026");
  });
});

describe("formatNumber", () => {
  it("formats numbers below 1000 as-is", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(999)).toBe("999");
  });

  it("formats thousands with k", () => {
    expect(formatNumber(1000)).toBe("1k");
    expect(formatNumber(1500)).toBe("1.5k");
    expect(formatNumber(1510)).toBe("1.51k");
    expect(formatNumber(1517)).toBe("1.52k");
    expect(formatNumber(999999)).toBe("1,000k");
  });

  it("formats millions with M", () => {
    expect(formatNumber(1_000_000)).toBe("1M");
    expect(formatNumber(2_500_000)).toBe("2.5M");
  });

  it("formats billions with B", () => {
    expect(formatNumber(1_000_000_000)).toBe("1B");
    expect(formatNumber(2_500_000_000)).toBe("2.5B");
    expect(formatNumber(12_530_000_000)).toBe("12.53B");
    expect(formatNumber(12_533_000_000)).toBe("12.53B");
    expect(formatNumber(12_538_000_000)).toBe("12.54B");
  });

  it("handles negative numbers (no suffix — current behavior)", () => {
    // Negative numbers fall through all n >= threshold checks
    expect(formatNumber(-500)).toBe("-500");
    expect(formatNumber(-1500)).toBe("-1500");
    expect(formatNumber(-2_500_000)).toBe("-2500000");
  });

  it("handles boundary values", () => {
    expect(formatNumber(999)).toBe("999");
    expect(formatNumber(1000)).toBe("1k");
    expect(formatNumber(999_999)).toBe("1,000k");
    expect(formatNumber(1_000_000)).toBe("1M");
    expect(formatNumber(999_999_999)).toBe("1,000M");
    expect(formatNumber(1_000_000_000)).toBe("1B");
  });

  it("handles large numbers beyond billions", () => {
    expect(formatNumber(1_000_000_000_000)).toBe("1,000B");
  });
});

describe("formatCost", () => {
  it("formats small costs with $ and least decimals possible", () => {
    expect(formatCost(0)).toBe("$0");
    expect(formatCost(1.5)).toBe("$1.5");
    expect(formatCost(999.99)).toBe("$999.99");
  });

  it("formats thousands with k", () => {
    expect(formatCost(1000)).toBe("$1k");
    expect(formatCost(1500)).toBe("$1.5k");
  });

  it("formats millions with M", () => {
    expect(formatCost(1_000_000)).toBe("$1M");
    expect(formatCost(2_500_000)).toBe("$2.5M");
  });

  it("handles boundary values", () => {
    expect(formatCost(999.99)).toBe("$999.99");
    expect(formatCost(1000)).toBe("$1k");
    expect(formatCost(999_999)).toBe("$1,000k");
    expect(formatCost(1_000_000)).toBe("$1M");
  });

  it("handles costs above billions", () => {
    expect(formatCost(1_000_000_000)).toBe("$1,000M");
  });
});

describe("stripAnsi", () => {
  it("passes through plain text unchanged", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });

  it("strips ANSI color codes", () => {
    expect(stripAnsi("\x1b[32mgreen\x1b[0m")).toBe("green");
  });

  it("strips ANSI cursor and erase sequences", () => {
    expect(stripAnsi("\x1b[2J\x1b[Hclear")).toBe("clear");
  });

  it("strips ANSI underline codes", () => {
    expect(stripAnsi("\x1b[4munderlined\x1b[24m")).toBe("underlined");
  });

  it("strips control characters", () => {
    expect(stripAnsi("line1\x00line2")).toBe("line1line2");
    expect(stripAnsi("a\x08b")).toBe("ab");
  });

  it("strips zero-width and formatting characters", () => {
    expect(stripAnsi("a\u200Bb")).toBe("ab");
    expect(stripAnsi("a\uFEFFb")).toBe("ab");
  });

  it("strips OSC sequences (\x1b]...\x07)", () => {
    const osc = "\x1b]0;My Title\x07content";
    expect(stripAnsi(osc)).toBe("content");
  });

  it("handles empty string", () => {
    expect(stripAnsi("")).toBe("");
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
    yesterday.setUTCDate(new Date().getUTCDate() - 1);
    const iso = yesterday.toISOString();
    const result = formatCacheTimestamp(iso);
    expect(result).toMatch(/^Yesterday/);
  });

  it("shows date for older dates this year", () => {
    const year = new Date().getFullYear();
    const old = new Date(year, 0, 15, 14, 30, 0);
    const iso = old.toISOString();
    const result = formatCacheTimestamp(iso);
    const monthName = MONTH_NAMES[old.getMonth()];
    const day = old.getDate();
    expect(result).toMatch(new RegExp(`^${monthName} ${day},`));
    expect(result).not.toContain(String(year));
  });

  it("shows date with year for previous year", () => {
    const year = new Date().getFullYear() - 1;
    const old = new Date(year, 5, 10, 9, 15, 0);
    const iso = old.toISOString();
    const result = formatCacheTimestamp(iso);
    expect(result).toMatch(new RegExp(String(year)));
  });

  // ---- Timezone-awareness tests ----

  it("formats time in local timezone", () => {
    const d = new Date("2026-06-15T07:30:00Z");
    const iso = d.toISOString();
    const result = formatCacheTimestamp(iso);

    // Compute expected local time using the same algorithm as the source
    const localHr = d.getHours();
    const localMin = d.getMinutes();
    const h12 = localHr % 12 || 12;
    const ampm = localHr >= 12 ? "PM" : "AM";
    const expectedLocal = `${h12}:${String(localMin).padStart(2, "0")} ${ampm}`;

    // Always asserts local time format is shown
    expect(result).toContain(expectedLocal);

    // When the machine is not in UTC, also verify the UTC time is absent.
    // In UTC (offset=0) this guard is skipped because local===UTC,
    // so timezone correctness can only be fully validated on non-UTC CI.
    if (d.getTimezoneOffset() !== 0) {
      const utcHr = d.getUTCHours();
      const utcH12 = utcHr % 12 || 12;
      const utcAmpm = utcHr >= 12 ? "PM" : "AM";
      expect(result).not.toContain(`${utcH12}:${String(localMin).padStart(2, "0")} ${utcAmpm}`);
    }
  });

  it("uses local month/day for older date display", () => {
    const d = new Date("2026-01-15T12:00:00Z");
    const iso = d.toISOString();
    const result = formatCacheTimestamp(iso);

    // Compute expected local date using the same algorithm as the source
    const localMonth = d.getMonth();
    const localDay = d.getDate();
    const localStr = `${MONTH_NAMES[localMonth]} ${localDay},`;

    expect(result).toMatch(new RegExp(localStr));

    // When the machine is not in UTC, also verify UTC date is absent.
    if (d.getTimezoneOffset() !== 0) {
      const utcMonth = d.getUTCMonth();
      const utcDay = d.getUTCDate();
      const utcStr = `${MONTH_NAMES[utcMonth]} ${utcDay},`;
      if (localStr !== utcStr) {
        expect(result).not.toMatch(new RegExp(utcStr));
      }
    }
  });

  it("formats time in local timezone for yesterday dates", () => {
    const yesterday = new Date();
    yesterday.setUTCDate(new Date().getUTCDate() - 1);
    yesterday.setUTCHours(7, 30, 0, 0);
    const iso = yesterday.toISOString();
    const result = formatCacheTimestamp(iso);

    const localHr = yesterday.getHours();
    const localMin = yesterday.getMinutes();

    const h12 = localHr % 12 || 12;
    const ampm = localHr >= 12 ? "PM" : "AM";
    const expectedLocal = `${h12}:${String(localMin).padStart(2, "0")} ${ampm}`;

    expect(result).toMatch(/^Yesterday/);
    expect(result).toContain(expectedLocal);
  });
});
