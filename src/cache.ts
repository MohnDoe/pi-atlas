import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mergeDay, parseFile } from "./parser";
import type { CachePayload, DayAgg, SerializedDayAgg } from "./types";

// ---- Signature ----

export async function computeSignature(sessionsDir: string): Promise<string> {
  const hash = createHash("sha256");
  const entries: Array<{ path: string; size: number; mtimeMs: number }> = [];

  async function walk(dir: string): Promise<void> {
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const d of dirents) {
      const full = join(dir, d.name);
      if (d.isDirectory()) {
        await walk(full);
      } else if (d.isFile() && d.name.endsWith(".jsonl")) {
        const s = await stat(full);
        entries.push({ path: full, size: s.size, mtimeMs: s.mtimeMs });
      }
    }
  }

  await walk(sessionsDir);

  if (entries.length === 0) return "";

  // Sort by path for deterministic hashing
  entries.sort((a, b) => a.path.localeCompare(b.path));

  for (const e of entries) {
    hash.update(`${e.path}\n${e.size}\n${e.mtimeMs}\n`);
  }

  return hash.digest("hex");
}

// ---- Serialization ----

function serializeDay(d: DayAgg): SerializedDayAgg {
  return {
    ...d,
    sessionIds: [...d.sessionIds],
    projectSessions: Object.fromEntries(
      Object.entries(d.projectSessions).map(([k, v]) => [k, [...v]]),
    ),
    modelToProvider: Object.fromEntries(d.modelToProvider),
  };
}

function deserializeDay(s: SerializedDayAgg): DayAgg {
  return {
    ...s,
    sessionIds: new Set(s.sessionIds),
    projectSessions: Object.fromEntries(
      Object.entries(s.projectSessions).map(([k, v]) => [k, new Set(v)]),
    ),
    modelToProvider: new Map(Object.entries(s.modelToProvider)),
  };
}

// ---- Cache I/O ----

export async function writeCache(
  cachePath: string,
  signature: string,
  days: DayAgg[],
): Promise<void> {
  const payload: CachePayload = {
    signature,
    generatedAt: new Date().toISOString(),
    days: days.map(serializeDay),
  };
  await writeFile(cachePath, JSON.stringify(payload), "utf-8");
}

export async function readCache(cachePath: string): Promise<CachePayload | null> {
  try {
    const raw = await readFile(cachePath, "utf-8");
    const payload = JSON.parse(raw) as CachePayload;
    if (!payload.signature || !Array.isArray(payload.days)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getCacheTimestamp(cachePath: string): Promise<string | null> {
  const payload = await readCache(cachePath);
  return payload?.generatedAt ?? null;
}

/** Check if cache is still valid against current directory signature */
export async function isCacheValid(cachePath: string, sessionsDir: string): Promise<boolean> {
  const cached = await readCache(cachePath);
  if (!cached) return false;
  const currentSig = await computeSignature(sessionsDir);
  return cached.signature === currentSig;
}

/** Sleep helper for debug delay */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---- Aggregate loading ----

async function findAllJsonlFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(d: string) {
    let entries;
    try {
      entries = await readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = join(d, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.endsWith(".jsonl")) result.push(full);
    }
  }
  await walk(dir);
  return result;
}
export interface LoadingProgress {
  total: number;
  done: number;
  pct: number;
}

export async function loadAggregate(
  cachePath: string,
  sessionsDir: string,
  force = false,
  onProgress?: (p: LoadingProgress) => void,
): Promise<DayAgg[]> {
  // Debug flags: PI_ATLAS_FORCE_CACHE=1 skips cache, PI_ATLAS_SLOW_DELAY_MS=<ms> adds per-file delay
  const effectiveForce = force || Boolean(Number(process.env["PI_ATLAS_FORCE_CACHE"] ?? 0));

  // Try cache first
  if (!effectiveForce) {
    const valid = await isCacheValid(cachePath, sessionsDir);
    if (valid) {
      const cached = await readCache(cachePath);
      if (cached) return cached.days.map(deserializeDay);
    }
  }

  // Parse all JSONL files
  const files = await findAllJsonlFiles(sessionsDir);
  const map = new Map<string, DayAgg>();
  let totalCorrupt = 0;

  const slowDelayMs = Number(process.env["PI_ATLAS_SLOW_DELAY_MS"] ?? 0);

  for (let i = 0; i < files.length; i++) {
    if (slowDelayMs > 0) {
      // Progress callback to show we're alive before first file
      if (i === 0 && onProgress) onProgress({ total: 0, done: 0, pct: 0 });
      await sleep(slowDelayMs);
    }

    let lastCount = 0;
    const fileMap = parseFile(files[i]!, (count) => {
      lastCount = count;
    });
    totalCorrupt += lastCount;
    for (const [date, day] of fileMap) {
      const existing = map.get(date);
      if (existing) {
        // mergeDay is used inline in engine's loadAggregate; import it
        mergeDay(existing, day);
      } else {
        map.set(date, day);
      }
    }
    if (onProgress)
      onProgress({
        done: i + 1,
        total: files.length,
        pct: Math.round(((i + 1) / files.length) * 100),
      });
  }

  if (totalCorrupt > 0) {
    console.error(`pi-atlas: skipped ${totalCorrupt} corrupt JSONL line(s)`);
  }

  const days = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Write cache
  const sig = await computeSignature(sessionsDir);
  await writeCache(cachePath, sig, days);

  return days;
}
