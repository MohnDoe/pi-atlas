import type {
  AssistantMessage as PiAssistantMessage,
  ToolResultMessage as PiToolResultMessage,
  ToolCall,
} from "@earendil-works/pi-ai";
import type {
  CompactionEntry,
  ModelChangeEntry,
  SessionHeader,
  SessionMessageEntry,
  ThinkingLevelChangeEntry,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  emptyDay,
  mergeDay,
  parseAssistantMessage,
  parseCompactionEntry,
  parseFile,
  fileModelToProvider,
  parseLanguageUsage,
  parseModelChangeEntry,
  parseSessionHeader,
  parseSessionLogEntry,
  parseThinkingLevelChangeEntry,
  parseToolResultMessage,
  parseUserMessage,
  sessionProjectMap,
} from "./parser";
import type { DayAgg } from "./types";

// Helper: minimal AssistantMessage with required fields
function mkAsst(msg: {
  content?: PiAssistantMessage["content"];
  model?: string;
  provider?: string;
  usage?: PiAssistantMessage["usage"];
}): PiAssistantMessage {
  return {
    role: "assistant",
    content: msg.content ?? [],
    api: "anthropic-messages",
    provider: msg.provider ?? "deepseek",
    model: msg.model ?? "deepseek-v4-pro",
    usage: msg.usage ?? {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: "stop",
    timestamp: 1700000000000,
  };
}

// Helper: minimal ToolResultMessage with required fields
function mkToolResult(msg: {
  toolName?: string;
  toolCallId?: string;
  content?: PiToolResultMessage["content"];
}): PiToolResultMessage {
  return {
    role: "toolResult",
    toolName: msg.toolName ?? "bash",
    toolCallId: msg.toolCallId ?? "c1",
    content: msg.content ?? [],
    isError: false,
    timestamp: 1700000000000,
  };
}

// Helper: minimal ToolCall block
function tc(name: string, args?: Record<string, unknown>): ToolCall {
  return { type: "toolCall", id: "c1", name, arguments: args ?? {} };
}

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
    expect(day.compactionCount).toBe(0);
    expect(day.compactedTokens).toBe(0);
    expect(day.modelChanges).toBe(0);
    expect(day.thinkingLevelCount).toEqual({});
    expect(day.hourCost).toEqual({});
  });

  it("returns a new empty object each call", () => {
    const a = emptyDay("2026-06-09");
    const b = emptyDay("2026-06-09");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
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
    const msg = mkToolResult({ toolName: "bash" });
    const day = parseToolResultMessage(msg);
    expect(day.toolResults).toBe(1);
    expect(day.toolCount["bash"]).toBe(1);
  });

  it("handles missing toolName gracefully", () => {
    const msg = mkToolResult({ toolName: "" });
    const day = parseToolResultMessage(msg);
    expect(day.toolResults).toBe(1);
    expect(day.toolCount).toEqual({});
  });

  it("strips control characters from toolName", () => {
    const msg = mkToolResult({ toolName: "ls -la agent/\n</parameter" });
    const day = parseToolResultMessage(msg);
    expect(day.toolResults).toBe(1);
    expect(Object.keys(day.toolCount)[0]).toBe("ls -la agent/</parameter");
    expect(day.toolCount["ls -la agent/</parameter"]).toBe(1);
  });

  it("strips various control characters from toolName", () => {
    const msg = mkToolResult({ toolName: "test\r\t\0\u200Btool" });
    const day = parseToolResultMessage(msg);
    expect(day.toolCount["testtool"]).toBe(1);
  });
});

