import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, assert, beforeEach, describe, expect, it } from "vitest";
import { dateFromTimestamp, emptyDay, langFromPath, mergeDay, parseFile, parseSessionLogEntry, parseToolResultMessage, parseUserMessage, projectNameFromCwd } from "../parser";
import type { AssistantMessageBody, MessageEntry, SessionEntry, ToolResultMessageBody } from "../types";

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

describe("dateFromTimestamp", () => {
  it("extracts YYYY-MM-DD from ISO timestamp", () => {
    expect(dateFromTimestamp("2026-06-08T17:37:04.122Z")).toBe("2026-06-08");
  });

  it("works on date-only", () => {
    expect(dateFromTimestamp("2026-12-31")).toBe("2026-12-31");
  });
});

describe("emptyDay", () => {
  it("creates a zeroed DayAgg with the given date", () => {
    const day = emptyDay("2026-06-09");
    expect(day.date).toBe("2026-06-09");
    expect(day.cost).toBe(0);
    expect(day.inTok).toBe(0);
    expect(day.outTok).toBe(0);
    expect(day.crTok).toBe(0);
    expect(day.cwTok).toBe(0);
    expect(day.userMsgs).toBe(0);
    expect(day.asstMsgs).toBe(0);
    expect(day.toolResults).toBe(0);
    expect(day.sessionIds.size).toBe(0);
    expect(day.langLines).toEqual({});
    expect(day.langEdits).toEqual({});
    expect(day.modelCost).toEqual({});
    expect(day.modelCount).toEqual({});
    expect(day.projectCost).toEqual({});
    expect(day.projectSessions).toEqual({});
    expect(day.toolCount).toEqual({});
  });

  it("returns a new empty object each call", () => {
    const a = emptyDay("2026-06-09");
    const b = emptyDay("2026-06-09");
    expect(a).not.toBe(b);
    expect(a.langLines).not.toBe(b.langLines);
    expect(a.toolCount).not.toBe(b.toolCount);
  });
});

describe("parseUserMessage", () => {
  it("returns a DayAgg with userMsgs: 1", () => {
    const day = parseUserMessage();
    expect(day.userMsgs).toBe(1);
    expect(day.asstMsgs).toBe(0);
    expect(day.toolResults).toBe(0);
  });
});

describe("parseToolResultMessage", () => {
  it("counts one tool result and the tool name", () => {
    const msg: ToolResultMessageBody = {
      role: "toolResult",
      toolName: "bash",
      toolCallId: "c1",
    };
    const day = parseToolResultMessage(msg);
    expect(day.toolResults).toBe(1);
    expect(day.toolCount["bash"]).toBe(1);
  });

  it("handles missing toolName gracefully", () => {
    const msg: ToolResultMessageBody = {
      role: "toolResult",
      toolCallId: "c1",
    };
    const day = parseToolResultMessage(msg);
    expect(day.toolResults).toBe(1);
    expect(day.toolCount).toEqual({});
  });
});

