import type {
  AssistantMessage as PiAssistantMessage,
  ToolResultMessage as PiToolResultMessage,
  ToolCall,
  UserMessage,
} from "@earendil-works/pi-ai";
import type { UserMessage } from "@earendil-works/pi-ai";
import type {
  CompactionEntry,
  ModelChangeEntry,
  SessionHeader,
  SessionMessageEntry,
  ThinkingLevelChangeEntry,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import assert from "node:assert";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dateFromISOString } from "./format";
import { makeEmptySession } from "./helpers/session.helper";
import {
  activeSkill,
  emptyDay,
  mergeDay,
  mergeToSession,
  parseAssistantMessage,
  parseCompactionEntry,
  parseFile,
  parseModelChangeEntry,
  parseSessionHeader,
  parseSessionLogEntry,
  parseThinkingLevelChangeEntry,
  parseToolResultMessage,
  parseUserMessage,
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

// Helper: minimal UserMessage
function mkUser(content: string): UserMessage {
  return { role: "user", content, timestamp: 1700000000000 };
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
    expect(day.skillCost).toEqual({});
    expect(day.skillCount).toEqual({});
    expect(day.skillTokens).toEqual({});
    expect(day.skillToolCount).toEqual({});
    expect(day.skillToolBreakdown).toEqual({});
    expect(day.hourCost).toEqual({});
  });
import { makeAssistantMessage, makeToolCall, makeToolResult } from "./tests/factories/pi.factory";

