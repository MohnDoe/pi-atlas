import type { UserMessage } from "@earendil-works/pi-ai";
import type {
  SessionEntry,
  SessionHeader,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  type LoadingProgress,
  computeSignature,
  getCacheTimestamp,
  isCacheValid,
  loadAggregate,
  readCache,
  writeCache,
} from "./cache";
import { emptySession } from "./parser";
import type { SessionAgg } from "./types";
import type { Session } from "node:inspector";

describe("computeSignature", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty string for empty directory", async () => {
    const sig = await computeSignature(tmpDir);
    expect(sig).toBe("");
  });

  it("returns a non-empty hash for a directory with files", async () => {
    await writeFile(join(tmpDir, "a.jsonl"), "line1\n");
    await writeFile(join(tmpDir, "b.jsonl"), "line2\n");

    const sig1 = await computeSignature(tmpDir);
    expect(sig1).toBeTruthy();
    expect(sig1.length).toBeGreaterThan(0);

    // Same directory, same signature
    const sig2 = await computeSignature(tmpDir);
    expect(sig2).toBe(sig1);
  });

  it("changes when a file is modified", async () => {
    await writeFile(join(tmpDir, "a.jsonl"), "original\n");
    const sig1 = await computeSignature(tmpDir);

    await writeFile(join(tmpDir, "a.jsonl"), "modified\n");
    const sig2 = await computeSignature(tmpDir);

    expect(sig2).not.toBe(sig1);
  });

  it("changes when a file is added", async () => {
    await writeFile(join(tmpDir, "a.jsonl"), "data\n");
    const sig1 = await computeSignature(tmpDir);

    await writeFile(join(tmpDir, "b.jsonl"), "more\n");
    const sig2 = await computeSignature(tmpDir);

    expect(sig2).not.toBe(sig1);
  });

  it("scans subdirectories", async () => {
    const subDir = join(tmpDir, "project-a");
    await mkdir(subDir);
    await writeFile(join(subDir, "s1.jsonl"), "data\n");

    const sig = await computeSignature(tmpDir);
    expect(sig).toBeTruthy();
    expect(sig.length).toBeGreaterThan(0);
  });

  it("scans nested subdirectories two levels deep", async () => {
    const lvl1 = join(tmpDir, "project-a");
    const lvl2 = join(lvl1, "nested");
    await mkdir(lvl2, { recursive: true });
    await writeFile(join(lvl2, "s1.jsonl"), "data\n");

    const sig = await computeSignature(tmpDir);
    expect(sig).toBeTruthy();
    expect(sig.length).toBeGreaterThan(0);
  });

  it("ignores non-.jsonl files", async () => {
    await writeFile(join(tmpDir, "README.md"), "docs\n");
    const sig = await computeSignature(tmpDir);
    expect(sig).toBe("");
  });
});

// ---- isCacheValid (unchanged semantics) ----

describe("isCacheValid", () => {
  let tmpDir: string;
  let cachePath: string;
  let sessionsDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-isvalid-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    cachePath = join(tmpDir, "cache.json");
    sessionsDir = join(tmpDir, "sessions");
    await mkdir(sessionsDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns false when cache file does not exist", async () => {
    const valid = await isCacheValid(cachePath, sessionsDir);
    expect(valid).toBe(false);
  });

  it("returns false when cache signature differs from current", async () => {
    await writeFile(join(sessionsDir, "s1.jsonl"), "data\n");
    const sig = await computeSignature(sessionsDir);
    const s = emptySession("s1", new Date("2026-06-08"), "p");
    await writeCache(cachePath, sig, [s]);

    const validBefore = await isCacheValid(cachePath, sessionsDir);
    expect(validBefore).toBe(true);

    // Add a session file that changes the real signature
    await writeFile(join(sessionsDir, "s2.jsonl"), "data\n");

    const valid = await isCacheValid(cachePath, sessionsDir);
    expect(valid).toBe(false);
  });

  it("returns true when cache signature matches current", async () => {
    await writeFile(join(sessionsDir, "s1.jsonl"), "data\n");
    const sig = await computeSignature(sessionsDir);
    const s = emptySession("s1", new Date("2026-06-08"), "p");
    await writeCache(cachePath, sig, [s]);

    const valid = await isCacheValid(cachePath, sessionsDir);
    expect(valid).toBe(true);
  });
});