describe("parseSessionLogEntry", () => {
  it("returns a DayAgg for a session entry", () => {
    const entry: SessionEntry = {
      type: "session",
      version: 3,
      id: "abc-123",
      timestamp: "2026-06-08T17:37:04.122Z",
      cwd: "/home/doe/Work/dev/pi-usage",
    };

    const dayAgg = parseSessionLogEntry(entry);

    assert(dayAgg);
    expect(dayAgg.date).toBe("2026-06-08");
    expect(dayAgg.sessionIds.has("abc-123")).toBe(true);
  });

  it("returns null/undefined for corrupt entries", () => {
    // @ts-expect-error: testing runtime resilience
    const nullDay = parseSessionLogEntry(null);
    expect(nullDay).toBeNull();
    // @ts-expect-error: testing runtime resilience
    const undefinedDay = parseSessionLogEntry(undefined);
    expect(undefinedDay).toBeNull();
  });

  it("returns a DayAgg for an assistant message with usage", () => {
    const msgEntry: MessageEntry = {
      type: "message",
      id: "msg-1",
      parentId: "prev",
      timestamp: "2026-06-08T10:05:00.000Z",
      message: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "hello" }],
        provider: "deepseek",
        model: "deepseek-v4-pro",
        usage: {
          input: 1000,
          output: 200,
          cacheRead: 100,
          cacheWrite: 0,
          totalTokens: 1300,
          cost: {
            input: 0.001,
            output: 0.0004,
            cacheRead: 0.00001,
            cacheWrite: 0,
            total: 0.00141,
          },
        },
        timestamp: 1700000000000,
      } as AssistantMessageBody,
    };

    const dayAgg = parseSessionLogEntry(msgEntry);

    assert(dayAgg);
    expect(dayAgg.cost).toBe(0.00141);
    expect(dayAgg.inTok).toBe(1000);
    expect(dayAgg.outTok).toBe(200);
    expect(dayAgg.crTok).toBe(100);
    expect(dayAgg.cwTok).toBe(0);
    expect(dayAgg.asstMsgs).toBe(1);
    expect(dayAgg.modelCost["deepseek-v4-pro"]).toBe(0.00141);
    expect(dayAgg.modelCount["deepseek-v4-pro"]).toBe(1);
  });

  it("returns a DayAgg for a user message", () => {
    const dayAgg = parseSessionLogEntry({
      type: "message" as const,
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] },
    })!;

    expect(dayAgg.userMsgs).toBe(1);
  });

  it("returns a DayAgg for a tool result message", () => {
    const dayAgg = parseSessionLogEntry({
      type: "message" as const,
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:02:00.000Z",
      message: { role: "toolResult" as const, toolName: "bash", toolCallId: "c1", content: [] },
    })!;

    expect(dayAgg.toolResults).toBe(1);
    expect(dayAgg.toolCount["bash"]).toBe(1);
  });

  it("detects languages from edit/write tool calls", () => {
    const dayAgg = parseSessionLogEntry({
      type: "message" as const,
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: {
        role: "assistant" as const,
        content: [
          {
            type: "toolCall" as const,
            id: "c1",
            name: "edit",
            arguments: {
              path: "/home/doe/proj/src/foo.ts",
              edits: [{ oldText: "a", newText: "ab" }],
            },
          },
          {
            type: "toolCall" as const,
            id: "c2",
            name: "write",
            arguments: { path: "/home/doe/proj/src/bar.rs", content: "fn main() {}" },
          },
          {
            type: "toolCall" as const,
            id: "c3",
            name: "read",
            arguments: { path: "/home/doe/proj/README.md" },
          },
        ],
        model: "sonnet",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      },
    })!;

    expect(dayAgg.langLines["TypeScript"]).toBe(2);
    expect(dayAgg.langEdits["TypeScript"]).toBe(1);
    expect(dayAgg.langLines["Rust"]).toBe(12);
    expect(dayAgg.langLines["Markdown"]).toBeUndefined();
  });

  it("extracts project name from session cwd", () => {
    const dayAgg = parseSessionLogEntry({
      type: "session" as const,
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/Work/dev/my-cool-project",
    })!;

    expect(dayAgg.projectCost["my-cool-project"]).toBe(0);

    assert(dayAgg.projectSessions["my-cool-project"]);
    expect(dayAgg.projectSessions["my-cool-project"].has("s1")).toBe(true);
  });

  it("accumulates project costs", () => {
    const session = parseSessionLogEntry({
      type: "session" as const,
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/proj",
    })!;

    expect(session.projectCost["proj"]).toBe(0);

    const dayAgg = parseSessionLogEntry({
      type: "message" as const,
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "ok" }],
        model: "gpt",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.05 },
        },
      },
    })!;

    mergeDay(session, dayAgg);
    expect(session.projectCost["proj"]).toBe(0.05);
  });

  it("counts tool calls from assistant content", () => {
    const dayAgg = parseSessionLogEntry({
      type: "message" as const,
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: {
        role: "assistant" as const,
        content: [
          { type: "toolCall" as const, id: "c1", name: "bash", arguments: { command: "ls" } },
          { type: "toolCall" as const, id: "c2", name: "read", arguments: { path: "f" } },
          { type: "toolCall" as const, id: "c3", name: "read", arguments: { path: "g" } },
        ],
        model: "m",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      },
    })!;

    expect(dayAgg.toolCount["bash"]).toBe(1);
    expect(dayAgg.toolCount["read"]).toBe(2);
  });

  it("handles missing usage gracefully", () => {
    const session = parseSessionLogEntry({
      type: "session" as const,
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/proj",
    })!;

    const day = parseSessionLogEntry({
      type: "message" as const,
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "hi" }],
        model: "m",
      },
    })!;

    mergeDay(session, day);
    expect(session.asstMsgs).toBe(1);
    expect(session.cost).toBe(0);
    expect(session.inTok).toBe(0);
  });

  it("handles session entry without cwd", () => {
    const day = parseSessionLogEntry({
      type: "session" as const,
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
    })!;

    expect(day.date).toBe("2026-06-08");
    expect(day.sessionIds.has("s1")).toBe(true);
    expect(Object.keys(day.projectCost).length).toBe(0);
    expect(Object.keys(day.projectSessions).length).toBe(0);
  });

  it("handles assistant message with model but no cost", () => {
    const day = parseSessionLogEntry({
      type: "message" as const,
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: {
        role: "assistant" as const,
        content: [{ type: "text" as const, text: "hi" }],
        model: "deepseek-v4",
        usage: {
          input: 100,
          output: 50,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 150,
        },
      },
    })!;

    expect(day.asstMsgs).toBe(1);
    expect(day.inTok).toBe(100);
    expect(day.outTok).toBe(50);
    expect(day.cost).toBe(0);
    expect(day.modelCost).toEqual({});
    expect(day.modelCount).toEqual({});
  });

  it("parses unknown file extensions as 'Other'", () => {
    const session = parseSessionLogEntry({
      type: "session" as const,
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/proj",
    })!;

    const day = parseSessionLogEntry({
      type: "message" as const,
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: {
        role: "assistant" as const,
        content: [
          {
            type: "toolCall" as const,
            id: "c1",
            name: "write",
            arguments: { path: "/x/config.xyz", content: "abc" },
          },
        ],
        model: "m",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      },
    })!;

    mergeDay(session, day);
    expect(session.langLines["Other"]).toBe(3);
  });
});

