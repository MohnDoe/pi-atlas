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
  getActiveSkills,
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
  resetActiveSkills,
} from "./parser";
import { makeAssistantMessage, makeToolCall, makeToolResult } from "./tests/factories/pi.factory";

describe("parseFile — SessionAgg", () => {
  let tmpDir: string;

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

  it("merges skills records — sums cost/tokens/calls", () => {
    const base = makeEmptySession("s1", new Date("2026-06-08"), "p");
    base.skills = {
      tdd: { cost: 0.01, tokens: { input: 100, output: 50, total: 150 }, calls: 1 },
      "grill-me": { cost: 0.02, tokens: { input: 200, output: 100, total: 300 }, calls: 1 },
    };

    const update = makeEmptySession("", new Date(0), "");
    update.skills = {
      tdd: { cost: 0.005, tokens: { input: 50, output: 25, total: 75 }, calls: 1 },
      "to-prd": { cost: 0.01, tokens: { input: 80, output: 40, total: 120 }, calls: 1 },
    };

    mergeToSession(base, update);

    // tdd: sums cost/tokens, calls=2 (two separate invocations)
    expect(base.skills["tdd"]!.cost).toBe(0.015);
    expect(base.skills["tdd"]!.tokens.input).toBe(150);
    expect(base.skills["tdd"]!.tokens.output).toBe(75);
    expect(base.skills["tdd"]!.tokens.total).toBe(225);
    expect(base.skills["tdd"]!.calls).toBe(2);

    // grill-me: unchanged (not in update)
    expect(base.skills["grill-me"]!.cost).toBe(0.02);

    // to-prd: new from update
    expect(base.skills["to-prd"]!.cost).toBe(0.01);
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

  it("parses a session with skill invocations and attributes cost", async () => {
    const filePath = join(tmpDir, "skill-session.jsonl");
    const lines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s-skill",
        timestamp: "2026-06-12T10:00:00.000Z",
        cwd: "/home/doe/dev/my-app",
      } satisfies SessionHeader),
      // User message with explicit skill tag
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "s-skill",
        timestamp: "2026-06-12T10:01:00.000Z",
        message: {
          role: "user",
          content: '<skill name="tdd">Add tests',
          timestamp: 1700000000000,
        } satisfies UserMessage,
      }),
      // Assistant: does the work (cost attributed to tdd)
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-12T10:03:00.000Z",
        message: makeAssistantMessage({
          content: [
            makeToolCall({
              name: "edit",
              id: "c1",
              arguments: { path: "/src/test.ts", edits: [{ newText: "it('works', () => {})" }] },
            }),
          ],
          model: "sonnet",
          provider: "anthropic",
          usage: {
            input: 500,
            output: 300,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 800,
            cost: { input: 0.005, output: 0.006, cacheRead: 0, cacheWrite: 0, total: 0.011 },
          },
        }),
      } as SessionMessageEntry),
    ];
    await writeFile(filePath, lines.join("\n"));

    const session = parseFile(filePath)!;

    expect(session.sessionId).toBe("s-skill");
    expect(session.project).toBe("my-app");

    // Skill detection: user tag sets active skill
    expect(session.skills["tdd"]).toBeDefined();
    expect(session.skills["tdd"]!.cost).toBe(0.011);
    expect(session.skills["tdd"]!.tokens).toEqual({ input: 500, output: 300, total: 800 });
    expect(session.skills["tdd"]!.calls).toBe(1);
  });

  it("parses a session with skill switching mid-session", async () => {
    const filePath = join(tmpDir, "skill-switch.jsonl");
    const lines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s-switch",
        timestamp: "2026-06-12T10:00:00.000Z",
        cwd: "/home/doe/dev/my-app",
      } satisfies SessionHeader),
      // Turn 1: tdd
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "s-switch",
        timestamp: "2026-06-12T10:01:00.000Z",
        message: {
          role: "user",
          content: '<skill name="tdd">Add tests',
          timestamp: 1700000000000,
        } satisfies UserMessage,
      }),
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: "2026-06-12T10:02:00.000Z",
        message: makeAssistantMessage({
          content: [{ type: "text", text: "Writing tests..." }],
          model: "sonnet",
          provider: "anthropic",
          usage: {
            input: 100, output: 50, cacheRead: 0, cacheWrite: 0, totalTokens: 150,
            cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
          },
        }),
      } as SessionMessageEntry),
      // Turn 2: grill-me — new user message resets, new skill
      JSON.stringify({
        type: "message",
        id: "m3",
        parentId: "m2",
        timestamp: "2026-06-12T10:05:00.000Z",
        message: {
          role: "user",
          content: '<skill name="grill-me">Review my design',
          timestamp: 1700000003000,
        } satisfies UserMessage,
      }),
      JSON.stringify({
        type: "message",
        id: "m4",
        parentId: "m3",
        timestamp: "2026-06-12T10:06:00.000Z",
        message: makeAssistantMessage({
          content: [{ type: "text", text: "Let me grill your plan..." }],
          model: "sonnet",
          provider: "anthropic",
          usage: {
            input: 200, output: 100, cacheRead: 0, cacheWrite: 0, totalTokens: 300,
            cost: { input: 0.002, output: 0.004, cacheRead: 0, cacheWrite: 0, total: 0.006 },
          },
        }),
      } as SessionMessageEntry),
    ];
    await writeFile(filePath, lines.join("\n"));

    const session = parseFile(filePath)!;

    expect(session.sessionId).toBe("s-switch");
    expect(session.project).toBe("my-app");

    // tdd: cost and tokens from turn 1, calls = 1
    expect(session.skills["tdd"]).toBeDefined();
    expect(session.skills["tdd"]!.cost).toBe(0.003);
    expect(session.skills["tdd"]!.tokens).toEqual({ input: 100, output: 50, total: 150 });
    expect(session.skills["tdd"]!.calls).toBe(1);

    // grill-me: cost and tokens from turn 2, calls = 1
    expect(session.skills["grill-me"]).toBeDefined();
    expect(session.skills["grill-me"]!.cost).toBe(0.006);
    expect(session.skills["grill-me"]!.tokens).toEqual({ input: 200, output: 100, total: 300 });
    expect(session.skills["grill-me"]!.calls).toBe(1);

    // Each skill has exactly 1 call (one invocation each)
    expect(session.skills["tdd"]!.calls).toBe(1);
    expect(session.skills["grill-me"]!.calls).toBe(1);
  });
});

