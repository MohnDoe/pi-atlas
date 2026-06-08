import { describe, it, expect } from "vitest";
import { parseLine } from "./parser.js";
import type { DayAgg } from "./types.js";

function makeDayMap(): Map<string, DayAgg> {
  return new Map();
}

function newDayAgg(date: string): DayAgg {
  return {
    date,
    cost: 0, inTok: 0, outTok: 0, crTok: 0, cwTok: 0,
    userMsgs: 0, asstMsgs: 0, toolResults: 0,
    sessionIds: new Set(),
    langLines: {}, langEdits: {}, modelCost: {},
    modelCount: {}, projectCost: {},
    projectSessions: {}, toolCount: {},
  };
}

describe("parseLine", () => {
  it("parses a session entry and adds day to map", () => {
    const map = makeDayMap();
    const entry = {
      type: "session",
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
    parseLine({
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/proj",
    }, map);

    const entry = {
      type: "message",
      id: "msg-1",
      parentId: "prev",
      timestamp: "2026-06-08T10:05:00.000Z",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "hello" }],
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
    parseLine({
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/proj",
    }, map);

    parseLine({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: { role: "user", content: [{ type: "text", text: "hi" }] },
    }, map);

    expect(map.get("2026-06-08")!.userMsgs).toBe(1);
  });

  it("parses a tool result message", () => {
    const map = makeDayMap();
    parseLine({
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/proj",
    }, map);

    parseLine({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:02:00.000Z",
      message: { role: "toolResult", toolName: "bash", toolCallId: "c1", content: [] },
    }, map);

    expect(map.get("2026-06-08")!.toolResults).toBe(1);
    expect(map.get("2026-06-08")!.toolCount["bash"]).toBe(1);
  });
});