describe("mergeDay", () => {
  it("sums scalar fields across two DayAggs", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      cost: 1,
      inTok: 100,
      outTok: 50,
      userMsgs: 2,
      asstMsgs: 3,
      toolResults: 1,
    };

    mergeDay(a, b);
    expect(a.cost).toBe(1);
    expect(a.inTok).toBe(100);
    expect(a.outTok).toBe(50);
    expect(a.userMsgs).toBe(2);
    expect(a.asstMsgs).toBe(3);
    expect(a.toolResults).toBe(1);
  });

  it("merges session id sets", () => {
    const a = emptyDay("2026-06-08");
    const b = emptyDay("2026-06-08");
    b.sessionIds.add("s1");
    b.sessionIds.add("s2");

    mergeDay(a, b);
    expect(a.sessionIds.has("s1")).toBe(true);
    expect(a.sessionIds.has("s2")).toBe(true);
  });

  it("merges record accumulators", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      langLines: { TypeScript: 10, Rust: 5 },
      toolCount: { bash: 2, edit: 1 },
    };

    mergeDay(a, b);
    expect(a.langLines).toEqual({ TypeScript: 10, Rust: 5 });
    expect(a.toolCount).toEqual({ bash: 2, edit: 1 });
  });

  it("sums record values from multiple merges", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      langLines: { TypeScript: 10 },
      toolCount: { bash: 2 },
    };
    const c: DayAgg = {
      ...emptyDay("2026-06-08"),
      langLines: { TypeScript: 20, Rust: 5 },
      toolCount: { edit: 1 },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.langLines).toEqual({ TypeScript: 30, Rust: 5 });
    expect(a.toolCount).toEqual({ bash: 2, edit: 1 });
  });

  it("merges project sessions sets", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      projectSessions: { proj1: new Set(["s1", "s2"]) },
    };

    mergeDay(a, b);
    expect(a.projectSessions["proj1"]?.has("s1")).toBe(true);
    expect(a.projectSessions["proj1"]?.has("s2")).toBe(true);
  });

  it("sums crTok and cwTok", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      crTok: 100,
      cwTok: 200,
    };

    mergeDay(a, b);
    expect(a.crTok).toBe(100);
    expect(a.cwTok).toBe(200);
  });

  it("merges model cost and count records", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      modelCost: { "deepseek-v4": 0.05, "gpt-5": 0.10 },
      modelCount: { "deepseek-v4": 3, "gpt-5": 1 },
    };
    const c: DayAgg = {
      ...emptyDay("2026-06-08"),
      modelCost: { "deepseek-v4": 0.03 },
      modelCount: { "deepseek-v4": 2 },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.modelCost).toEqual({ "deepseek-v4": 0.08, "gpt-5": 0.10 });
    expect(a.modelCount).toEqual({ "deepseek-v4": 5, "gpt-5": 1 });
  });

  it("merges projectCost records", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      projectCost: { alpha: 1.5, beta: 2.0 },
    };
    const c: DayAgg = {
      ...emptyDay("2026-06-08"),
      projectCost: { alpha: 0.5, gamma: 3.0 },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.projectCost).toEqual({ alpha: 2.0, beta: 2.0, gamma: 3.0 });
  });
});