describe("parseFile — SessionAgg", () => {
  let tmpDir: string;

describe("parseUserMessage", () => {
  beforeEach(() => {
    activeSkill.current = null;
  });

  it("returns a DayAgg with userMsgs: 1", () => {
    const day = parseUserMessage(mkUser("hello"));
    expect(day.userMsgs).toBe(1);
    expect(day.asstMsgs).toBe(0);
    expect(day.toolResults).toBe(0);
  });

  it("detects skill tag and increments skillCount", () => {
    activeSkill.current = null;
    const day = parseUserMessage(mkUser('<skill name="tdd">implement the parser</skill>'));
    // @ts-expect-error
    expect(activeSkill.current).toBe("tdd");
    expect(day.skillCount).toEqual({ tdd: 1 });
    expect(day.userMsgs).toBe(1);
  });

  it("detects skill tag case-insensitively", () => {
    activeSkill.current = null;
    const day = parseUserMessage(mkUser('<SKILL NAME="TDD">do it</SKILL>'));
    // @ts-expect-error
    expect(activeSkill.current).toBe("TDD");
    expect(day.skillCount).toEqual({ TDD: 1 });
  });

  it("clears activeSkill when no skill tag", () => {
    activeSkill.current = "tdd";
    const day = parseUserMessage(mkUser("normal message"));
    expect(activeSkill.current).toBeNull();
    expect(day.skillCount).toEqual({});
  });

  it("replaces activeSkill when new skill tag appears", () => {
    activeSkill.current = "writing";
    const day = parseUserMessage(mkUser('<skill name="tdd">implement</skill>'));
    expect(activeSkill.current).toBe("tdd");
    expect(day.skillCount).toEqual({ tdd: 1 });
  });

  it("ignores malformed skill tag", () => {
    activeSkill.current = null;
    const day = parseUserMessage(mkUser("<skill name=>no value</skill>"));
    expect(activeSkill.current).toBeNull();
    expect(day.skillCount).toEqual({});
  });

  it("ignores skill tag with missing name attribute", () => {
    activeSkill.current = "existing";
    const day = parseUserMessage(mkUser("<skill>no name attr</skill>"));
    expect(activeSkill.current).toBeNull();
    expect(day.skillCount).toEqual({});
  });
});
  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-parser-${Date.now()}`);
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
        message: makeAssistantMessage({
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

    assert(session);
    expect(session.sessionId).toBe("s1");

    expect(session.timestamp).toBe("2026-06-08T10:00:00.000Z");
    expect(session.project).toBe("my-app");
    expect(session.cwd).toBe("/home/doe/dev/my-app");
    expect(session.userMsgs).toBe(1);

    assert(session.models["deepseek"]);
    assert(session.models["deepseek"]["deepseek-v4"]);
    expect(session.models["deepseek"]["deepseek-v4"].usage.cost.total).toBe(0.01);
    expect(session.models["deepseek"]["deepseek-v4"].calls).toBe(1);
    expect(session.models["deepseek"]["deepseek-v4"].usage.input).toBe(100);
    expect(session.models["deepseek"]["deepseek-v4"].usage.output).toBe(50);
    expect(session.models["deepseek"]["deepseek-v4"].asstMsgs).toBe(1);
    expect(session.models["deepseek"]["deepseek-v4"].provider).toBe("deepseek");
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

  it("attributes tool call to active skill", () => {
    activeSkill.current = "tdd";
    const msg = mkToolResult({ toolName: "edit" });
    const day = parseToolResultMessage(msg);
    expect(day.skillToolCount["tdd"]).toBe(1);
    expect(day.skillToolBreakdown["tdd"]).toEqual({ edit: 1 });
  });

  it("does not attribute tool call when no active skill", () => {
    activeSkill.current = null;
    const msg = mkToolResult({ toolName: "bash" });
    const day = parseToolResultMessage(msg);
    expect(day.skillToolCount).toEqual({});
    expect(day.skillToolBreakdown).toEqual({});
  });

  it("uses sanitized tool name in skill tool breakdown", () => {
    activeSkill.current = "tdd";
    const msg = mkToolResult({ toolName: "ls -la\n" });
    const day = parseToolResultMessage(msg);
    expect(day.skillToolBreakdown["tdd"]?.["ls -la"]).toBe(1);
  });
});

  it("handles corrupt lines with onWarning callback", async () => {
    const filePath = join(tmpDir, "mixed.jsonl");
    await writeFile(
      filePath,
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj",
        }),
        "broken json",
        "also broken",
      ].join("\n"),
    );

    let warnings = 0;
    const session = parseFile(filePath, (c) => {
      warnings = c;
    });
    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe("s1");
    expect(warnings).toBe(2);
  });

  it("handles missing onWarning callback gracefully", async () => {
    const filePath = join(tmpDir, "corrupt-silent.jsonl");
    await writeFile(
      filePath,
      "not valid json\nstill not\n" +
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj",
        }),
    );

    const session = parseFile(filePath);
    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe("s1");
  });

  it("returns null for file with only corrupt lines", async () => {
    const filePath = join(tmpDir, "all-corrupt.jsonl");
    await writeFile(filePath, "not json\n{also broken\nstill broken]");

    let warnings = 0;
    const session = parseFile(filePath, (c) => {
      warnings = c;
    });
    expect(session).toBeNull();
    expect(warnings).toBe(3);
  });

  it("skips whitespace-only lines without counting them as corrupt", async () => {
    const filePath = join(tmpDir, "with-blanks.jsonl");
    await writeFile(
      filePath,
      [
        "",
        "   ",
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj",
        }),
        "\t",
      ].join("\n"),
    );

    let warnings = 0;
    const session = parseFile(filePath, (c) => {
      warnings = c;
    });
    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe("s1");
    expect(warnings).toBe(0);
  });

  it("does not leak project costs across separate files", async () => {
    const costMsg = (cost: number, model: string, provider: string) => ({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: makeAssistantMessage({
        content: [{ type: "text", text: "ok" }],
        model,
        provider,
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
        JSON.stringify(costMsg(0.1, "gpt-4", "openai")),
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
        JSON.stringify(costMsg(0.25, "gpt-4", "openai")),
      ].join("\n"),
    );

    const sessionA = parseFile(fileA)!;
    const sessionB = parseFile(fileB)!;

    expect(sessionA.project).toBe("proj-alpha");
    expect(sessionA.models["openai"]!["gpt-4"]!.usage.cost.total).toBe(0.1);

    expect(sessionB.project).toBe("proj-beta");
    expect(sessionB.models["openai"]!["gpt-4"]!.usage.cost.total).toBe(0.25);
  });

  it("handles sessions with no messages", async () => {
    const filePath = join(tmpDir, "session-only.jsonl");
    await writeFile(
      filePath,
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/home/doe/proj",
      }),
    );

    const session = parseFile(filePath);
    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe("s1");
    expect(session!.project).toBe("proj");
    expect(session!.userMsgs).toBe(0);
    expect(session!.toolResults).toBe(0);
    expect(Object.keys(session!.models).length).toBe(0);
  });

  it("silently skips unknown entry types", async () => {
    const filePath = join(tmpDir, "unknown-types.jsonl");
    await writeFile(
      filePath,
      [
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
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:02:00.000Z",
          cwd: "/home/doe/proj",
        }),
      ].join("\n"),
    );

    const session = parseFile(filePath);
    expect(session).not.toBeNull();
    expect(session!.sessionId).toBe("s1");
  });
});

// ======== emptySession ========

describe("emptySession", () => {
  it("creates a zeroed SessionAgg with sessionId, date, project", () => {
    const s = makeEmptySession("s1", new Date("2026-06-09"), "my-app");
    expect(s.sessionId).toBe("s1");
    expect(dateFromISOString(s.timestamp)).toBe("2026-06-09");
    expect(s.project).toBe("my-app");
    expect(s.models).toEqual({});
    expect(s.userMsgs).toBe(0);
    expect(s.toolResults).toBe(0);
    expect(s.compactionCount).toBe(0);
    expect(s.compactedTokens).toBe(0);
    expect(s.modelChanges).toBe(0);
    expect(s.thinkingLevelCount).toEqual({});
  });

  it("returns a new empty object each call", () => {
    const a = makeEmptySession("s1", new Date("2026-06-09"), "a");
    const b = makeEmptySession("s1", new Date("2026-06-09"), "a");
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});

// ======== parseUserMessage ========

describe("parseUserMessage", () => {
  it("returns a SessionAgg with userMsgs: 1", () => {
    const s = parseUserMessage({
      timestamp: Date.now(),
      content: "hey",
      role: "user",
    });
    expect(s.userMsgs).toBe(1);
    expect(s.models).toEqual({});
  });
});

// ======== parseToolResultMessage ========

describe("parseToolResultMessage", () => {
  it("counts one tool result", () => {
    const msg = makeToolResult({ toolName: "bash" });
    const s = parseToolResultMessage(msg);
    expect(s.toolResults).toBe(1);
  });

  it("handles empty toolName gracefully", () => {
    const msg = makeToolResult({ toolName: "" });
    const s = parseToolResultMessage(msg);
    expect(s.toolResults).toBe(1);
  });
});

// ======== parseAssistantMessage ========

describe("parseAssistantMessage", () => {
  it("counts usage tokens and attributes to model", () => {
    const msg = makeAssistantMessage({
      content: [{ type: "text", text: "hello" }],
      model: "deepseek-v4-pro",
      provider: "deepseek",
      usage: {
        input: 100,
        output: 50,
        cacheRead: 10,
        cacheWrite: 5,
        totalTokens: 165,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.003 },
      },
    });
    const s = parseAssistantMessage(msg);
    assert(s.models["deepseek"]);
    const m = s.models["deepseek"]["deepseek-v4-pro"];
    assert(m);
    expect(m.asstMsgs).toBe(1);
    expect(m.usage.cost.total).toBe(0.003);
    // expect(m.calls).toBe(1);
    expect(m.usage.input).toBe(100);
    expect(m.usage.output).toBe(50);
    expect(m.usage.cacheRead).toBe(10);
    expect(m.usage.cacheWrite).toBe(5);
    expect(m.provider).toBe("deepseek");
  });

  it("skips model entry when model field is empty", () => {
    const msg = makeAssistantMessage({
      model: "",
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
    const s = parseAssistantMessage(msg);
    expect(s.models).toEqual({});
  });

  it("counts tool calls from content blocks per-model", () => {
    const msg = makeAssistantMessage({
      content: [
        makeToolCall({ name: "read", arguments: { path: "/f" } }),
        makeToolCall({ name: "bash", arguments: { command: "ls" }, id: "c2" }),
        makeToolCall({ name: "read", arguments: { path: "/g" }, id: "c3" }),
      ],
      model: "sonnet",
      provider: "anthropic",
    });
    const s = parseAssistantMessage(msg);
    const m = s.models["anthropic"]!["sonnet"];
    assert(m);
    expect(m.tools["read"]).toBe(2);
    expect(m.tools["bash"]).toBe(1);
  });

  it("strips control characters from tool call names", () => {
    const msg = makeAssistantMessage({
      model: "m",
      provider: "provider",
      content: [makeToolCall({ name: "ls -la agent/\n</parameter", arguments: { command: "ls" } })],
    });
    const s = parseAssistantMessage(msg);
    const m = s.models["provider"]!["m"];
    assert(m);
    expect(m.tools["ls -la agent/</parameter"]).toBe(1);
    expect(m.tools["ls -la agent/\n</parameter"]).toBeUndefined();
  });

  it("detects language from edit/write tool calls per-model", () => {
    const msg = makeAssistantMessage({
      model: "sonnet",
      provider: "anthropic",
      content: [
        makeToolCall({
          name: "edit",
          arguments: { path: "/src/foo.ts", edits: [{ newText: "abc" }] },
        }),
        makeToolCall({
          name: "write",
          id: "c2",
          arguments: { path: "/src/bar.rs", content: "fn main() {}" },
        }),
      ],
    });
    const s = parseAssistantMessage(msg);
    const m = s.models["anthropic"]!["sonnet"];
    assert(m);
    expect(m.languages["TypeScript"]!.lines).toBe(1);
    expect(m.languages["TypeScript"]!.edits).toBe(1);
    expect(m.languages["Rust"]!.lines).toBe(1);
    expect(m.languages["Rust"]!.edits).toBe(0);
  });

  it("handles zero-cost usage gracefully", () => {
    const msg = makeAssistantMessage({
      model: "m",
      provider: "p",
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
    const s = parseAssistantMessage(msg);
    const m = s.models["p"]!["m"];
    assert(m);
    expect(m.asstMsgs).toBe(1);
    expect(m.usage.cost.total).toBe(0);
    expect(m.usage.input).toBe(0);
  });

  it("handles missing usage gracefully", () => {
    const msg = makeAssistantMessage({
      model: "m",
      provider: "p",
      content: [{ type: "text", text: "hi" }],
    });
    const s = parseAssistantMessage(msg);
    const m = s.models["p"]!["m"];
    assert(m);
    expect(m.asstMsgs).toBe(1);
    expect(m.usage.input).toBe(0);
    expect(m.usage.input).toBe(0);
  });

  it("handles missing content gracefully", () => {
    const msg = makeAssistantMessage({
      model: "m",
      provider: "p",
      usage: {
        input: 10,
        output: 5,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 15,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
    });
    const s = parseAssistantMessage(msg);
    const m = s.models["p"]!["m"];
    assert(m);
    expect(m.asstMsgs).toBe(1);
    expect(m.tools).toEqual({});
  });

  it("parses JSON-string toolCall arguments", () => {
    const msg = makeAssistantMessage({
      model: "m",
      provider: "p",
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
    const s = parseAssistantMessage(msg);
    const m = s.models["p"]!["m"];
    assert(m);
    expect(m.tools["edit"]).toBe(1);
    expect(m.languages["TypeScript"]!.lines).toBe(1);
    expect(m.languages["TypeScript"]!.edits).toBe(1);
  });

  it("handles toolCall with undefined arguments", () => {
    const msg = makeAssistantMessage({
      //@ts-expect-error
      content: [{ type: "toolCall" as const, id: "c1", name: "read" }],
      model: "m",
      provider: "p",
    });
    const s = parseAssistantMessage(msg);
    const m = s.models["p"]!["m"];
    assert(m);
    expect(m.tools["read"]).toBe(1);
  });

  it("attributes cost and tokens to active skill", () => {
    activeSkill.current = "tdd";
    const msg = mkAsst({
      content: [{ type: "text", text: "hello" }],
      usage: {
        input: 100,
        output: 50,
        cacheRead: 10,
        cacheWrite: 5,
        totalTokens: 165,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.02 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.skillCost["tdd"]).toBe(0.02);
    expect(day.skillTokens["tdd"]).toBe(165);
  });

  it("attributes tool calls to active skill from content blocks", () => {
    activeSkill.current = "writing";
    const msg = mkAsst({
      content: [tc("read", { path: "/f" }), { ...tc("bash", { command: "ls" }), id: "c2" }],
    });
    const day = parseAssistantMessage(msg);
    expect(day.skillToolCount["writing"]).toBe(2);
    expect(day.skillToolBreakdown["writing"]).toEqual({ read: 1, bash: 1 });
  });

  it("does not attribute cost/tokens when no active skill", () => {
    activeSkill.current = null;
    const msg = mkAsst({
      content: [{ type: "text", text: "hello" }],
      usage: {
        input: 100,
        output: 50,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 150,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 },
      },
    });
    const day = parseAssistantMessage(msg);
    expect(day.skillCost).toEqual({});
    expect(day.skillTokens).toEqual({});
    expect(day.skillToolCount).toEqual({});
  });
});

// ======== parseSessionHeader ========

describe("parseSessionHeader", () => {
  it("creates a SessionAgg with session id, date, and project", () => {
    const entry: SessionHeader = {
      type: "session",
      version: 3,
      id: "abc-123",
      timestamp: "2026-06-09T10:00:00.000Z",
      cwd: "/home/doe",
    };
    const s = parseSessionHeader(entry);
    expect(s.sessionId).toBe("abc-123");
    expect(dateFromISOString(s.timestamp)).toBe("2026-06-09");
    expect(s.project).toBe("doe");
  });

  it("derives project from cwd basename", () => {
    const entry: SessionHeader = {
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-09T10:00:00.000Z",
      cwd: "/home/doe/dev/my-app",
    };
    const s = parseSessionHeader(entry);
    expect(s.project).toBe("my-app");
  });

  it("handles empty cwd gracefully (empty project)", () => {
    const entry: SessionHeader = {
      type: "session",
      version: 3,
      id: "s2",
      timestamp: "2026-06-09T10:00:00.000Z",
      cwd: "",
    };
    const s = parseSessionHeader(entry);
    expect(s.project).toBe("");
  });
});

// ======== parseModelChangeEntry ========

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
    const s = parseModelChangeEntry(entry);
    expect(s.modelChanges).toBe(1);
  });
});

// ======== parseThinkingLevelChangeEntry ========

describe("parseThinkingLevelChangeEntry", () => {
  it("counts one thinking level change", () => {
    const entry: ThinkingLevelChangeEntry = {
      type: "thinking_level_change",
      id: "t1",
      parentId: "p",
      timestamp: "2026-06-09T10:00:00.000Z",
      thinkingLevel: "high",
    };
    const s = parseThinkingLevelChangeEntry(entry);
    expect(s.thinkingLevelCount).toEqual({ high: 1 });
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

    const base = makeEmptySession("s1", new Date(), "p");
    mergeToSession(base, parseThinkingLevelChangeEntry(low));
    mergeToSession(base, parseThinkingLevelChangeEntry(high));
    expect(base.thinkingLevelCount).toEqual({ low: 1, high: 1 });
  });
});

// ======== parseCompactionEntry ========

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
    const s = parseCompactionEntry(entry);
    expect(s.compactionCount).toBe(1);
    expect(s.compactedTokens).toBe(50000);
  });
});

// ======== parseSessionLogEntry ========

describe("parseSessionLogEntry", () => {
  it("returns a SessionAgg for a session entry", () => {
    const entry: SessionHeader = {
      type: "session",
      version: 3,
      id: "abc-123",
      timestamp: "2026-06-08T17:37:04.122Z",
      cwd: "/home/doe/dev/pi-atlas",
    };
    const s = parseSessionLogEntry(entry)!;
    expect(s!.sessionId).toBe("abc-123");
    expect(dateFromISOString(s!.timestamp)).toBe("2026-06-08");
    expect(s!.project).toBe("pi-atlas");
  });

  it("returns null for corrupt/null/undefined entries", () => {
    // @ts-expect-error: testing runtime resilience
    expect(parseSessionLogEntry(null)).toBeNull();
    // @ts-expect-error: testing runtime resilience
    expect(parseSessionLogEntry(undefined)).toBeNull();
    // @ts-expect-error: testing runtime resilience
    expect(parseSessionLogEntry("corrupt")).toBeNull();
    // @ts-expect-error: testing runtime resilience
    expect(parseSessionLogEntry(42)).toBeNull();
    // @ts-expect-error: testing runtime resilience
    expect(parseSessionLogEntry(true)).toBeNull();
  });

  it("returns a SessionAgg for an assistant message with usage", () => {
    const msgEntry: SessionMessageEntry = {
      type: "message",
      id: "msg-1",
      parentId: "prev",
      timestamp: "2026-06-08T10:05:00.000Z",
      message: makeAssistantMessage({
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

    const s = parseSessionLogEntry(msgEntry)!;
    const m = s.models["deepseek"]!["deepseek-v4-pro"];
    assert(m);
    expect(m.usage.cost.total).toBe(0.00141);
    expect(m.usage.input).toBe(1000);
    expect(m.usage.output).toBe(200);
    expect(m.usage.cacheRead).toBe(100);
    expect(m.usage.cacheWrite).toBe(0);
    expect(m.asstMsgs).toBe(1);
    expect(m.provider).toBe("deepseek");
  });

  it("returns a SessionAgg for a user message", () => {
    const s = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: { role: "user" as const, content: "hi", timestamp: 1700000000000 },
    })!;

    expect(s.userMsgs).toBe(1);
  });

  it("returns a SessionAgg for a tool result message", () => {
    const s = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:02:00.000Z",
      message: makeToolResult({ toolName: "bash" }),
    })!;

    expect(s.toolResults).toBe(1);
  });

  it("detects languages from edit/write tool calls", () => {
    const s = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: makeAssistantMessage({
        content: [
          makeToolCall({
            name: "edit",
            arguments: {
              path: "/home/doe/proj/src/foo.ts",
              edits: [{ oldText: "a", newText: "ab" }],
            },
          }),

          makeToolCall({
            name: "write",
            arguments: {
              path: "/home/doe/proj/src/bar.rs",
              content: "fn main() {}",
            },
            id: "c2",
          }),
          makeToolCall({ name: "read", arguments: { path: "/home/doe/proj/README.md" }, id: "c3" }),
        ],
        model: "sonnet",
        provider: "anthropic",
      }),
    })!;

    const m = s.models["anthropic"]!["sonnet"];
    assert(m);
    expect(m.languages["TypeScript"]!.lines).toBe(1);
    expect(m.languages["TypeScript"]!.edits).toBe(1);
    expect(m.languages["Rust"]!.lines).toBe(1);
    expect(m.languages["Rust"]!.edits).toBe(0);
    expect(m.languages["Markdown"]).toBeUndefined();
  });

  it("counts tool calls from assistant content", () => {
    const s = parseSessionLogEntry({
      type: "message",
      id: "m1",
      parentId: "p",
      timestamp: "2026-06-08T10:01:00.000Z",
      message: makeAssistantMessage({
        content: [
          makeToolCall({ name: "bash", arguments: { command: "ls" } }),
          makeToolCall({ name: "read", arguments: { path: "f" }, id: "c2" }),
          makeToolCall({ name: "read", arguments: { path: "g" }, id: "c3" }),
        ],
        model: "sonnet",
        provider: "anthropic",
      }),
    })!;

    const m = s.models["anthropic"]!["sonnet"];
    assert(m);
    expect(m.tools["bash"]).toBe(1);
    expect(m.tools["read"]).toBe(2);
  });

  it("handles compaction entries", () => {
    const s = parseSessionLogEntry({
      type: "compaction",
      id: "c1",
      parentId: "p",
      timestamp: "2026-06-08T10:00:00.000Z",
      summary: "Summary",
      firstKeptEntryId: "m1",
      tokensBefore: 42000,
    })!;

    expect(s.compactionCount).toBe(1);
    expect(s.compactedTokens).toBe(42000);
  });

  it("handles model_change entries", () => {
    const s = parseSessionLogEntry({
      type: "model_change",
      id: "mc1",
      parentId: "p",
      timestamp: "2026-06-08T10:00:00.000Z",
      provider: "openai",
      modelId: "gpt-5",
    })!;

    expect(s.modelChanges).toBe(1);
  });

  it("handles thinking_level_change entries", () => {
    const s = parseSessionLogEntry({
      type: "thinking_level_change",
      id: "t1",
      parentId: "p",
      timestamp: "2026-06-08T10:00:00.000Z",
      thinkingLevel: "xhigh",
    })!;

    expect(s.thinkingLevelCount).toEqual({ xhigh: 1 });
  });

  it("returns null for unknown/skipped entry types", () => {
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

  it("returns null for custom_message and session_info types", () => {
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

  it("handles session entry with empty cwd", () => {
    const s = parseSessionLogEntry({
      type: "session",
      version: 3,
      id: "s1",
      timestamp: "2026-06-08T10:00:00.000Z",
      cwd: "",
    })!;

    expect(s.sessionId).toBe("s1");
    expect(s.project).toBe("");
  });
});

// ======== mergeToSession ========

describe("mergeToSession", () => {
  it("sums scalar fields", () => {
    const base = makeEmptySession("s1", new Date("2026-06-08"), "p");
    const update = makeEmptySession("", new Date(0), "");
    update.userMsgs = 2;
    update.toolResults = 1;
    update.compactionCount = 1;
    update.compactedTokens = 5000;
    update.modelChanges = 2;

    mergeToSession(base, update);
    expect(base.userMsgs).toBe(2);
    expect(base.toolResults).toBe(1);
    expect(base.compactionCount).toBe(1);
    expect(base.compactedTokens).toBe(5000);
    expect(base.modelChanges).toBe(2);
  });

  it("merges thinkingLevelCount records", () => {
    const base = makeEmptySession("s1", new Date("2026-06-08"), "p");
    const a = makeEmptySession("", new Date(0), "");
    a.thinkingLevelCount = { low: 1, high: 1 };
    const b = makeEmptySession("", new Date(0), "");
    b.thinkingLevelCount = { high: 2, xhigh: 1 };

    mergeToSession(base, a);
    mergeToSession(base, b);
    expect(base.thinkingLevelCount).toEqual({ low: 1, high: 3, xhigh: 1 });
  });

  // it("merges hourCost records", () => {
  //   const base = emptySession("s1", new Date("2026-06-08"), "p");
  //   const a = emptySession("", new Date(0), "");
  //   a.hourCost = { 10: 1.5 };
  //   const b = emptySession("", new Date(0), "");
  //   b.hourCost = { 10: 0.5, 14: 2.0 };
  //
  //   mergeToSession(base, a);
  //   mergeToSession(base, b);
  //   expect(base.hourCost).toEqual({ 10: 2.0, 14: 2.0 });
  // });

  it("merges model usage from multiple updates", () => {
    const base = makeEmptySession("s1", new Date("2026-06-08"), "p");
    const a = makeEmptySession("", new Date(0));
    a.models["anthropic"] = {};
    a.models["anthropic"]["sonnet"] = {
      provider: "anthropic",
      api: "anthropic-messages",
      usage: {
        cost: {
          cacheRead: 0.1,
          cacheWrite: 0.1,
          input: 0.3,
          output: 0.5,
          total: 1,
        },
        cacheRead: 50,
        cacheWrite: 10,
        input: 500,
        output: 200,
        totalTokens: 700,
      },
      calls: 2,
      asstMsgs: 2,
      tools: { bash: 1 },
      languages: { TypeScript: { lines: 10, edits: 1 } },
    };
    const b = makeEmptySession("", new Date(0), "");

    b.models["anthropic"] = {};
    b.models["anthropic"]["sonnet"] = {
      provider: "anthropic",
      api: "anthropic-messages",
      usage: {
        cost: {
          cacheRead: 0.1,
          cacheWrite: 0.1,
          input: 0.3,
          output: 0.5,
          total: 0.5,
        },
        cacheRead: 0,
        cacheWrite: 0,
        input: 100,
        output: 50,
        totalTokens: 150,
      },
      calls: 1,
      asstMsgs: 1,
      tools: { edit: 1 },
      languages: { TypeScript: { lines: 5, edits: 2 } },
    };

    mergeToSession(base, a);
    mergeToSession(base, b);
    const m = base.models["anthropic"]!["sonnet"];
    assert(m);
    expect(m.usage.cost.total).toBe(1.5);
    expect(m.calls).toBe(3);
    expect(m.usage.input).toBe(600);
    expect(m.usage.output).toBe(250);
    expect(m.usage.cacheRead).toBe(50);
    expect(m.usage.cacheWrite).toBe(10);
    expect(m.asstMsgs).toBe(3);
    expect(m.tools).toEqual({ bash: 1, edit: 1 });
    expect(m.languages["TypeScript"]!.lines).toBe(15);
    expect(m.languages["TypeScript"]!.edits).toBe(3);
  });

  it("merges multiple different models", () => {
    const base = makeEmptySession("s1", new Date("2026-06-08"), "p");
    const a = makeEmptySession("", new Date(0), "");
    a.models["anthropic"] = {
      sonnet: {
        provider: "anthropic",
        api: "anthropic-messages",
        usage: {
          cost: {
            cacheRead: 0.1,
            cacheWrite: 0.1,
            input: 0.3,
            output: 0.5,
            total: 1,
          },
          cacheRead: 0,
          cacheWrite: 0,
          input: 500,
          output: 200,
          totalTokens: 700,
        },
        calls: 1,
        asstMsgs: 2,
        tools: {},
        languages: {},
      },
    };
    const b = makeEmptySession("", new Date(0), "");
    b.models["anthropic"] = {
      haiku: {
        provider: "anthropic",
        api: "anthropic-messages",
        usage: {
          cost: {
            cacheRead: 0.1,
            cacheWrite: 0.1,
            input: 0.3,
            output: 0.5,
            total: 0.5,
          },
          cacheRead: 0,
          cacheWrite: 0,
          input: 300,
          output: 100,
          totalTokens: 400,
        },
        calls: 1,
        asstMsgs: 3,
        tools: {},
        languages: {},
      },
    };

    mergeToSession(base, a);
    mergeToSession(base, b);
    expect(Object.keys(base.models["anthropic"]!).sort()).toEqual(["haiku", "sonnet"]);
  });

  it("merges skillCost, skillCount, skillTokens, skillToolCount across updates", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay(""),
      skillCost: { tdd: 0.5, writing: 0.3 },
      skillCount: { tdd: 2, writing: 1 },
      skillTokens: { tdd: 500, writing: 200 },
      skillToolCount: { tdd: 3, writing: 1 },
    };
    const c: DayAgg = {
      ...emptyDay(""),
      skillCost: { tdd: 0.2 },
      skillCount: { tdd: 1 },
      skillTokens: { tdd: 100 },
      skillToolCount: { tdd: 2 },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.skillCost).toEqual({ tdd: 0.7, writing: 0.3 });
    expect(a.skillCount).toEqual({ tdd: 3, writing: 1 });
    expect(a.skillTokens).toEqual({ tdd: 600, writing: 200 });
    expect(a.skillToolCount).toEqual({ tdd: 5, writing: 1 });
  });

  it("deep-merges skillToolBreakdown across updates", () => {
    const a = emptyDay("2026-06-08");
    const b: DayAgg = {
      ...emptyDay(""),
      skillToolBreakdown: {
        tdd: { read: 2, edit: 1 },
        writing: { bash: 1 },
      },
    };
    const c: DayAgg = {
      ...emptyDay(""),
      skillToolBreakdown: {
        tdd: { edit: 2, write: 1 },
      },
    };

    mergeDay(a, b);
    mergeDay(a, c);
    expect(a.skillToolBreakdown).toEqual({
      tdd: { read: 2, edit: 3, write: 1 },
      writing: { bash: 1 },
    });
  });
});

// ======== End-to-end: realistic session file ========

describe("realistic session file", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-e2e-${Date.now()}`);
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
        message: { role: "user", content: "ok", timestamp: 1700000000000 },
      }),
    ];
    await writeFile(filePath, lines.join("\n"));

    const map = parseFile(filePath);

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

    const map = parseFile(filePath);

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
    const map = parseFile(filePath, (count) => {
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
    const map = parseFile(filePath, (count) => {
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

    const mapA = parseFile(fileA);
    const mapB = parseFile(fileB);

    const dayA = mapA.get("2026-06-08")!;
    expect(Object.keys(dayA.projectCost)).toEqual(["proj-alpha"]);
    expect(dayA.projectCost["proj-alpha"]).toBe(0.1);

    const dayB = mapB.get("2026-06-08")!;
    expect(Object.keys(dayB.projectCost)).toEqual(["proj-beta"]);
    expect(dayB.projectCost["proj-beta"]).toBe(0.25);
  });

  it("does not leak activeSkill across separate files", async () => {
    const fileA = join(tmpDir, "file-a.jsonl");
    await writeFile(
      fileA,
      [
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: "2026-06-08T10:00:00.000Z",
          message: mkUser('<skill name="tdd">test</skill>'),
        }),
      ].join("\n"),
    );

    const fileB = join(tmpDir, "file-b.jsonl");
    await writeFile(
      fileB,
      [
        JSON.stringify({
          type: "message",
          id: "m2",
          parentId: "p",
          timestamp: "2026-06-08T11:00:00.000Z",
          message: mkUser("no skill here"),
        }),
      ].join("\n"),
    );

    // Parse file with skill — sets activeSkill during parsing
    parseFile(fileA);

    // Parse file without skill — should reset activeSkill at start
    // so the non-skill message clears it rather than attributing to "tdd"
    const mapB = parseFile(fileB);
    const dayB = mapB.get("2026-06-08")!;
    // The second file's user message has no skill tag, so no skillCount
    expect(dayB.skillCount).toEqual({});
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
    const map = parseFile(filePath, (c) => {
      warnings = c;
    });

    // Only the user message should be counted; unknown types are silently skipped
    expect(map.size).toBe(1);
    expect(map.get("2026-06-08")?.userMsgs).toBe(1);
    expect(warnings).toBe(0);
  });

  it("end-to-end: parses and aggregates a realistic session file", async () => {
  it("parses and aggregates a realistic session file", async () => {
    const filePath = join(tmpDir, "session.jsonl");
    const lines = [
      // Session header — establishes project "pi-tui-extras"
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s-main",
        timestamp: "2026-06-10T09:00:00.000Z",
        cwd: "/home/doe/dev/pi-tui-extras",
      } satisfies SessionHeader),
      // User message
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "s-main",
        timestamp: "2026-06-10T09:01:00.000Z",
        message: {
          role: "user",
          content: "add logging",
          timestamp: 1700000000000,
        } satisfies UserMessage,
      }),
      // Assistant message with cost + edit tool call
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-10T09:02:00.000Z",
        message: makeAssistantMessage({
          content: [
            { type: "text", text: "sure" },
            makeToolCall({
              name: "edit",
              arguments: { path: "/src/lib.ts", edits: [{ newText: "console.log(1)\n" }] },
            }),
            makeToolCall({
              name: "write",
              arguments: { path: "/src/log.rs", content: "fn log() {}" },
              id: "c2",
            }),
            makeToolCall({ name: "read", arguments: { path: "/src/main.ts" }, id: "c3" }),
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
      } as SessionMessageEntry),
      // Tool result
      JSON.stringify({
        type: "message",
        id: "m3",
        parentId: "m2",
        timestamp: "2026-06-10T09:02:30.000Z",
        message: makeToolResult({ toolName: "edit" }),
      } as SessionMessageEntry),
      // Model change
      JSON.stringify({
        type: "model_change",
        id: "mc1",
        parentId: "m3",
        timestamp: "2026-06-10T09:05:00.000Z",
        provider: "deepseek",
        modelId: "deepseek-v4",
      } satisfies ModelChangeEntry),
      // Compaction
      JSON.stringify({
        type: "compaction",
        id: "c1",
        parentId: "mc1",
        timestamp: "2026-06-10T09:10:00.000Z",
        summary: "mid-session compact",
        firstKeptEntryId: "m1",
        tokensBefore: 30000,
      } satisfies CompactionEntry),
    ];
    await writeFile(filePath, lines.join("\n"));

    const session = parseFile(filePath)!;

    // Session tracking
    expect(session.sessionId).toBe("s-main");
    expect(session.project).toBe("pi-tui-extras");

    // Message counts
    expect(session.userMsgs).toBe(1);
    expect(session.toolResults).toBe(1);

    // Model usage
    const m = session.models["anthropic"]!["sonnet-v3"];
    assert(m);
    expect(m.usage.cost.total).toBe(0.0053);
    // expect(m.calls).toBe(1);
    expect(m.usage.input).toBe(500);
    expect(m.usage.output).toBe(200);
    expect(m.usage.cacheRead).toBe(50);
    expect(m.usage.cacheWrite).toBe(10);
    expect(m.asstMsgs).toBe(1);
    expect(m.provider).toBe("anthropic");

    // Tool calls attributed to model
    expect(m.tools["edit"]).toBe(1);
    expect(m.tools["write"]).toBe(1);
    expect(m.tools["read"]).toBe(1);

    // Language attribution per-model
    expect(m.languages["TypeScript"]!.lines).toBe(2);
    expect(m.languages["TypeScript"]!.edits).toBe(1);
    expect(m.languages["Rust"]!.lines).toBe(1);
    expect(m.languages["Rust"]!.edits).toBe(0);

    // Non-cost-relevant entry types
    expect(session.modelChanges).toBe(1);
    expect(session.compactionCount).toBe(1);
    expect(session.compactedTokens).toBe(30000);
  });
});