describe("parseLanguageUsage", () => {
  it("counts edits correctly", () => {
    const day = parseLanguageUsage("edit", {
      path: "/src/foo.ts",
      edits: [
        { oldText: "x", newText: "abc" },
        { oldText: "y", newText: "defg" },
      ],
    });
    expect(day.langEdits["TypeScript"]).toBe(2);
    expect(day.langLines["TypeScript"]).toBe(2);
  });

  it("counts write call correctly", () => {
    const day = parseLanguageUsage("write", {
      path: "/src/lib.rs",
      content: "fn main() {}",
    });
    expect(day.langLines["Rust"]).toBe(1);
    expect(day.langEdits["Rust"]).toBeUndefined();
  });

  it("treats edits with no newText as a line", () => {
    const day = parseLanguageUsage("edit", {
      path: "/src/foo.ts",
      edits: [{ oldText: "x" }],
    });
    expect(day.langLines["TypeScript"]).toBe(1);
    expect(day.langEdits["TypeScript"]).toBe(1);
  });

  it("handles non-array (string) edits gracefully", () => {
    const day = parseLanguageUsage("edit", {
      path: "/src/foo.ts",
      edits: "not-an-array",
    });
    expect(day.langLines["TypeScript"]).toBe(1);
    expect(day.langEdits["TypeScript"]).toBe(1);
  });

  it("handles edits set undefined gracefully", () => {
    const day = parseLanguageUsage("edit", {
      path: "/src/foo.ts",
      edits: undefined,
    });
    expect(day.langLines["TypeScript"]).toBe(1);
    expect(day.langEdits["TypeScript"]).toBe(1);
  });

  it("handles edits set to null gracefully", () => {
    const day = parseLanguageUsage("edit", {
      path: "/src/foo.ts",
      edits: null,
    });
    expect(day.langLines["TypeScript"]).toBe(1);
    expect(day.langEdits["TypeScript"]).toBe(1);
  });

  it("handles missing content in write gracefully", () => {
    const day = parseLanguageUsage("write", { path: "/src/foo.py" });
    expect(day.langLines["Python"]).toBe(1);
  });

  it("returns empty day when path is missing", () => {
    const day = parseLanguageUsage("write", {});
    expect(day.langLines).toEqual({});
    expect(day.langEdits).toEqual({});
  });

  it("returns empty day when args is undefined", () => {
    const day = parseLanguageUsage("edit", undefined);
    expect(day.langLines).toEqual({});
    expect(day.langEdits).toEqual({});
  });

  it("parses unknown file extensions as 'Other'", () => {
    const day = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: mkAsst({
        content: [tc("write", { path: "/x/config.xyz", content: "abc" })],
        model: "m",
      }),
    })!;

    expect(day.langLines["Other"]).toBe(1);
  });

  it("counts multiline write content correctly", () => {
    const day = parseLanguageUsage("write", {
      path: "/src/foo.py",
      content: "line1\nline2\nline3",
    });
    expect(day.langLines["Python"]).toBe(3);
  });
});

