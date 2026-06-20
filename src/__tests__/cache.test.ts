import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeSignature,
  getCacheTimestamp,
  loadAggregate,
  readCache,
  writeCache,
} from "../cache";
import { emptyDay } from "../parser";
import { type DayAgg } from "../types";

describe("computeSignature", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-usage-test-${Date.now()}`);
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
    await Bun.write(join(tmpDir, "a.jsonl"), "line1\n");
    await Bun.write(join(tmpDir, "b.jsonl"), "line2\n");

    const sig1 = await computeSignature(tmpDir);
    expect(sig1).toBeTruthy();
    expect(sig1.length).toBeGreaterThan(0);

    // Same directory, same signature
    const sig2 = await computeSignature(tmpDir);
    expect(sig2).toBe(sig1);
  });

  it("changes when a file is modified", async () => {
    await Bun.write(join(tmpDir, "a.jsonl"), "original\n");
    const sig1 = await computeSignature(tmpDir);

    await Bun.write(join(tmpDir, "a.jsonl"), "modified\n");
    const sig2 = await computeSignature(tmpDir);

    expect(sig2).not.toBe(sig1);
  });

  it("changes when a file is added", async () => {
    await Bun.write(join(tmpDir, "a.jsonl"), "data\n");
    const sig1 = await computeSignature(tmpDir);

    await Bun.write(join(tmpDir, "b.jsonl"), "more\n");
    const sig2 = await computeSignature(tmpDir);

    expect(sig2).not.toBe(sig1);
  });

  it("scans subdirectories", async () => {
    const subDir = join(tmpDir, "project-a");
    await mkdir(subDir);
    await Bun.write(join(subDir, "s1.jsonl"), "data\n");

    const sig = await computeSignature(tmpDir);
    expect(sig).toBeTruthy();
    expect(sig.length).toBeGreaterThan(0);
  });

  it("ignores non-.jsonl files", async () => {
    await Bun.write(join(tmpDir, "README.md"), "docs\n");
    const sig = await computeSignature(tmpDir);
    expect(sig).toBe("");
  });
});

describe("cache read/write", () => {
  let tmpDir: string;
  let cachePath: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-usage-cache-test-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    cachePath = join(tmpDir, "cache.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("writes and reads cache", async () => {
    const d = emptyDay("2026-06-08");
    d.cost = 1.5;
    d.sessionIds = new Set(["s1"]);
    const days: DayAgg[] = [d];
    await writeCache(cachePath, "sig-abc", days);

    const payload = await readCache(cachePath);
    expect(payload).toBeDefined();
    expect(payload!.signature).toBe("sig-abc");
    expect(payload!.days).toHaveLength(1);
    expect(payload!.days[0]!.date).toBe("2026-06-08");
    expect(payload!.days[0]!.cost).toBe(1.5);
    // Sets are serialized as arrays
    expect(payload!.days[0]!.sessionIds).toEqual(["s1"]);
  });

  it("returns null for missing cache file", async () => {
    const payload = await readCache("/nonexistent/path/cache.json");
    expect(payload).toBeNull();
  });

  it("returns null for corrupt cache", async () => {
    await Bun.write(cachePath, "not-json");
    const payload = await readCache(cachePath);
    expect(payload).toBeNull();
  });

  it("returns generatedAt from valid cache", async () => {
    const d = emptyDay("2026-06-08");
    await writeCache(cachePath, "sig-abc", [d]);
    const ts = await getCacheTimestamp(cachePath);
    expect(ts).not.toBeNull();
    // generatedAt is an ISO string
    expect(new Date(ts!).toISOString()).toBe(ts as string);
  });

  it("returns null for missing cache", async () => {
    const ts = await getCacheTimestamp("/nonexistent/cache.json");
    expect(ts).toBeNull();
  });

  it("returns null for corrupt cache", async () => {
    await Bun.write(cachePath, "not-json");
    const ts = await getCacheTimestamp(cachePath);
    expect(ts).toBeNull();
  });

  it("serializes and deserializes modelToProvider Map", async () => {
    const d = emptyDay("2026-06-08");
    d.modelToProvider.set("claude-sonnet-4", "anthropic");
    d.modelToProvider.set("gpt-4o", "openai");
    const days: DayAgg[] = [d];
    await writeCache(cachePath, "sig-mtp", days);

    // Read raw cache JSON — modelToProvider should not be empty {}
    const payload = await readCache(cachePath);
    expect(payload).toBeDefined();
    expect(payload!.days).toHaveLength(1);
    expect(payload!.days[0]!.modelToProvider).toEqual({
      "claude-sonnet-4": "anthropic",
      "gpt-4o": "openai",
    });

    // Load via loadAggregate round-trip (needs a session dir with .jsonl for valid sig)
    const sesDir = join(tmpDir, "sessions");
    await mkdir(sesDir, { recursive: true });
    await Bun.write(
      join(sesDir, "dummy.jsonl"),
      JSON.stringify({
        type: "session",
        version: 3,
        id: "s1",
        timestamp: "2026-06-08T10:00:00.000Z",
        cwd: "/p",
      }) + "\n",
    );
    const sig = await computeSignature(sesDir);
    await Bun.write(
      cachePath,
      JSON.stringify({
        signature: sig,
        generatedAt: new Date().toISOString(),
        days: [
          {
            date: "2026-06-08",
            cost: 0,
            inTok: 0,
            outTok: 0,
            crTok: 0,
            cwTok: 0,
            userMsgs: 0,
            asstMsgs: 0,
            toolResults: 0,
            sessionIds: [],
            langLines: {},
            langEdits: {},
            modelCost: {},
            modelCount: {},
            providerCost: {},
            providerCount: {},
            modelToProvider: { "claude-sonnet-4": "anthropic", "gpt-4o": "openai" },
            projectCost: {},
            projectSessions: {},
            toolCount: {},
          },
        ],
      }),
    );
    const loaded = await loadAggregate(cachePath, sesDir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.modelToProvider.get("claude-sonnet-4")).toBe("anthropic");
    expect(loaded[0]!.modelToProvider.get("gpt-4o")).toBe("openai");
    expect(loaded[0]!.modelToProvider.size).toBe(2);
  });
});

describe("loadAggregate", () => {
  let tmpDir: string;
  let sessionsDir: string;
  let cachePath: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `pi-usage-load-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    sessionsDir = join(tmpDir, "sessions");
    await mkdir(sessionsDir, { recursive: true });
    cachePath = join(tmpDir, "cache.json");
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for empty sessions dir", async () => {
    const days = await loadAggregate(cachePath, sessionsDir);
    expect(days).toEqual([]);
  });

  it("parses session files and returns DayAgg array", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await Bun.write(
      join(subDir, "s1.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: "2026-06-08T10:01:00.000Z",
          message: { role: "user", content: [{ type: "text", text: "hi" }] },
        }),
      ].join("\n"),
    );

    const days = await loadAggregate(cachePath, sessionsDir);
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe("2026-06-08");
    expect(days[0]!.userMsgs).toBe(1);
  });

  it("caches results and reuses them", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await Bun.write(
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

    const days1 = await loadAggregate(cachePath, sessionsDir);
    expect(days1).toHaveLength(1);

    // Second call should use cache
    const days2 = await loadAggregate(cachePath, sessionsDir);
    expect(days2).toHaveLength(1);
  });

  it("invalidates cache when session files change", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await Bun.write(
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
    await Bun.write(
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

    const days = await loadAggregate(cachePath, sessionsDir);
    expect(days).toHaveLength(2); // two days now
  });

  it("logs corrupt line count to stderr", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await Bun.write(
      join(subDir, "mixed.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s1",
          timestamp: "2026-06-08T10:00:00.000Z",
          cwd: "/home/doe/proj-a",
        }),
        "not valid json",
        "also broken {",
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: "2026-06-08T10:01:00.000Z",
          message: { role: "user", content: [{ type: "text", text: "hi" }] },
        }),
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

  it("calls onProgress during parsing", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await Bun.write(
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

    const progress: number[] = [];
    await loadAggregate(cachePath, sessionsDir, false, (p) => progress.push(p));

    // Should have reported some progress
    expect(progress.length).toBeGreaterThan(0);
  });
});