// ======== Skill detection ========

describe("skill detection — parseUserMessage", () => {
  beforeEach(() => {
    resetActiveSkills();
  });

  it("detects <skill name=\"tdd\"> and pushes to active stack", () => {
    parseUserMessage({
      role: "user",
      content: '<skill name="tdd">',
      timestamp: Date.now(),
    });

    expect(getActiveSkills()).toBe("tdd");
  });

  it("resets the active stack at the start of each parseUserMessage", () => {
    parseUserMessage({
      role: "user",
      content: '<skill name="tdd">',
      timestamp: Date.now(),
    });
    expect(getActiveSkills()).toBe("tdd");

    parseUserMessage({
      role: "user",
      content: "just a normal message",
      timestamp: Date.now(),
    });
    expect(getActiveSkills()).toBeNull();
  });

  it("user message without skill tags leaves empty stack", () => {
    parseUserMessage({
      role: "user",
      content: "hello world",
      timestamp: Date.now(),
    });

    expect(getActiveSkills()).toBeNull();
  });

  it("last skill tag wins when multiple are present", () => {
    parseUserMessage({
      role: "user",
      content: '<skill name="tdd"><skill name="grill-me">',
      timestamp: Date.now(),
    });

    expect(getActiveSkills()).toBe("grill-me");
  });

  it("same tag repeated still resolves to that skill", () => {
    parseUserMessage({
      role: "user",
      content: '<skill name="tdd"><skill name="tdd">',
      timestamp: Date.now(),
    });

    expect(getActiveSkills()).toBe("tdd");
  });
});

describe("skill detection — cost attribution in parseAssistantMessage", () => {
  beforeEach(() => {
    resetActiveSkills();
  });

  const costMsg = makeAssistantMessage({
    model: "gpt-5",
    provider: "openai",
    content: [{ type: "text", text: "ok" }],
    usage: {
      input: 100,
      output: 50,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 150,
      cost: { input: 0.001, output: 0.002, cacheRead: 0, cacheWrite: 0, total: 0.003 },
    },
  });

  it("attributes cost to skills on the active stack", () => {
    // Set up a skill on the stack
    parseUserMessage({
      role: "user",
      content: '<skill name="tdd">',
      timestamp: Date.now(),
    });

    const s = parseAssistantMessage(costMsg);
    expect(s.skills["tdd"]).toBeDefined();
    expect(s.skills["tdd"]!.cost).toBe(0.003);
    expect(s.skills["tdd"]!.tokens).toEqual({ input: 100, output: 50, total: 150 });
    expect(s.skills["tdd"]!.calls).toBe(1);
  });

  it("returns empty skills when stack is empty", () => {
    const s = parseAssistantMessage(costMsg);
    expect(s.skills).toEqual({});
  });

  it("accumulates cost across multiple assistant messages (calls stays at 1)", () => {
    parseUserMessage({
      role: "user",
      content: '<skill name="tdd">',
      timestamp: Date.now(),
    });

    const s1 = parseAssistantMessage(costMsg);
    const s2 = parseAssistantMessage(costMsg);

    // s1 and s2 are separate SessionAgg objects — merge them
    const merged = makeEmptySession("s1", new Date(), "p");
    mergeToSession(merged, s1);
    mergeToSession(merged, s2);

    expect(merged.skills["tdd"]!.cost).toBe(0.006);
    expect(merged.skills["tdd"]!.tokens).toEqual({ input: 200, output: 100, total: 300 });
    // calls should stay at 1 — incremented once per invocation, not per message
    expect(merged.skills["tdd"]!.calls).toBe(1);
  });

  it("last tag wins when multiple skill tags present — cost goes to last one", () => {
    parseUserMessage({
      role: "user",
      content: '<skill name="tdd"><skill name="to-prd">',
      timestamp: Date.now(),
    });

    const s = parseAssistantMessage(costMsg);
    expect(s.skills["tdd"]).toBeUndefined();
    expect(s.skills["to-prd"]!.cost).toBe(0.003);
    expect(s.skills["to-prd"]!.calls).toBe(1);
  });
});