describe("parseAssistantMessage", () => {
  it("counts one assistant message and usage tokens", () => {
    const msg = mkAsst({
      content: [{ type: "text", text: "hello" }],
      usage: {
        input: 100,
        output: 50,
        cacheRead: 10,
        cacheWrite: 5,
        totalTokens: 165,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.asstMsgs).toBe(1);
    expect(day.inTok).toBe(100);
    expect(day.outTok).toBe(50);
    expect(day.crTok).toBe(10);
    expect(day.cwTok).toBe(5);
  });

  it("records model cost and count when both model and cost present", () => {
    const msg = mkAsst({
      model: "deepseek-v4-pro",
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.cost).toBe(0.003);
    expect(day.modelCost["deepseek-v4-pro"]).toBe(0.003);
    expect(day.modelCount["deepseek-v4-pro"]).toBe(1);
  });

  it("skips model cost when model is missing", () => {
    const msg = mkAsst({
      model: "",
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.modelCost).toEqual({});
    expect(day.modelCount).toEqual({});
  });

  it("counts tool calls from content blocks", () => {
    const msg = mkAsst({
      content: [
        tc("read", { path: "/f" }),
        { ...tc("bash", { command: "ls" }), id: "c2" },
        { ...tc("read", { path: "/g" }), id: "c3" },
      ],
    });
    const day = parseAssistantMessage(msg);
    expect(day.toolCount["read"]).toBe(2);
    expect(day.toolCount["bash"]).toBe(1);
  });

  it("strips control characters from tool call names", () => {
    const msg = mkAsst({
      content: [tc("ls -la agent/\n</parameter", { command: "ls -la agent/" })],
    });
    const day = parseAssistantMessage(msg);
    expect(day.toolCount["ls -la agent/</parameter"]).toBe(1);
    expect(day.toolCount["ls -la agent/\n</parameter"]).toBeUndefined();
  });

  it("detects language from edit/write tool calls", () => {
    const msg = mkAsst({
      content: [
        tc("edit", { path: "/src/foo.ts", edits: [{ newText: "abc" }] }),
        { ...tc("write", { path: "/src/bar.rs", content: "fn main() {}" }), id: "c2" },
      ],
    });
    const day = parseAssistantMessage(msg);
    expect(day.langLines["TypeScript"]).toBe(1);
    expect(day.langEdits["TypeScript"]).toBe(1);
    expect(day.langLines["Rust"]).toBe(1);
  });

  it("attributes cost to projects in sessionProject", () => {
    sessionProjectMap.clear();
    sessionProjectMap.set("s1", "alpha");
    sessionProjectMap.set("s2", "beta");

    const msg = mkAsst({
      content: [{ type: "text", text: "ok" }],
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.05 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.projectCost["alpha"]).toBe(0.05);
    expect(day.projectCost["beta"]).toBe(0.05);
  });

  it("handles zero-cost usage gracefully", () => {
    const msg = mkAsst({
      content: [{ type: "text", text: "hi" }],
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.asstMsgs).toBe(1);
    expect(day.inTok).toBe(0);
    expect(day.cost).toBe(0);
  });

  it("handles missing usage gracefully", () => {
    const msg = mkAsst({
      content: [{ type: "text", text: "hi" }],
    });
    const day = parseAssistantMessage(msg);
    expect(day.asstMsgs).toBe(1);
    expect(day.inTok).toBe(0);
    expect(day.cost).toBe(0);
  });

  it("handles missing content gracefully", () => {
    const msg = mkAsst({
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.asstMsgs).toBe(1);
    expect(day.toolCount).toEqual({});
  });

  it("parses JSON-string toolCall arguments", () => {
    const msg = mkAsst({
      content: [
        {
          type: "toolCall" as const,
          id: "c1",
          name: "edit",
          //@ts-expect-error
          arguments: JSON.stringify({ path: "/src/foo.ts", edits: [{ newText: "abc" }] }),
        },
      ],
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.toolCount["edit"]).toBe(1);
    expect(day.langLines["TypeScript"]).toBe(1);
    expect(day.langEdits["TypeScript"]).toBe(1);
  });

  it("handles toolCall with undefined arguments", () => {
    const msg = mkAsst({
      //@ts-expect-error
      content: [{ type: "toolCall" as const, id: "c1", name: "read" }],
    });
    const day = parseAssistantMessage(msg);
    expect(day.toolCount["read"]).toBe(1);
  });

  it("records model count but not provider when provider is empty", () => {
    const msg = mkAsst({
      model: "gpt-5",
      provider: "",
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.003 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.modelCost["gpt-5"]).toBe(0.003);
    expect(day.modelCount["gpt-5"]).toBe(1);
    expect(day.providerCost).toEqual({});
    expect(day.providerCount).toEqual({});
  });

  it("records provider cost, count, and model mapping", () => {
    const msg = mkAsst({
      model: "deepseek-v4-pro",
      provider: "deepseek",
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
      },
    });
    fileModelToProvider.clear();
    const day = parseAssistantMessage(msg);
    expect(day.providerCost["deepseek"]).toBe(0.003);
    expect(day.providerCount["deepseek"]).toBe(1);
    expect(fileModelToProvider.get("deepseek-v4-pro")).toBe("deepseek");
  });
});

describe("parseSessionHeader", () => {
  it("creates a DayAgg with session id and date", () => {
    sessionProjectMap.clear();
    const entry: SessionHeader = {
      type: "session",
      version: 3,
      id: "abc-123",
      timestamp: "2026-06-09T10:00:00.000Z",
      cwd: "/home/doe",
    };
    const day = parseSessionHeader(entry);
    expect(day.date).toBe("2026-06-09");
    expect(day.sessionIds.has("abc-123")).toBe(true);
  });

  it("registers project from cwd in sessionProject", () => {
    sessionProjectMap.clear();
    const entry: SessionHeader = {
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-09T10:00:00.000Z",
      cwd: "/home/doe/dev/my-app",
    };
    const day = parseSessionHeader(entry);
    expect(sessionProjectMap.get("s1")).toBe("my-app");
    expect(day.projectCost["my-app"]).toBe(0);
    expect(day.projectSessions["my-app"]?.has("s1")).toBe(true);
  });

  it("handles empty cwd gracefully", () => {
    sessionProjectMap.clear();
    const entry: SessionHeader = {
      type: "session",
      version: 3,
      id: "s2",
      timestamp: "2026-06-09T10:00:00.000Z",
      cwd: "",
    };
    const day = parseSessionHeader(entry);
    expect(sessionProjectMap.has("s2")).toBe(false);
    expect(day.projectCost).toEqual({});
    expect(day.projectSessions).toEqual({});
  });
});

describe("parseModelChangeEntry", () => {
  it("increments modelChanges", () => {
    const entry: ModelChangeEntry = {
      type: "model_change",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-09T10:00:00.000Z",
      provider: "deepseek",
      modelId: "deepseek-v4-pro",
    };
    const day = parseModelChangeEntry(entry);
    expect(day.date).toBe("2026-06-09");
    expect(day.modelChanges).toBe(1);
    expect(day.cost).toBe(0);
  });
});

describe("parseThinkingLevelChangeEntry", () => {
  it("counts one thinking level change", () => {
    const entry: ThinkingLevelChangeEntry = {
      type: "thinking_level_change",
      id: "t1",
      parentId: "p",
      timestamp: "2026-06-09T10:00:00.000Z",
      thinkingLevel: "high",
    };
    const day = parseThinkingLevelChangeEntry(entry);
    expect(day.date).toBe("2026-06-09");
    expect(day.thinkingLevelCount).toEqual({ high: 1 });
  });

  it("counts different thinking levels separately", () => {
    const low: ThinkingLevelChangeEntry = {
      type: "thinking_level_change",
      id: "t1",
      parentId: "p",
      timestamp: "2026-06-09T10:00:00.000Z",
      thinkingLevel: "low",
    };
    const high: ThinkingLevelChangeEntry = {
      type: "thinking_level_change",
      id: "t2",
      parentId: "t1",
      timestamp: "2026-06-09T10:01:00.000Z",
      thinkingLevel: "high",
    };

    const base = emptyDay("2026-06-09");
    mergeDay(base, parseThinkingLevelChangeEntry(low));
    mergeDay(base, parseThinkingLevelChangeEntry(high));
    expect(base.thinkingLevelCount).toEqual({ low: 1, high: 1 });
  });
});

describe("parseCompactionEntry", () => {
  it("increments compactionCount and sums tokensBefore", () => {
    const entry: CompactionEntry = {
      type: "compaction",
      id: "c1",
      parentId: "p",
      timestamp: "2026-06-09T10:00:00.000Z",
      summary: "Some summary",
      firstKeptEntryId: "m1",
      tokensBefore: 50000,
    };
    const day = parseCompactionEntry(entry);
    expect(day.date).toBe("2026-06-09");
    expect(day.compactionCount).toBe(1);
    expect(day.compactedTokens).toBe(50000);
  });
});

describe("parseSessionLogEntry", () => {
  it("returns a DayAgg for a session entry", () => {
    const entry: SessionHeader = {
      type: "session",
      version: 3,
      id: "abc-123",
      timestamp: "2026-06-08T17:37:04.122Z",
      cwd: "/home/doe/dev/pi-atlas",
    };

    const dayAgg = parseSessionLogEntry(entry)!;

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
    const msgEntry: SessionMessageEntry = {
      type: "message",
      id: "msg-1",
      parentId: "prev",
      timestamp: "2026-06-08T10:05:00.000Z",
      message: mkAsst({
        content: [{ type: "text", text: "hello" }],
        provider: "deepseek",
        model: "deepseek-v4-pro",
        usage: {
          input: 1000,
          output: 200,
          cacheRead: 100,
          cacheWrite: 0,
          totalTokens: 1300,
          cost: { input: 0.001, output: 0.0004, cacheRead: 0.00001, cacheWrite: 0, total: 0.00141 },
        },
      }),
    };

    fileModelToProvider.clear();
    const dayAgg = parseSessionLogEntry(msgEntry)!;

    expect(dayAgg.cost).toBe(0.00141);
    expect(dayAgg.inTok).toBe(1000);
    expect(dayAgg.outTok).toBe(200);
    expect(dayAgg.crTok).toBe(100);
    expect(dayAgg.cwTok).toBe(0);
    expect(dayAgg.asstMsgs).toBe(1);
    expect(dayAgg.modelCost["deepseek-v4-pro"]).toBe(0.00141);
    expect(dayAgg.modelCount["deepseek-v4-pro"]).toBe(1);
    expect(dayAgg.providerCost["deepseek"]).toBe(0.00141);
    expect(dayAgg.providerCount["deepseek"]).toBe(1);
    expect(fileModelToProvider.get("deepseek-v4-pro")).toBe("deepseek");
    const localHour = new Date("2026-06-08T10:05:00.000Z").getHours();
    expect(dayAgg.hourCost[localHour]).toBe(0.00141);
  });

  it("returns a DayAgg for a user message", () => {
    const dayAgg = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: { role: "user" as const, content: "hi", timestamp: 1700000000000 },
    })!;

    expect(dayAgg.userMsgs).toBe(1);
    expect(dayAgg.date).toBe("2026-06-08");
    // No cost => hourCost not incremented
    expect(dayAgg.hourCost).toEqual({});
  });

  it("returns a DayAgg for a tool result message", () => {
    const dayAgg = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:02:00.000Z",
      message: mkToolResult({ toolName: "bash" }),
    })!;

    expect(dayAgg.toolResults).toBe(1);
    expect(dayAgg.toolCount["bash"]).toBe(1);
    expect(dayAgg.date).toBe("2026-06-08");
    expect(dayAgg.hourCost).toEqual({});
  });

  it("detects languages from edit/write tool calls", () => {
    const dayAgg = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: mkAsst({
        content: [
          tc("edit", {
            path: "/home/doe/proj/src/foo.ts",
            edits: [{ oldText: "a", newText: "ab" }],
          }),
          {
            ...tc("write", { path: "/home/doe/proj/src/bar.rs", content: "fn main() {}" }),
            id: "c2",
          },
          { ...tc("read", { path: "/home/doe/proj/README.md" }), id: "c3" },
        ],
        model: "sonnet",
      }),
    })!;

    expect(dayAgg.langLines["TypeScript"]).toBe(1);
    expect(dayAgg.langEdits["TypeScript"]).toBe(1);
    expect(dayAgg.langLines["Rust"]).toBe(1);
    expect(dayAgg.langLines["Markdown"]).toBeUndefined();
  });

  it("extracts project name from session cwd", () => {
    const dayAgg = parseSessionLogEntry({
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/dev/my-cool-project",
    })!;

    expect(dayAgg.projectCost["my-cool-project"]).toBe(0);

    expect(dayAgg.projectSessions["my-cool-project"]).toBeDefined();
    expect(dayAgg.projectSessions["my-cool-project"]!.has("s1")).toBe(true);
  });

  it("accumulates project costs", () => {
    const session = parseSessionLogEntry({
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "/home/doe/proj",
    })!;

    expect(session.projectCost["proj"]).toBe(0);

    const dayAgg = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: mkAsst({
        content: [{ type: "text", text: "ok" }],
        model: "gpt",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.05 },
        },
      }),
    })!;

    mergeDay(session, dayAgg);
    expect(session.projectCost["proj"]).toBe(0.05);
  });

  it("counts tool calls from assistant content", () => {
    const dayAgg = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: mkAsst({
        content: [
          tc("bash", { command: "ls" }),
          { ...tc("read", { path: "f" }), id: "c2" },
          { ...tc("read", { path: "g" }), id: "c3" },
        ],
      }),
    })!;

    expect(dayAgg.toolCount["bash"]).toBe(1);
    expect(dayAgg.toolCount["read"]).toBe(2);
  });

  it("handles session entry with empty cwd", () => {
    const day = parseSessionLogEntry({
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "",
    })!;

    expect(day.date).toBe("2026-06-08");
    expect(day.sessionIds.has("s1")).toBe(true);
    expect(Object.keys(day.projectCost).length).toBe(0);
    expect(Object.keys(day.projectSessions).length).toBe(0);
  });

  it("counts model usage whith zero-cost usage", () => {
    const day = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: mkAsst({
        content: [{ type: "text", text: "hi" }],
        model: "deepseek-v4",
        usage: {
          input: 100,
          output: 50,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 150,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      }),
    })!;

    expect(day.asstMsgs).toBe(1);
    expect(day.modelCost).toEqual({ "deepseek-v4": 0 });
    expect(day.modelCount).toEqual({ "deepseek-v4": 1 });
  });

  it("returns null for unknown entry types", () => {
    expect(
      parseSessionLogEntry({
        type: "branch_summary",
        id: "b1",
        parentId: "p",
        timestamp: "2026-06-08T10:00:00.000Z",
        fromId: "m1",
        summary: "branch",
      }),
    ).toBeNull();

    expect(
      parseSessionLogEntry({
        type: "custom",
        id: "c1",
        parentId: "p",
        timestamp: "2026-06-08T10:00:00.000Z",
        customType: "my-ext",
      }),
    ).toBeNull();

    expect(
      parseSessionLogEntry({
        type: "label",
        id: "l1",
        parentId: "p",
        timestamp: "2026-06-08T10:00:00.000Z",
        targetId: "t1",
        label: "checkpoint",
      }),
    ).toBeNull();
  });

  it("handles compaction entries", () => {
    const day = parseSessionLogEntry({
      type: "compaction",
      id: "c1",
      parentId: "p",
      timestamp: "2026-06-08T10:00:00.000Z",
      summary: "Summary",
      firstKeptEntryId: "m1",
      tokensBefore: 42000,
    })!;

    expect(day.compactionCount).toBe(1);
    expect(day.compactedTokens).toBe(42000);
  });

  it("handles model_change entries", () => {
    const day = parseSessionLogEntry({
      type: "model_change",
      id: "mc1",
      parentId: "p",
      timestamp: "2026-06-08T10:00:00.000Z",
      provider: "openai",
      modelId: "gpt-5",
    })!;

    expect(day.modelChanges).toBe(1);
  });

  it("handles thinking_level_change entries", () => {
    const day = parseSessionLogEntry({
      type: "thinking_level_change",
      id: "t1",
      parentId: "p",
      timestamp: "2026-06-08T10:00:00.000Z",
      thinkingLevel: "xhigh",
    })!;

    expect(day.thinkingLevelCount).toEqual({ xhigh: 1 });
  });

  it("returns null for custom_message type", () => {
    expect(
      parseSessionLogEntry({
        type: "custom_message",
        id: "cm1",
        parentId: "p",
        timestamp: "2026-06-08T10:00:00.000Z",
        //@ts-expect-error
        contentType: "my-type",
        message: "hi",
      }),
    ).toBeNull();
  });

  it("returns null for session_info type", () => {
    expect(
      parseSessionLogEntry({
        type: "session_info",
        id: "si1",
        parentId: "p",
        timestamp: "2026-06-08T10:00:00.000Z",
        //@ts-expect-error
        totalTokens: 100,
      }),
    ).toBeNull();
  });

  it("returns null for non-object entry types", () => {
    // @ts-expect-error: testing runtime resilience
    expect(parseSessionLogEntry("corrupt")).toBeNull();
    // @ts-expect-error: testing runtime resilience
    expect(parseSessionLogEntry(42)).toBeNull();
    // @ts-expect-error: testing runtime resilience
    expect(parseSessionLogEntry(true)).toBeNull();
  });
});