// ---- cache read/write with SessionAgg ----

describe("cache read/write", () => {
  let tmpDir: string;
  let cachePath: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-cache-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    cachePath = join(tmpDir, "cache.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads SessionAgg array", async () => {
    const s = emptySession("s1", new Date(), "my-app");
    s.userMsgs = 3;
    s.toolResults = 1;
    s.models["sonnet"] = {
      provider: "anthropic",
      cost: 1.5,
      calls: 2,
      inTok: 500,
      outTok: 200,
      crTok: 50,
      cwTok: 10,
      asstMsgs: 2,
      tools: { bash: 1, read: 3 },
      languages: { TypeScript: { lines: 100, edits: 5 } },
    };
    const sessions: SessionAgg[] = [s];
    await writeCache(cachePath, "sig-abc", sessions);

    const payload = await readCache(cachePath);
    expect(payload).toBeDefined();
    expect(payload!.signature).toBe("sig-abc");
    expect(payload!.sessions).toHaveLength(1);
    const s0 = payload!.sessions[0]!;
    expect(s0.sessionId).toBe("s1");
    expect(s0.timestamp).toBe(s.timestamp);
    expect(s0.project).toBe("my-app");
    expect(s0.userMsgs).toBe(3);
    expect(s0.toolResults).toBe(1);
    const m0 = s0.models["sonnet"]!;
    expect(m0.cost).toBe(1.5);
    expect(m0.provider).toBe("anthropic");
    expect(m0.tools).toEqual({ bash: 1, read: 3 });
    expect(m0.languages["TypeScript"]).toEqual({
      lines: 100,
      edits: 5,
    });
  });

  it("returns null for missing cache file", async () => {
    const payload = await readCache("/nonexistent/path/cache.json");
    expect(payload).toBeNull();
  });

  it("returns null for corrupt cache", async () => {
    await writeFile(cachePath, "not-json");
    const payload = await readCache(cachePath);
    expect(payload).toBeNull();
  });

  it("returns null when cached JSON lacks a signature", async () => {
    await writeFile(cachePath, JSON.stringify({ sessions: [] }));
    const payload = await readCache(cachePath);
    expect(payload).toBeNull();
  });

  it("returns null when cached JSON has signature but sessions is not an array", async () => {
    await writeFile(cachePath, JSON.stringify({ signature: "sig", sessions: {} }));
    const payload = await readCache(cachePath);
    expect(payload).toBeNull();
  });

  it("returns generatedAt from valid cache", async () => {
    const s = emptySession("s1", new Date("2026-06-08"), "p");
    await writeCache(cachePath, "sig-abc", [s]);
    const ts = await getCacheTimestamp(cachePath);
    expect(ts).not.toBeNull();
    expect(new Date(ts!).toISOString()).toBe(ts as string);
  });

  it("returns null for missing cache", async () => {
    const ts = await getCacheTimestamp("/nonexistent/cache.json");
    expect(ts).toBeNull();
  });
});

// ---- loadAggregate ----

