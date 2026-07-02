import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makeMockTUI, makeRangeSelector, makeTheme } from "../components/components.fixtures";
import { Dashboard } from "../components/Dashboard";
import { allRanges } from "../components/Dashboard.test";
import { summarize } from "../compute";
import { parseFile } from "../parser";
import type {
  SessionEntry,
  SessionHeader,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";
import type { AssistantMessage, ToolCall, UserMessage } from "@earendil-works/pi-ai";
import { makeAssistantMessage, makeToolCall } from "./factories/pi.factory";

const mockTui = makeMockTUI();

describe("JSONL → Dashboard", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-integration-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("end-to-end: JSONL with session and messages → Dashboard Overview shows KPIs", async () => {
    const filePath = join(tmpDir, "session.jsonl");
    const sessionTime = "2026-06-08T10:00:00.000Z";
    const messageTime = "2026-06-08T10:01:00.000Z";
    const messageTimestamp = Math.floor(new Date(messageTime).getTime() / 1000);
    const assistantMessageTime = "2026-06-08T10:02:00.000Z";
    const assistantMessageTimestamp = Math.floor(new Date(assistantMessageTime).getTime() / 1000);

    const jsonlLines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: sessionTime,
        cwd: "/home/doe/proj",
      } satisfies SessionHeader),
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: messageTime,
        message: {
          role: "user",
          timestamp: messageTimestamp,
          content: [{ type: "text", text: "hello" }],
        } satisfies UserMessage,
      } satisfies SessionMessageEntry),
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: assistantMessageTime,
        message: makeAssistantMessage({
          timestamp: assistantMessageTimestamp,
          content: [
            { type: "text", text: "hi there" },
            makeToolCall({
              id: "t1",
              name: "edit",
              arguments: { path: "/src/foo.ts", edits: [{ newText: "abc" }] },
            }),
          ],
          api: "anthropic-messages",
          provider: "anthropic",
          stopReason: "stop",
          model: "claude-sonnet-4-20250514",
          usage: {
            input: 200,
            output: 100,
            cacheRead: 10,
            cacheWrite: 0,
            totalTokens: 310,
            cost: {
              input: 0.001,
              output: 0.0005,
              cacheRead: 0.00001,
              cacheWrite: 0,
              total: 0.00151,
            },
          },
        }),
      } satisfies SessionMessageEntry),
    ];
    await writeFile(filePath, jsonlLines.join("\n"));

    // Parse
    const session = parseFile(filePath);
    expect(session).not.toBeNull();
    const sessions = [session!];

    // Summarize for all ranges
    const ranges = allRanges;
    const summaries = new Map(ranges.map((r) => [r, summarize(sessions, r)] as const));

    // Render dashboard
    const dash = new Dashboard(
      summaries,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
    const rendered = dash.render(80);
    const text = rendered.join("\n");

    // Should contain dashboard chrome
    expect(text).toContain("Overview");
    expect(text).toContain("Languages");
    expect(text).toContain("Models");
    expect(text).toContain("Projects");
    expect(text).toContain("Usage");

    expect(text).toContain("$0.0015");
    expect(text).toContain("310");

    expect(text).toContain("proj");
    expect(text).toContain("TypeScript");
    expect(text).toContain("Claude Sonnet 4");

    // Range selector
    expect(rendered[0]).toContain("Pi Atlas");
    expect(rendered[0]).toContain("All time [r]");
  });

  it("end-to-end: Navigate to Languages tab shows ranked table from parsed data", async () => {
    const filePath = join(tmpDir, "lang-session.jsonl");
    const sessionTime = "2026-06-08T10:00:00.000Z";
    const assistantMessageTime = "2026-06-08T10:02:00.000Z";
    const assistantMessageTimestamp = Math.floor(new Date(assistantMessageTime).getTime() / 1000);
    const jsonlLines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: sessionTime,
        cwd: "/home/doe/proj",
      } as SessionHeader),
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: assistantMessageTime,
        message: makeAssistantMessage({
          provider: "anthropic",
          stopReason: "stop",
          timestamp: assistantMessageTimestamp,
          api: "anthropic-messages",
          content: [
            makeToolCall({
              id: "t1",
              name: "edit",
              arguments: { path: "/src/main.ts", edits: [{ newText: "console.log('hi')" }] },
            }),
            makeToolCall({
              type: "toolCall",
              id: "t2",
              name: "write",
              arguments: { path: "/src/lib.rs", content: "fn main() {}" },
            }),
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
        }),
      } satisfies SessionMessageEntry),
    ];
    await writeFile(filePath, jsonlLines.join("\n"));

    const session = parseFile(filePath);
    expect(session).not.toBeNull();
    const sessions = [session!];
    const ranges = allRanges;
    const summaries = new Map(ranges.map((r) => [r, summarize(sessions, r)] as const));

    const dash = new Dashboard(
      summaries,
      makeTheme(),
      mockTui,
      null,
      makeRangeSelector(makeTheme()),
    );
    // Navigate to Languages tab (index 1)
    dash.handleInput("\x1b[C"); // right arrow

    const rendered = dash.render(80);
    const text = rendered.join("\n");

    // Should show language data from parsed file
    expect(text).toContain("TypeScript");
    expect(text).toContain("Rust");
  });

  it("end-to-end: JSONL with skill tag → parse → summarize → SkillStat output", async () => {
    const filePath = join(tmpDir, "skill-session.jsonl");
    const sessionTime = "2026-06-15T10:00:00.000Z";
    const userMsgTime = "2026-06-15T10:01:00.000Z";
    const assistantTime = "2026-06-15T10:02:00.000Z";
    const assistantTimestamp = Math.floor(new Date(assistantTime).getTime() / 1000);

    const jsonlLines = [
      JSON.stringify({
        type: "session",
        version: 3,
        id: "skill-s1",
        timestamp: sessionTime,
        cwd: "/home/doe/proj-skill",
      } as SessionHeader),
      // User message with skill tag
      JSON.stringify({
        type: "message",
        id: "m1",
        parentId: "p",
        timestamp: userMsgTime,
        message: {
          role: "user",
          timestamp: Math.floor(new Date(userMsgTime).getTime() / 1000),
          content: '<skill name="tdd">Add tests',
        } as UserMessage,
      } as SessionMessageEntry),
      // Assistant response — cost attributed to tdd skill
      JSON.stringify({
        type: "message",
        id: "m2",
        parentId: "m1",
        timestamp: assistantTime,
        message: makeAssistantMessage({
          timestamp: assistantTimestamp,
          content: [
            { type: "text", text: "here you go" },
            makeToolCall({ id: "t1", name: "edit", arguments: { path: "/src/foo.ts", edits: [{ newText: "test" }] } }),
          ],
          api: "anthropic-messages",
          provider: "anthropic",
          stopReason: "stop",
          model: "claude-sonnet-4-20250514",
          usage: {
            input: 200,
            output: 100,
            cacheRead: 10,
            cacheWrite: 0,
            totalTokens: 310,
            cost: {
              input: 0.001,
              output: 0.0005,
              cacheRead: 0.00001,
              cacheWrite: 0,
              total: 0.00151,
            },
          },
        }),
      } as SessionMessageEntry),
    ];
    await writeFile(filePath, jsonlLines.join("\n"));

    const session = parseFile(filePath);
    expect(session).not.toBeNull();
    expect(Object.keys(session!.skills)).toContain("tdd");

    const result = summarize([session!], "All");
    expect(result.skills).toHaveLength(1);
    expect(result.skills[0]).toMatchObject({
      name: "tdd",
      calls: 1,
      sessions: 1,
    });
    expect(result.skills[0]!.cost).toBeGreaterThan(0);
    expect(result.skills[0]!.tokens).toBeGreaterThan(0);
  });
});