describe("mergeDay", () => {
  it("sums scalar fields across two DayAggs", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      cost: 1,
      crTok: 100,
      cwTok: 200,
      inTok: 100,
      outTok: 50,
      userMsgs: 2,
      asstMsgs: 3,
      toolResults: 1,
    };

    mergeDay(a, b);
    expect(a.cost).toBe(1);
    expect(a.crTok).toBe(100);
    expect(a.cwTok).toBe(200);
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

  it("merges hourCost records", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      hourCost: { 10: 1.5, 14: 2.0 },
    };

    mergeDay(a, b);
    expect(a.hourCost).toEqual({ 10: 1.5, 14: 2.0 });
  });

  it("sums hourCost from multiple merges", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      hourCost: { 10: 1.5, 14: 2.0 },
    };
    const c: DayAgg = {
      ...emptyDay("2026-06-08"),
      hourCost: { 10: 0.5, 16: 3.0 },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.hourCost).toEqual({ 10: 2.0, 14: 2.0, 16: 3.0 });
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

  it("merges model cost and count records", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      modelCost: { "deepseek-v4": 0.05, "gpt-5": 0.1 },
      modelCount: { "deepseek-v4": 3, "gpt-5": 1 },
    };
    const c: DayAgg = {
      ...emptyDay("2026-06-08"),
      modelCost: { "deepseek-v4": 0.03 },
      modelCount: { "deepseek-v4": 2 },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.modelCost).toEqual({ "deepseek-v4": 0.08, "gpt-5": 0.1 });
    expect(a.modelCount).toEqual({ "deepseek-v4": 5, "gpt-5": 1 });
  });



  it("merges provider cost and count records", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      providerCost: { deepseek: 0.05, openai: 0.1 },
      providerCount: { deepseek: 3, openai: 1 },
    };
    const c: DayAgg = {
      ...emptyDay("2026-06-08"),
      providerCost: { deepseek: 0.03 },
      providerCount: { deepseek: 2 },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.providerCost).toEqual({ deepseek: 0.08, openai: 0.1 });
    expect(a.providerCount).toEqual({ deepseek: 5, openai: 1 });
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

  it("merges new fields: compaction, modelChanges, thinkingLevelCount", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay("2026-06-08"),
      compactionCount: 2,
      compactedTokens: 80000,
      modelChanges: 1,
      thinkingLevelCount: { low: 2, high: 1 },
    };
    const c: DayAgg = {
      ...emptyDay("2026-06-08"),
      compactionCount: 1,
      compactedTokens: 20000,
      modelChanges: 2,
      thinkingLevelCount: { low: 1, xhigh: 1 },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.compactionCount).toBe(3);
    expect(a.compactedTokens).toBe(100000);
    expect(a.modelChanges).toBe(3);
    expect(a.thinkingLevelCount).toEqual({ low: 3, high: 1, xhigh: 1 });
  });

});

