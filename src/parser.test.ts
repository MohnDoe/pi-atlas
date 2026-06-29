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
  emptySession,
  mergeDay,
  mergeToSession,
  parseAssistantMessage,
  parseCompactionEntry,
  parseFile,
  parseLanguageUsage,
  parseModelChangeEntry,
  parseSessionHeader,
  parseSessionLogEntry,
  parseThinkingLevelChangeEntry,
  parseToolResultMessage,
  parseUserMessage,
} from "./parser";
import type { DayAgg, SessionAgg } from "./types";

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

// ======== TRACER BULLET: end-to-end JSONL → SessionAgg ========

describe("tracer bullet — parseFile returns SessionAgg", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-parser-tracer-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("parses a JSONL file into a SessionAgg", async () => {
    const filePath = join(tmpDir, "test.jsonl");
    const lines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/dev/my-app",
      }),
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: "2026-06-08T10:01:00.000Z",
        message: { role: "user", content: "hi", timestamp: 1700000000000 },
      }),
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-08T10:02:00.000Z",
        message: mkAsst({
          content: [{ type: "text", text: "hey" }],
          model: "deepseek-v4",
          provider: "deepseek",
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

    const session = parseFile(filePath);

    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe("s1");
    expect(session!.date).toBe("2026-06-08");
    expect(session!.project).toBe("my-app");
    expect(session!.userMsgs).toBe(1);
    expect(session!.models["deepseek-v4"]).toBeDefined();
    expect(session!.models["deepseek-v4"].cost).toBe(0.01);
    expect(session!.models["deepseek-v4"].calls).toBe(1);
    expect(session!.models["deepseek-v4"].inTok).toBe(100);
    expect(session!.models["deepseek-v4"].outTok).toBe(50);
    expect(session!.models["deepseek-v4"].asstMsgs).toBe(1);
  });

  it("returns null for corrupt/empty file", async () => {
    const filePath = join(tmpDir, "corrupt.jsonl");
    await writeFile(filePath, "not valid json\n{{broken");
    expect(parseFile(filePath)).toBeNull();

    const emptyPath = join(tmpDir, "empty.jsonl");
    await writeFile(emptyPath, "");
    expect(parseFile(emptyPath)).toBeNull();
  });

  it("returns null for non-existent file", async () => {
    expect(parseFile("/nonexistent/path.jsonl")).toBeNull();
  });
});