describe("loadAggregate", () => {
  let tmpDir: string;
  let sessionsDir: string;
  let cachePath: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-atlas-load-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    sessionsDir = join(tmpDir, "sessions");
    await mkdir(sessionsDir, { recursive: true });
    cachePath = join(tmpDir, "cache.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for empty sessions dir", async () => {
    const sessions = await loadAggregate(cachePath, sessionsDir);
    expect(sessions).toEqual([]);
  });

  it("parses session files and returns SessionAgg array", async () => {
    const subDir = join(sessionsDir, "proj-a");
    const sessionTime = "2026-06-08T10:00:00.000Z";
    const messageTime = "2026-06-08T10:01:00.000Z";
    const messageTimestamp = Math.floor(new Date(messageTime).getHours() / 1000);
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: sessionTime,
          cwd: "/home/doe/proj-a",
        } satisfies SessionHeader),
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: messageTime,
          message: {
            role: "user",
            content: [{ type: "text", text: "hi" }],
            timestamp: messageTimestamp,
          } satisfies UserMessage,
        } satisfies SessionMessageEntry),
      ].join("\n"),
    );

    const sessions = await loadAggregate(cachePath, sessionsDir);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.sessionId).toBe("s1");
    expect(sessions[0]!.timestamp).toBe(sessionTime);
    expect(sessions[0]!.project).toBe("proj-a");
    expect(sessions[0]!.userMsgs).toBe(1);
  });

  it("returns one SessionAgg per file", async () => {
    const projA = join(sessionsDir, "proj-a");
    const projB = join(sessionsDir, "proj-b");
    await mkdir(projA, { recursive: true });
    await mkdir(projB, { recursive: true });

    const firstSessionTime = "2026-06-08T10:00:00.000Z";
    const firstMessageTime = "2026-06-08T10:01:00.000Z";
    const firstMessageTimestamp = Math.floor(new Date(firstMessageTime).getHours() / 1000);
    const secondSessionTime = "2026-06-08T14:00:00.000Z";
    const secondMessageTime = "2026-06-08T14:01:00.000Z";
    const secondMessageTimestamp = Math.floor(new Date(secondMessageTime).getHours() / 1000);
    // Two files, same date, different sessions
    await writeFile(
      join(projA, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: firstSessionTime,
          cwd: "/home/doe/proj-a",
        } satisfies SessionHeader),
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: firstMessageTime,
          message: {
            role: "user",
            timestamp: firstMessageTimestamp,
            content: [{ type: "text", text: "hi from a" }],
          } satisfies UserMessage,
        } satisfies SessionMessageEntry),
      ].join("\n"),
    );

    await writeFile(
      join(projB, "s2.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s2",
          timestamp: secondSessionTime,
          cwd: "/home/doe/proj-b",
        } satisfies SessionHeader),
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: secondMessageTime,
          message: {
            role: "user",
            timestamp: secondMessageTimestamp,
            content: [{ type: "text", text: "hi from b" }],
          } satisfies UserMessage,
        } satisfies SessionMessageEntry),
      ].join("\n"),
    );

    const sessions = await loadAggregate(cachePath, sessionsDir, true);
    expect(sessions).toHaveLength(2); // Two separate sessions now
    expect(sessions[0]!.sessionId).toBe("s1");
    expect(sessions[0]!.project).toBe("proj-a");
    expect(sessions[0]!.userMsgs).toBe(1);
    expect(sessions[1]!.sessionId).toBe("s2");
    expect(sessions[1]!.project).toBe("proj-b");
    expect(sessions[1]!.userMsgs).toBe(1);
  });

  it("writes a cache file on disk after parsing", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        } satisfies SessionHeader),
      ].join("\n"),
    );

    await loadAggregate(cachePath, sessionsDir);

    // Verify the cache file was written
    const payload = await readCache(cachePath);
    expect(payload).not.toBeNull();
    expect(payload!.sessions).toHaveLength(1);
    expect(payload!.sessions[0]!.sessionId).toBe("s1");
    expect(payload!.sessions[0]!.timestamp).toBe("2026-06-08T10:00:00.000Z");
    expect(payload!.generatedAt).toBeTruthy();

    // Verify the signature corresponds to the actual session files
    const realSig = await computeSignature(sessionsDir);
    expect(payload!.signature).toBe(realSig);
  });

  it("caches results and reuses them", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
      ].join("\n"),
    );

    const sessions1 = await loadAggregate(cachePath, sessionsDir);
    expect(sessions1).toHaveLength(1);

    // Second call should use cache
    const sessions2 = await loadAggregate(cachePath, sessionsDir);
    expect(sessions2).toHaveLength(1);
  });

  it("invalidates cache when session files change", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
      ].join("\n"),
    );

    await loadAggregate(cachePath, sessionsDir);

    // Add a new file
    await writeFile(
      join(subDir, "s2.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s2",
          timestamp: "2026-06-09T10:00:00.000Z",
          cwd: "/home/doe/proj-b",
        }),
      ].join("\n"),
    );

    const sessions = await loadAggregate(cachePath, sessionsDir);
    expect(sessions).toHaveLength(2); // two sessions now
  });

  it("logs corrupt line count to stderr", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);

    const sessionTime = "2026-06-08T10:00:00.000Z";
    const messageTime = "2026-06-08T10:01:00.000Z";
    const messageTimestamp = Math.floor(new Date(messageTime).getHours() / 1000);
    await writeFile(
      join(subDir, "mixed.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: sessionTime,
          cwd: "/home/doe/proj-a",
        } satisfies SessionHeader),
        "not valid json",
        "also broken {",
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: messageTime,
          message: {
            role: "user",
            timestamp: messageTimestamp,
            content: [{ type: "text", text: "hi" }],
          } satisfies UserMessage,
        } satisfies SessionMessageEntry),
      ].join("\n"),
    );

    const errors: string[] = [];
    const spy = spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      errors.push(args.join(" "));
    });

    try {
      await loadAggregate(cachePath, sessionsDir, true);

      expect(errors.length).toBeGreaterThan(0);
      const warning = errors.find((e) => e.includes("corrupt"));
      expect(warning).toBeDefined();
      expect(warning).toContain("2"); // 2 corrupt lines
    } finally {
      spy.mockRestore();
    }
  });

  it("force=true re-parses even when valid cache exists", async () => {
    // Create a session file
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    const sessionTime = "2026-06-08T10:00:00.000Z";
    const messageTime = "2026-06-08T10:01:00.000Z";
    const messageTimestamp = Math.floor(new Date(messageTime).getHours() / 1000);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: sessionTime,
          cwd: "/home/doe/proj-a",
        }),
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: messageTime,
          message: {
            role: "user",
            timestamp: messageTimestamp,
            content: [{ type: "text", text: "hi" }],
          } satisfies UserMessage,
        } satisfies SessionMessageEntry),
      ].join("\n"),
    );

    // Compute the real signature for these files
    const realSig = await computeSignature(sessionsDir);

    // Write a cache file directly with the correct signature but STALE data
    await writeFile(
      cachePath,
      JSON.stringify({
        signature: realSig,
        generatedAt: new Date().toISOString(),
        sessions: [
          {
            date: "2026-06-08",
            sessionId: "s1",
            project: "proj-a",
            models: {},
            userMsgs: 9999, // stale: real data has 1
            toolResults: 0,
            compactionCount: 0,
            compactedTokens: 0,
            modelChanges: 0,
            thinkingLevelCount: {},
            hourCost: {},
          },
        ],
      }),
    );

    // force=true should ignore the stale cache and re-parse
    const sessions = await loadAggregate(cachePath, sessionsDir, true);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.userMsgs).toBe(1);
  });

  it("calls onProgress during parsing", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
      ].join("\n"),
    );

    const progress: LoadingProgress[] = [];
    await loadAggregate(cachePath, sessionsDir, false, (p) => progress.push(p));

    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]!.pct).toBe(100);
  });

  it("reports intermediate progress with multiple files", async () => {
    const projA = join(sessionsDir, "a");
    const projB = join(sessionsDir, "b");
    await mkdir(projA, { recursive: true });
    await mkdir(projB, { recursive: true });

    await writeFile(
      join(projA, "s1.jsonl"),
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/p",
      }) + "\n",
    );
    await writeFile(
      join(projB, "s2.jsonl"),
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s2",
        timestamp: "2026-06-09T10:00:00.000Z",
        cwd: "/p",
      }) + "\n",
    );

    const progress: LoadingProgress[] = [];
    await loadAggregate(cachePath, sessionsDir, true, (p) => progress.push(p));

    expect(progress.map((p) => p.pct)).toEqual([50, 100]);
  });
});