describe("parseFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-usage-parser-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("parses a JSONL file into a day map", async () => {
    const filePath = join(tmpDir, "test.jsonl");
    const lines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      }),
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:01:00.000Z",
        message: { role: "user", content: [{ type: "text", text: "hi" }] },
      }),
      "invalid json {broken",
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-08T10:02:00.000Z",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "hey" }],
          model: "m",
          usage: {
            input: 100,
            output: 50,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 150,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 },
          },
        },
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    let warnings = 0;
    const map = parseFile(filePath, (count) => {
      warnings = count;
    });

    expect(map.size).toBe(1);
    const day = map.get("2026-06-08")!;
    expect(day.userMsgs).toBe(1);
    expect(day.asstMsgs).toBe(1);
    expect(day.cost).toBe(0.01);
    expect(warnings).toBe(1);
  });

  it("returns empty map for empty file", async () => {
    const filePath = join(tmpDir, "empty.jsonl");
    await writeFile(filePath, "");
    const map = parseFile(filePath);
    expect(map.size).toBe(0);
  });

  it("silently returns empty map for non-existent file", async () => {
    const map = parseFile("/nonexistent/path/never.jsonl");
    expect(map.size).toBe(0);
  });

  it("splits entries across multiple dates into separate day buckets", async () => {
    const filePath = join(tmpDir, "multi-date.jsonl");
    const lines = [
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:00:00.000Z",
        message: { role: "user", content: [{ type: "text", text: "hi" }] },
      }),
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-09T10:00:00.000Z",
        message: { role: "user", content: [{ type: "text", text: "bye" }] },
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    const map = parseFile(filePath);

    expect(map.size).toBe(2);
    expect(map.get("2026-06-08")?.userMsgs).toBe(1);
    expect(map.get("2026-06-09")?.userMsgs).toBe(1);
  });

  it("handles missing onWarning callback gracefully", async () => {
    const filePath = join(tmpDir, "corrupt.jsonl");
    const lines = [
      "not valid json",
      "still not json",
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:00:00.000Z",
        message: { role: "user", content: [{ type: "text", text: "ok" }] },
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    const map = parseFile(filePath);

    expect(map.size).toBe(1);
    expect(map.get("2026-06-08")?.userMsgs).toBe(1);
  });
});
