/**
 * Engine 3 remediation — durable bounded broker UTC offset observation archive.
 *
 * Stores timestamped open-session offset observations so historical candles can
 * resolve UTC only when an observation covers their broker-open time.
 * Never invents offsets. Never rewrites older evidence with newer conflicting eras.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type { HfmTimestampNormalizationStatus } from "./quote-timestamp.js";
import {
  HFM_TRUSTED_OFFSET_MAX_AGE_SEC,
  HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC,
  HFM_OFFSET_QUARTER_HOUR_SEC,
} from "./quote-timestamp.js";

export const HFM_OFFSET_ARCHIVE_SCHEMA_VERSION = 1 as const;

/**
 * Max retained *offset eras* (not hourly heartbeats).
 * Same-offset heartbeats compact into one era; only offset transitions
 * (and distinct eras) consume a new slot. 512 eras ≫ expected DST/server changes.
 */
export const HFM_OFFSET_ARCHIVE_MAX_OBS = 512;

/**
 * @deprecated Heartbeats no longer append slots. Kept for test/compat imports.
 * Same-offset observations always compact into the open era.
 */
export const HFM_OFFSET_ARCHIVE_HEARTBEAT_SEC = 3600;

export interface HfmOffsetArchiveObservation {
  offsetSec: number;
  /** Raw measured broker−GMT delta when distinct from trusted offset (e.g. 7199). */
  measuredDeltaSec: number | null;
  /**
   * First confirmation of this continuous same-offset era (broker domain).
   * Preserved across heartbeats so era start / DST boundary is not lost.
   */
  firstObservedAtBrokerSec: number;
  /** First confirmation GMT seconds. */
  firstObservedAtGmtSec: number;
  /** Last-seen confirmation of this era (broker domain). Updated in place by heartbeats. */
  observedAtBrokerSec: number;
  /** Last-seen confirmation GMT seconds. */
  observedAtGmtSec: number;
  status: HfmTimestampNormalizationStatus;
  source: "open_session_observation" | "archive_backfill";
  brokerIdentity: string | null;
  sessionContext: string | null;
  reason: string | null;
}

export interface HfmOffsetArchiveDocument {
  schemaVersion: typeof HFM_OFFSET_ARCHIVE_SCHEMA_VERSION;
  provider: "HFM_MT5";
  updatedAt: string;
  observations: HfmOffsetArchiveObservation[];
}

export interface HfmOffsetArchiveLookupResult {
  offsetSec: number;
  status: HfmTimestampNormalizationStatus;
  reason: string;
  trust: "TRUSTED_HISTORICAL";
  observedAtGmtSec: number;
  observedAtBrokerSec: number;
  measuredDeltaSec: number | null;
}

function resolveStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function resolveHfmOffsetArchivePath(storageRoot = resolveStorageRoot()): string {
  return path.join(storageRoot, "mt5-hfm", "offset-archive", "broker-utc-offset.json");
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function atomicWrite(filePath: string, data: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.tmp.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`;
  const handle = await fs.open(tmp, "w");
  try {
    await handle.writeFile(data, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, filePath);
  } catch {
    try {
      await fs.unlink(filePath);
    } catch {
      /* missing */
    }
    await fs.rename(tmp, filePath);
  }
}

async function quarantineCorrupt(filePath: string, reason: string): Promise<void> {
  try {
    const dir = path.join(path.dirname(filePath), "_corrupt");
    await ensureDir(dir);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.rename(filePath, path.join(dir, `broker-utc-offset.${stamp}.json`));
    await fs.writeFile(
      path.join(dir, `broker-utc-offset.${stamp}.reason.txt`),
      reason,
      "utf8",
    );
  } catch {
    /* best-effort */
  }
}

let memoryArchive: HfmOffsetArchiveObservation[] = [];
let archiveLoaded = false;
let archivePathOverride: string | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

export function resetHfmOffsetArchiveForTests(): void {
  memoryArchive = [];
  archiveLoaded = true;
  dirty = false;
  archivePathOverride = null;
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

/** Test helper — point archive at a temp file and force reload. */
export function setHfmOffsetArchivePathForTests(filePath: string | null): void {
  archivePathOverride = filePath;
  archiveLoaded = false;
  memoryArchive = [];
  dirty = false;
}

export function getHfmOffsetArchiveObservations(): HfmOffsetArchiveObservation[] {
  return memoryArchive.map((o) => ({ ...o }));
}

function sortObs(list: HfmOffsetArchiveObservation[]): HfmOffsetArchiveObservation[] {
  return [...list].sort((a, b) => a.observedAtBrokerSec - b.observedAtBrokerSec);
}

function validateObservation(raw: unknown): HfmOffsetArchiveObservation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.offsetSec !== "number" || !Number.isFinite(o.offsetSec)) return null;
  if (typeof o.observedAtGmtSec !== "number" || !Number.isFinite(o.observedAtGmtSec)) return null;
  if (typeof o.observedAtBrokerSec !== "number" || !Number.isFinite(o.observedAtBrokerSec)) {
    return null;
  }
  if (o.status !== "NORMALIZED" && o.status !== "PARTIAL" && o.status !== "UNAVAILABLE" && o.status !== "UNRELIABLE") {
    return null;
  }
  const observedAtGmtSec = Math.trunc(o.observedAtGmtSec as number);
  const observedAtBrokerSec = Math.trunc(o.observedAtBrokerSec as number);
  const firstBroker =
    typeof o.firstObservedAtBrokerSec === "number" && Number.isFinite(o.firstObservedAtBrokerSec)
      ? Math.trunc(o.firstObservedAtBrokerSec)
      : observedAtBrokerSec;
  const firstGmt =
    typeof o.firstObservedAtGmtSec === "number" && Number.isFinite(o.firstObservedAtGmtSec)
      ? Math.trunc(o.firstObservedAtGmtSec)
      : observedAtGmtSec;
  return {
    offsetSec: Math.trunc(o.offsetSec),
    measuredDeltaSec:
      typeof o.measuredDeltaSec === "number" && Number.isFinite(o.measuredDeltaSec)
        ? Math.trunc(o.measuredDeltaSec)
        : null,
    firstObservedAtBrokerSec: Math.min(firstBroker, observedAtBrokerSec),
    firstObservedAtGmtSec: Math.min(firstGmt, observedAtGmtSec),
    observedAtGmtSec,
    observedAtBrokerSec,
    status: o.status,
    source:
      o.source === "archive_backfill" ? "archive_backfill" : "open_session_observation",
    brokerIdentity: typeof o.brokerIdentity === "string" ? o.brokerIdentity : null,
    sessionContext: typeof o.sessionContext === "string" ? o.sessionContext : null,
    reason: typeof o.reason === "string" ? o.reason : null,
  };
}

/** Collapse consecutive same-offset records into era spans (schema migration / safety). */
export function compactHfmOffsetArchiveEras(
  list: HfmOffsetArchiveObservation[],
): HfmOffsetArchiveObservation[] {
  const sorted = sortObs(list);
  if (!sorted.length) return [];
  const out: HfmOffsetArchiveObservation[] = [];
  for (const row of sorted) {
    const last = out[out.length - 1];
    if (
      last &&
      Math.abs(last.offsetSec - row.offsetSec) < HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC
    ) {
      out[out.length - 1] = {
        ...last,
        firstObservedAtBrokerSec: Math.min(
          last.firstObservedAtBrokerSec,
          row.firstObservedAtBrokerSec,
          row.observedAtBrokerSec,
        ),
        firstObservedAtGmtSec: Math.min(
          last.firstObservedAtGmtSec,
          row.firstObservedAtGmtSec,
          row.observedAtGmtSec,
        ),
        observedAtBrokerSec: Math.max(last.observedAtBrokerSec, row.observedAtBrokerSec),
        observedAtGmtSec: Math.max(last.observedAtGmtSec, row.observedAtGmtSec),
        measuredDeltaSec: row.measuredDeltaSec ?? last.measuredDeltaSec,
        status: row.status === "NORMALIZED" || last.status === "NORMALIZED" ? "NORMALIZED" : row.status,
        reason: row.reason ?? last.reason,
        brokerIdentity: row.brokerIdentity ?? last.brokerIdentity,
        sessionContext: row.sessionContext ?? last.sessionContext,
      };
    } else {
      out.push({ ...row });
    }
  }
  return out.slice(-HFM_OFFSET_ARCHIVE_MAX_OBS);
}

/**
 * Load archive from disk into memory. Safe on corrupt/missing files.
 * Idempotent — subsequent calls no-op until reset/path change.
 */
export async function loadHfmOffsetArchive(): Promise<{
  loaded: number;
  path: string;
  corrupt: boolean;
}> {
  const filePath = archivePathOverride ?? resolveHfmOffsetArchivePath();
  if (archiveLoaded) {
    return { loaded: memoryArchive.length, path: filePath, corrupt: false };
  }
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      await quarantineCorrupt(filePath, "NOT_OBJECT");
      memoryArchive = [];
      archiveLoaded = true;
      return { loaded: 0, path: filePath, corrupt: true };
    }
    const doc = parsed as Record<string, unknown>;
    const list = Array.isArray(doc.observations) ? doc.observations : [];
    const cleaned: HfmOffsetArchiveObservation[] = [];
    for (const row of list) {
      const v = validateObservation(row);
      if (v) cleaned.push(v);
    }
    memoryArchive = compactHfmOffsetArchiveEras(cleaned);
    archiveLoaded = true;
    return { loaded: memoryArchive.length, path: filePath, corrupt: false };
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
    if (code === "ENOENT") {
      memoryArchive = [];
      archiveLoaded = true;
      return { loaded: 0, path: filePath, corrupt: false };
    }
    await quarantineCorrupt(filePath, `READ_${String(err)}`);
    memoryArchive = [];
    archiveLoaded = true;
    return { loaded: 0, path: filePath, corrupt: true };
  }
}

function schedulePersist(): void {
  dirty = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistHfmOffsetArchive();
  }, 250);
}

export async function persistHfmOffsetArchive(): Promise<{ ok: boolean; path: string }> {
  const filePath = archivePathOverride ?? resolveHfmOffsetArchivePath();
  if (!dirty && archiveLoaded) {
    return { ok: true, path: filePath };
  }
  const doc: HfmOffsetArchiveDocument = {
    schemaVersion: HFM_OFFSET_ARCHIVE_SCHEMA_VERSION,
    provider: "HFM_MT5",
    updatedAt: new Date().toISOString(),
    observations: compactHfmOffsetArchiveEras(memoryArchive),
  };
  try {
    await atomicWrite(filePath, `${JSON.stringify(doc)}\n`);
    dirty = false;
    archiveLoaded = true;
    return { ok: true, path: filePath };
  } catch {
    return { ok: false, path: filePath };
  }
}

/**
 * Record an offset observation as a durable *era*.
 *
 * Same-offset heartbeats compact into the open era (first-seen preserved,
 * last-seen updated) and never consume an additional slot — so hourly
 * confirmations cannot evict older DST/offset eras from the 512-era budget.
 * Distinct offsets append a new era. Older eras are never rewritten in place.
 */
export function noteHfmOffsetArchiveObservation(input: {
  offsetSec: number;
  measuredDeltaSec?: number | null;
  observedAtGmtSec: number;
  observedAtBrokerSec: number;
  status: HfmTimestampNormalizationStatus;
  brokerIdentity?: string | null;
  sessionContext?: string | null;
  reason?: string | null;
  source?: HfmOffsetArchiveObservation["source"];
}): HfmOffsetArchiveObservation | null {
  if (
    input.status !== "NORMALIZED" &&
    input.status !== "PARTIAL"
  ) {
    return null;
  }
  if (!Number.isFinite(input.offsetSec) || !Number.isFinite(input.observedAtBrokerSec)) {
    return null;
  }

  const brokerSec = Math.trunc(input.observedAtBrokerSec);
  const gmtSec = Math.trunc(input.observedAtGmtSec);
  const next: HfmOffsetArchiveObservation = {
    offsetSec: Math.trunc(input.offsetSec),
    measuredDeltaSec:
      input.measuredDeltaSec != null && Number.isFinite(input.measuredDeltaSec)
        ? Math.trunc(input.measuredDeltaSec)
        : null,
    firstObservedAtBrokerSec: brokerSec,
    firstObservedAtGmtSec: gmtSec,
    observedAtGmtSec: gmtSec,
    observedAtBrokerSec: brokerSec,
    status: input.status,
    source: input.source ?? "open_session_observation",
    brokerIdentity: input.brokerIdentity ?? null,
    sessionContext: input.sessionContext ?? null,
    reason: input.reason ?? null,
  };

  const last = memoryArchive[memoryArchive.length - 1];
  if (last) {
    // Exact duplicate confirmation — no-op.
    if (
      last.observedAtBrokerSec === next.observedAtBrokerSec &&
      last.offsetSec === next.offsetSec
    ) {
      return { ...last };
    }
    // Same offset era: compact heartbeat into existing record (no new slot).
    if (Math.abs(last.offsetSec - next.offsetSec) < HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC) {
      memoryArchive[memoryArchive.length - 1] = {
        ...last,
        firstObservedAtBrokerSec: Math.min(last.firstObservedAtBrokerSec, next.observedAtBrokerSec),
        firstObservedAtGmtSec: Math.min(last.firstObservedAtGmtSec, next.observedAtGmtSec),
        observedAtGmtSec: Math.max(last.observedAtGmtSec, next.observedAtGmtSec),
        observedAtBrokerSec: Math.max(last.observedAtBrokerSec, next.observedAtBrokerSec),
        measuredDeltaSec: next.measuredDeltaSec ?? last.measuredDeltaSec,
        status: next.status === "NORMALIZED" ? "NORMALIZED" : last.status,
        reason: next.reason ?? last.reason,
        brokerIdentity: next.brokerIdentity ?? last.brokerIdentity,
        sessionContext: next.sessionContext ?? last.sessionContext,
      };
      schedulePersist();
      return { ...memoryArchive[memoryArchive.length - 1]! };
    }
  }

  // Offset transition / new era — preserve prior eras for DST boundary detection.
  memoryArchive.push(next);
  memoryArchive = compactHfmOffsetArchiveEras(memoryArchive);
  schedulePersist();
  return { ...next };
}

function nearQuarterHour(offsetSec: number): boolean {
  const rem = Math.abs(offsetSec % HFM_OFFSET_QUARTER_HOUR_SEC);
  return rem <= 1 || Math.abs(rem - HFM_OFFSET_QUARTER_HOUR_SEC) <= 1;
}

/**
 * Lookup historically applicable offset for a broker-domain candle open.
 * Returns null when no covering observation exists or covering observations conflict
 * (DST spring-forward / fall-back ambiguity).
 */
export function lookupHfmOffsetArchiveForBrokerCandle(
  brokerOpenTime: number,
  opts?: { maxAgeSec?: number },
): HfmOffsetArchiveLookupResult | null {
  if (!Number.isFinite(brokerOpenTime) || brokerOpenTime <= 0) return null;
  const maxAge = opts?.maxAgeSec ?? HFM_TRUSTED_OFFSET_MAX_AGE_SEC;
  const grace = 3600;

  const covering = memoryArchive.filter((o) => {
    const first = o.firstObservedAtBrokerSec;
    const last = o.observedAtBrokerSec;
    // Candle falls inside the confirmed era span (inclusive, with grace).
    if (brokerOpenTime >= first - grace && brokerOpenTime <= last + grace) return true;
    // Legacy: observation may cover candles up to maxAge before first confirmation.
    if (brokerOpenTime > last + grace) return false;
    const ageFromFirst = first - brokerOpenTime;
    return ageFromFirst >= 0 && ageFromFirst <= maxAge;
  });
  if (!covering.length) return null;

  // Prefer the earliest-ending covering era (closest after/at candle open).
  covering.sort((a, b) => a.observedAtBrokerSec - b.observedAtBrokerSec);
  const chosen = covering[0]!;

  const conflict = covering.some(
    (o) => Math.abs(o.offsetSec - chosen.offsetSec) >= HFM_TRUSTED_OFFSET_REPLACE_DELTA_SEC,
  );
  if (conflict) return null;

  const status: HfmTimestampNormalizationStatus =
    chosen.status === "NORMALIZED" && nearQuarterHour(chosen.offsetSec)
      ? "NORMALIZED"
      : chosen.status === "UNRELIABLE"
        ? "UNRELIABLE"
        : "PARTIAL";

  return {
    offsetSec: chosen.offsetSec,
    status,
    reason:
      status === "NORMALIZED"
        ? "TRUSTED_ARCHIVE_OFFSET_OBSERVATION"
        : "TRUSTED_ARCHIVE_OFFSET_PARTIAL",
    trust: "TRUSTED_HISTORICAL",
    observedAtGmtSec: chosen.observedAtGmtSec,
    observedAtBrokerSec: chosen.observedAtBrokerSec,
    measuredDeltaSec: chosen.measuredDeltaSec,
  };
}

/** Coverage summary for diagnostics — earliest/latest observation broker times. */
export function getHfmOffsetArchiveCoverage(): {
  count: number;
  earliestBrokerSec: number | null;
  latestBrokerSec: number | null;
  distinctOffsets: number[];
} {
  if (!memoryArchive.length) {
    return { count: 0, earliestBrokerSec: null, latestBrokerSec: null, distinctOffsets: [] };
  }
  const offsets = [...new Set(memoryArchive.map((o) => o.offsetSec))].sort((a, b) => a - b);
  return {
    count: memoryArchive.length,
    earliestBrokerSec: memoryArchive[0]!.observedAtBrokerSec,
    latestBrokerSec: memoryArchive[memoryArchive.length - 1]!.observedAtBrokerSec,
    distinctOffsets: offsets,
  };
}

/**
 * Ensure archive is loaded (sync-safe bootstrap for hot path).
 * Fire-and-forget load on first use; subsequent sync lookups use memory.
 */
export function ensureHfmOffsetArchiveLoadedSync(): void {
  if (archiveLoaded) return;
  // Synchronous best-effort read for process start / first candle request.
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fsSync = require("node:fs") as typeof import("node:fs");
    const filePath = archivePathOverride ?? resolveHfmOffsetArchivePath();
    if (!fsSync.existsSync(filePath)) {
      archiveLoaded = true;
      return;
    }
    const raw = fsSync.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as { observations?: unknown[] };
    const list = Array.isArray(parsed.observations) ? parsed.observations : [];
    const cleaned: HfmOffsetArchiveObservation[] = [];
    for (const row of list) {
      const v = validateObservation(row);
      if (v) cleaned.push(v);
    }
    memoryArchive = compactHfmOffsetArchiveEras(cleaned);
    archiveLoaded = true;
  } catch {
    archiveLoaded = true;
    memoryArchive = [];
  }
}
