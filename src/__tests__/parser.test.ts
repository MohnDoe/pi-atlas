import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseFile, parseLine } from "../parser.js";
import type { DayAgg } from "../types.js";

function makeDayMap(): Map<string, DayAgg> {
  return new Map();
}

function newDayAgg(date: string): DayAgg {
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

describe("parseLine", () => {
  it("parses a session entry and adds day to map", () => {
    const map = makeDayMap();
    const entry = {
      type: "session" as const,
      version: 3,
      id: "abc-123",
      timestamp: "2026-06-08T17:37:04.122Z",
      cwd: "/home/doe/Work/dev/pi-usage",
    };

    parseLine(entry, map);

    expect(map.size).toBe(1);
    const day = map.get("2026-06-08")!;
    expect(day).toBeDefined();
    expect(day.date).toBe("2026-06-08");
    expect(day.sessionIds.has("abc-123")).toBe(true);
  });

  it("parses an assistant message with usage", () => {
    const map = makeDayMap();
    // seed the day first via session entry
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      } as const,
      map,
    );

    const entry = {
      type: "message" as const,
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
      },
    };

    parseLine(entry, map);

    const day = map.get("2026-06-08")!;
    expect(day.cost).toBe(0.00141);
    expect(day.inTok).toBe(1000);
    expect(day.outTok).toBe(200);
    expect(day.crTok).toBe(100);
    expect(day.cwTok).toBe(0);
    expect(day.asstMsgs).toBe(1);

    // model stats
    expect(day.modelCost["deepseek-v4-pro"]).toBe(0.00141);
    expect(day.modelCount["deepseek-v4-pro"]).toBe(1);
  });

  it("parses a user message", () => {
    const map = makeDayMap();
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      } as const,
      map,
    );

    parseLine(
      {
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:01:00.000Z",
        message: { role: "user" as const, content: [{ type: "text" as const, text: "hi" }] },
      } as const,
      map,
    );

    expect(map.get("2026-06-08")!.userMsgs).toBe(1);
  });

  it("parses a tool result message", () => {
    const map = makeDayMap();
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      } as const,
      map,
    );

    parseLine(
      {
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:02:00.000Z",
        message: { role: "toolResult" as const, toolName: "bash", toolCallId: "c1", content: [] },
      } as const,
      map,
    );

    expect(map.get("2026-06-08")!.toolResults).toBe(1);
    expect(map.get("2026-06-08")!.toolCount["bash"]).toBe(1);
  });

  it("detects languages from edit/write tool calls in assistant messages", () => {
    const map = makeDayMap();
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      } as const,
      map,
    );

    parseLine(
      {
        type: "message",
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
      } as const,
      map,
    );

    const day = map.get("2026-06-08")!;
    // edit: foo.ts => TypeScript, 2 new chars in the edit
    expect(day.langLines["TypeScript"]).toBe(2);
    expect(day.langEdits["TypeScript"]).toBe(1);
    // write: bar.rs => Rust, full content length
    expect(day.langLines["Rust"]).toBe(12); // "fn main() {}"
    // read doesn't count
    expect(day.langLines["Markdown"]).toBeUndefined();
  });

  it("extracts project name from session cwd", () => {
    const map = makeDayMap();
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/Work/dev/my-cool-project",
      } as const,
      map,
    );

    const day = map.get("2026-06-08")!;
    expect(day.projectCost["my-cool-project"]).toBe(0);
    expect(day.projectSessions["my-cool-project"]).toBeDefined();
    expect(day.projectSessions["my-cool-project"].has("s1")).toBe(true);
  });

  it("attributes cost to project from session cwd", () => {
    const map = makeDayMap();
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      } as const,
      map,
    );

    parseLine(
      {
        type: "message",
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
      } as const,
      map,
    );

    const day = map.get("2026-06-08")!;
    expect(day.projectCost["proj"]).toBe(0.05);
  });

  it("counts tool calls from assistant content", () => {
    const map = makeDayMap();
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      } as const,
      map,
    );

    parseLine(
      {
        type: "message",
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
      } as const,
      map,
    );

    const day = map.get("2026-06-08")!;
    expect(day.toolCount["bash"]).toBe(1);
    expect(day.toolCount["read"]).toBe(2);
  });

  it("skips corrupt lines gracefully", () => {
    const map = makeDayMap();

    // entries without type should be skipped — these are runtime rejects, not type errors
    // @ts-expect-error: testing runtime resilience with invalid data
    parseLine(null, map);
    // @ts-expect-error: testing runtime resilience with invalid data
    parseLine(undefined, map);

    // days should be empty
    expect(map.size).toBe(0);
  });

  it("handles missing usage gracefully", () => {
    const map = makeDayMap();
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      } as const,
      map,
    );

    // assistant without usage
    parseLine(
      {
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:01:00.000Z",
        message: {
          role: "assistant" as const,
          content: [{ type: "text" as const, text: "hi" }],
          model: "m",
        },
      } as const,
      map,
    );

    const day = map.get("2026-06-08")!;
    expect(day.asstMsgs).toBe(1);
    expect(day.cost).toBe(0);
    expect(day.inTok).toBe(0);
  });

  it("parses unknown file extensions as 'Other'", () => {
    const map = makeDayMap();
    parseLine(
      {
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      } as const,
      map,
    );

    parseLine(
      {
        type: "message",
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
      } as const,
      map,
    );

    const day = map.get("2026-06-08")!;
    expect(day.langLines["Other"]).toBe(3);
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

    const map = makeDayMap();
    let warnings = 0;
    parseFile(filePath, map, (count) => {
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
    const map = makeDayMap();
    parseFile(filePath, map);
    expect(map.size).toBe(0);
  });
});
