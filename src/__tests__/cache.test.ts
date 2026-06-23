import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  computeSignature,
  getCacheTimestamp,
  isCacheValid,
  loadAggregate,
  readCache,
  writeCache,
} from "../cache";
import { emptyDay } from "../parser";
import { type DayAgg } from "../types";
import { unlink } from "node:fs/promises";

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
    // Write a session file, compute its signature, write cache with that sig
    await writeFile(join(sessionsDir, "s1.jsonl"), "data\n");
    const sig = await computeSignature(sessionsDir);
    const d = emptyDay("2026-06-08");
    await writeCache(cachePath, sig, [d]);

    const validBefore = await isCacheValid(cachePath, sessionsDir);
    expect(validBefore).toBe(true);

    // Add a session file that changes the real signature
    await writeFile(join(sessionsDir, "s2.jsonl"), "data\n");

    const valid = await isCacheValid(cachePath, sessionsDir);
    expect(valid).toBe(false);
  });

  it("returns true when cache signature matches current", async () => {
    // Write a session file, compute its signature, write cache with that sig
    await writeFile(join(sessionsDir, "s1.jsonl"), "data\n");
    const sig = await computeSignature(sessionsDir);
    const d = emptyDay("2026-06-08");
    await writeCache(cachePath, sig, [d]);

    const valid = await isCacheValid(cachePath, sessionsDir);
    expect(valid).toBe(true);
  });
});

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
    await writeFile(cachePath, "not-json");
    const payload = await readCache(cachePath);
    expect(payload).toBeNull();
  });

  it("returns null when cached JSON lacks a signature", async () => {
    await writeFile(cachePath, JSON.stringify({ days: [] }));
    const payload = await readCache(cachePath);
    expect(payload).toBeNull();
  });

  it("returns null when cached JSON has signature but days is not an array", async () => {
    await writeFile(cachePath, JSON.stringify({ signature: "sig", days: {} }));
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

  it("preserves hourCost values through round-trip (numeric keys become strings in JSON)", async () => {
    const d = emptyDay("2026-06-08");
    d.hourCost = { 10: 0.5, 14: 1.25 };
    const days: DayAgg[] = [d];
    await writeCache(cachePath, "sig-hc", days);

    // Read raw JSON — numeric keys are stored as strings
    const raw = await readFile(cachePath, "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.days[0].hourCost).toEqual({ "10": 0.5, "14": 1.25 });

    // Round-trip via loadAggregate
    const sesDir = join(tmpDir, "sessions");
    await mkdir(sesDir, { recursive: true });
    await writeFile(
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
    await writeFile(
      cachePath,
      JSON.stringify({
        signature: sig,
        generatedAt: new Date().toISOString(),
        days: [
          {
            ...parsed.days[0],
            modelToProvider: {},
          },
        ],
      }),
    );
    const loaded = await loadAggregate(cachePath, sesDir);
    expect(loaded).toHaveLength(1);
    // Numeric access still works via JS coercion
    expect(loaded[0]!.hourCost[10]).toBe(0.5);
    expect(loaded[0]!.hourCost[14]).toBe(1.25);
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
    await writeFile(
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
    await writeFile(
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
    const days = await loadAggregate(cachePath, sessionsDir);
    expect(days).toEqual([]);
  });

  it("parses session files and returns DayAgg array", async () => {
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

  it("merges data from multiple files sharing the same date", async () => {
    const projA = join(sessionsDir, "proj-a");
    const projB = join(sessionsDir, "proj-b");
    await mkdir(projA, { recursive: true });
    await mkdir(projB, { recursive: true });

    // Two files, same date, different sessions
    await writeFile(
      join(projA, "s1.jsonl"),
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
          message: { role: "user", content: [{ type: "text", text: "hi from a" }] },
        }),
      ].join("\n"),
    );

    await writeFile(
      join(projB, "s2.jsonl"),
      [
        JSON.stringify({
          type: "session",
          version: 3,
          id: "s2",
          timestamp: "2026-06-08T14:00:00.000Z",
          cwd: "/home/doe/proj-b",
        }),
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: "2026-06-08T14:01:00.000Z",
          message: { role: "user", content: [{ type: "text", text: "hi from b" }] },
        }),
      ].join("\n"),
    );

    const days = await loadAggregate(cachePath, sessionsDir, true);
    expect(days).toHaveLength(1);
    expect(days[0]!.date).toBe("2026-06-08");
    expect(days[0]!.userMsgs).toBe(2); // one from each file
    expect(days[0]!.sessionIds.size).toBe(2); // s1 and s2 merged
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
        }),
      ].join("\n"),
    );

    await loadAggregate(cachePath, sessionsDir);

    // Verify the cache file was written
    const payload = await readCache(cachePath);
    expect(payload).not.toBeNull();
    expect(payload!.days).toHaveLength(1);
    expect(payload!.days[0]!.date).toBe("2026-06-08");
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

    const days1 = await loadAggregate(cachePath, sessionsDir);
    expect(days1).toHaveLength(1);

    // Second call should use cache
    const days2 = await loadAggregate(cachePath, sessionsDir);
    expect(days2).toHaveLength(1);
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

    const days = await loadAggregate(cachePath, sessionsDir);
    expect(days).toHaveLength(2); // two days now
  });

  it("logs corrupt line count to stderr", async () => {
    const subDir = join(sessionsDir, "proj-a");
    await mkdir(subDir);
    await writeFile(
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

  it("force=true re-parses even when valid cache exists", async () => {
    // Create a session file
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
        JSON.stringify({
          type: "message",
          id: "m1",
          parentId: "p",
          timestamp: "2026-06-08T10:01:00.000Z",
          message: { role: "user", content: [{ type: "text", text: "hi" }] },
        }),
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
        days: [
          {
            date: "2026-06-08",
            cost: 0,
            inTok: 0,
            outTok: 0,
            crTok: 0,
            cwTok: 0,
            userMsgs: 9999, // stale: real data has 1
            asstMsgs: 0,
            toolResults: 0,
            sessionIds: [],
            langLines: {},
            langEdits: {},
            modelCost: {},
            modelCount: {},
            providerCost: {},
            providerCount: {},
            modelToProvider: {},
            projectCost: {},
            projectSessions: {},
            toolCount: {},
          },
        ],
      }),
    );

    // force=true should ignore the stale cache and re-parse
    const days = await loadAggregate(cachePath, sessionsDir, true);
    expect(days).toHaveLength(1);
    expect(days[0]!.userMsgs).toBe(1);
    expect(days[0]!.asstMsgs).toBe(0);
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

    const progress: number[] = [];
    await loadAggregate(cachePath, sessionsDir, false, (p) => progress.push(p));

    // Should have reported some progress and reached 100%
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1]).toBe(100);
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

    const progress: number[] = [];
    await loadAggregate(cachePath, sessionsDir, true, (p) => progress.push(p));

    // Two files: should get 50 and 100
    expect(progress).toEqual([50, 100]);
  });
});