describe("parseFile", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-parser-test-${Date.now()}`);
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
        message: { role: "user", content: "hi", timestamp: 1700000000000 },
      }),
      "invalid json {broken",
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-08T10:02:00.000Z",
        message: mkAsst({
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
        }),
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    let warnings = 0;
    const { dayMap: map } = parseFile(filePath, (count) => {
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
    const { dayMap: map } = parseFile(filePath);
    expect(map.size).toBe(0);
  });

  it("silently returns empty map for non-existent file", async () => {
    const { dayMap: map } = parseFile("/nonexistent/path/never.jsonl");
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
        message: { role: "user", content: "hi", timestamp: 1700000000000 },
      }),
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-09T10:00:00.000Z",
        message: { role: "user", content: "bye", timestamp: 1700000000001 },
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    const { dayMap: map } = parseFile(filePath);

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
        message: { role: "user", content: "ok", timestamp: 1700000000000 },
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    const { dayMap: map } = parseFile(filePath);

    expect(map.size).toBe(1);
    expect(map.get("2026-06-08")?.userMsgs).toBe(1);
  });

  it("handles sessions with no messages", async () => {
    const filePath = join(tmpDir, "session-only.jsonl");
    const lines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    const { dayMap: map } = parseFile(filePath);

    expect(map.size).toBe(1);
    const day = map.get("2026-06-08")!;
    expect(day.sessionIds.has("s1")).toBe(true);
    expect(day.userMsgs).toBe(0);
    expect(day.asstMsgs).toBe(0);
    expect(day.toolResults).toBe(0);
    expect(day.cost).toBe(0);
  });

  it("returns empty map for file with only corrupt lines", async () => {
    const filePath = join(tmpDir, "all-corrupt.jsonl");
    const lines = ["not json at all", "{also broken", "still broken]"];
    await writeFile(filePath, lines.join("\n"));

    let warnings = 0;
    const { dayMap: map } = parseFile(filePath, (count) => {
      warnings = count;
    });

    expect(map.size).toBe(0);
    expect(warnings).toBe(3);
  });

  it("skips whitespace-only lines without counting them as corrupt", async () => {
    const filePath = join(tmpDir, "with-blanks.jsonl");
    const lines = [
      "",
      "   ",
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:00:00.000Z",
        message: { role: "user", content: "hi", timestamp: 1700000000000 },
      }),
      "\t",
    ];
    await writeFile(filePath, lines.join("\n"));

    let warnings = 0;
    const { dayMap: map } = parseFile(filePath, (count) => {
      warnings = count;
    });

    expect(map.size).toBe(1);
    expect(warnings).toBe(0);
  });

  it("does not leak project costs across separate files", async () => {
    const costMsg = (cost: number) => ({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: mkAsst({
        content: [{ type: "text", text: "ok" }],
        model: "m",
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: cost },
        },
      }),
    });

    const fileA = join(tmpDir, "project-a.jsonl");
    await writeFile(
      fileA,
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s-a",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-alpha",
        }),
        JSON.stringify(costMsg(0.1)),
      ].join("\n"),
    );

    const fileB = join(tmpDir, "project-b.jsonl");
    await writeFile(
      fileB,
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s-b",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-beta",
        }),
        JSON.stringify(costMsg(0.25)),
      ].join("\n"),
    );

    const { dayMap: mapA } = parseFile(fileA);
    const { dayMap: mapB } = parseFile(fileB);

    const dayA = mapA.get("2026-06-08")!;
    expect(Object.keys(dayA.projectCost)).toEqual(["proj-alpha"]);
    expect(dayA.projectCost["proj-alpha"]).toBe(0.1);

    const dayB = mapB.get("2026-06-08")!;
    expect(Object.keys(dayB.projectCost)).toEqual(["proj-beta"]);
    expect(dayB.projectCost["proj-beta"]).toBe(0.25);
  });

  it("silently skips unknown entry types (branch_summary, custom, label, session_info)", async () => {
    const filePath = join(tmpDir, "unknown-types.jsonl");
    const lines = [
      JSON.stringify({
        type: "branch_summary",
        id: "b1",
        parentId: null,
        timestamp: "2026-06-08T10:00:00.000Z",
        fromId: "m1",
        summary: "branch",
      }),
      JSON.stringify({
        type: "custom",
        id: "c1",
        parentId: "b1",
        timestamp: "2026-06-08T10:01:00.000Z",
        customType: "my-ext",
        data: { x: 1 },
      }),
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "c1",
        timestamp: "2026-06-08T10:02:00.000Z",
        message: { role: "user", content: "hi", timestamp: 1700000000000 },
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    let warnings = 0;
    const { dayMap: map } = parseFile(filePath, (c) => {
      warnings = c;
    });

    // Only the user message should be counted; unknown types are silently skipped
    expect(map.size).toBe(1);
    expect(map.get("2026-06-08")?.userMsgs).toBe(1);
    expect(warnings).toBe(0);
  });

  it("end-to-end: parses and aggregates a realistic session file", async () => {
    const filePath = join(tmpDir, "session.jsonl");
    const lines = [
      // Session header — establishes project "pi-tui-extras"
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s-main",
        timestamp: "2026-06-10T09:00:00.000Z",
        cwd: "/home/doe/dev/pi-tui-extras",
      }),
      // User message
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "s-main",
        timestamp: "2026-06-10T09:01:00.000Z",
        message: { role: "user", content: "add logging", timestamp: 1700000000000 },
      }),
      // Assistant message with cost + edit tool call
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-10T09:02:00.000Z",
        message: mkAsst({
          content: [
            { type: "text", text: "sure" },
            tc("edit", { path: "/src/lib.ts", edits: [{ newText: "console.log(1)\n" }] }),
            { ...tc("write", { path: "/src/log.rs", content: "fn log() {}" }), id: "c2" },
            { ...tc("read", { path: "/src/main.ts" }), id: "c3" },
          ],
          model: "sonnet-v3",
          provider: "anthropic",
          usage: {
            input: 500,
            output: 200,
            cacheRead: 50,
            cacheWrite: 10,
            totalTokens: 760,
            cost: {
              input: 0.002,
              output: 0.003,
              cacheRead: 0.0001,
              cacheWrite: 0.0002,
              total: 0.0053,
            },
          },
        }),
      }),
      // Tool result
      JSON.stringify({
        type: "message",
        id: "m3",
        parentId: "m2",
        timestamp: "2026-06-10T09:02:30.000Z",
        message: mkToolResult({ toolName: "edit" }),
      }),
      // Model change
      JSON.stringify({
        type: "model_change",
        id: "mc1",
        parentId: "m3",
        timestamp: "2026-06-10T09:05:00.000Z",
        provider: "deepseek",
        modelId: "deepseek-v4",
      }),
      // Compaction
      JSON.stringify({
        type: "compaction",
        id: "c1",
        parentId: "mc1",
        timestamp: "2026-06-10T09:10:00.000Z",
        summary: "mid-session compact",
        firstKeptEntryId: "m1",
        tokensBefore: 30000,
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    const { dayMap: map, modelToProvider } = parseFile(filePath);

    expect(map.size).toBe(1);
    const day = map.get("2026-06-10")!;

    // delete temp file
    await unlink(filePath);

    // Session tracking
    expect(day.sessionIds.has("s-main")).toBe(true);
    expect(day.projectCost["pi-tui-extras"]).toBe(0.0053);
    expect(day.projectSessions["pi-tui-extras"]?.has("s-main")).toBe(true);

    // Message counts
    expect(day.userMsgs).toBe(1);
    expect(day.asstMsgs).toBe(1);
    expect(day.toolResults).toBe(1);

    // Token usage
    expect(day.inTok).toBe(500);
    expect(day.outTok).toBe(200);
    expect(day.crTok).toBe(50);
    expect(day.cwTok).toBe(10);

    // Cost
    expect(day.cost).toBe(0.0053);
    const hour = new Date("2026-06-10T09:02:00.000Z").getHours();
    expect(day.hourCost[hour]).toBe(0.0053);

    // Model and provider
    expect(day.modelCost["sonnet-v3"]).toBe(0.0053);
    expect(day.modelCount["sonnet-v3"]).toBe(1);
    expect(day.providerCost["anthropic"]).toBe(0.0053);
    expect(day.providerCount["anthropic"]).toBe(1);
    expect(modelToProvider.get("sonnet-v3")).toBe("anthropic");

    // Tool counts
    expect(day.toolCount["edit"]).toBe(2); // 1 tool call + 1 tool result
    expect(day.toolCount["write"]).toBe(1);
    expect(day.toolCount["read"]).toBe(1);

    // Language attribution
    expect(day.langLines["TypeScript"]).toBe(2); // edit (1) + read doesn't count
    expect(day.langEdits["TypeScript"]).toBe(1);
    expect(day.langLines["Rust"]).toBe(1);

    // Non-cost-relevant entry types
    expect(day.modelChanges).toBe(1);
    expect(day.compactionCount).toBe(1);
    expect(day.compactedTokens).toBe(30000);
  });
});
