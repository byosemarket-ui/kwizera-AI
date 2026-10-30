/**
 * Phase 58.3 — time-bounded DEMO execution grants (server-enforced).
 * Does not flip global placesOrders / acceptsForExecution.
 *
 * Safety (Phase 59.0.12H): instrumentAllowlist must be non-empty and explicit.
 * An empty or missing allowlist never authorizes any instrument.
 */
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readJsonSafeSync, writeJsonAtomicSync } from "../../../../storage/safe-json.js";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import type { DemoExecutionGrant } from "./types.js";

export const DEMO_GRANT_DEFAULT_TTL_MS = 15 * 60_000;
export const DEMO_GRANT_MAX_TTL_MS = 60 * 60_000;
export const DEMO_GRANT_MAX_LOTS = 10;

/** @deprecated Use DEMO_GRANT_DEFAULT_TTL_MS */
const DEFAULT_TTL_MS = DEMO_GRANT_DEFAULT_TTL_MS;
/** @deprecated Use DEMO_GRANT_MAX_TTL_MS */
const MAX_TTL_MS = DEMO_GRANT_MAX_TTL_MS;
const MAX_LOTS = DEMO_GRANT_MAX_LOTS;

export class GrantAllowlistError extends Error {
  readonly code = "GRANT_ALLOWLIST_REQUIRED";
  constructor(message: string) {
    super(message);
    this.name = "GrantAllowlistError";
  }
}

/** Durable path under KWIZERA_STORAGE_ROOT (survives app-tree redeploys). */
export function resolveDemoExecutionGrantsPath(storageRoot?: string): string {
  return join(
    storageRoot ?? resolveStorageRoot(),
    "forex",
    "demo-execution-grants.json",
  );
}

/** Legacy cwd-relative path used before storage-root migration. */
export function legacyDemoExecutionGrantsPath(): string {
  return join(process.cwd(), "data", "forex", "demo-execution-grants.json");
}

function defaultPath(): string {
  const primary = resolveDemoExecutionGrantsPath();
  const legacy = legacyDemoExecutionGrantsPath();
  // One-time migrate so existing VPS grants are not orphaned after path fix.
  if (!existsSync(primary) && existsSync(legacy)) {
    try {
      mkdirSync(dirname(primary), { recursive: true });
      copyFileSync(legacy, primary);
    } catch {
      /* keep primary path; empty store is fail-closed */
    }
  }
  return primary;
}

/** Normalize for comparison: strip whitespace, uppercase. */
export function normalizeGrantInstrument(s: string): string {
  return String(s ?? "").replace(/\s+/g, "").toUpperCase();
}

/**
 * Normalize allowlist entries for storage.
 * Rejects empty lists and whitespace-only / empty entries after trim.
 * Deduplicates by normalized symbol while preserving first display form.
 */
export function normalizeInstrumentAllowlist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const entry of raw) {
    const display = String(entry ?? "").trim();
    if (!display) continue;
    const key = normalizeGrantInstrument(display);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(display);
  }
  return out;
}

export class DemoExecutionGrantStore {
  private readonly path: string;
  private grants: DemoExecutionGrant[] = [];
  /** True when load quarantined corrupt JSON — create/require fail closed until restart with valid store. */
  private persistenceDegraded = false;
  private persistenceError: string | null = null;

  constructor(path = defaultPath()) {
    this.path = path;
    this.load();
  }

  /** Absolute path of the durable grant JSON file. */
  get filePath(): string {
    return this.path;
  }

  get isPersistenceDegraded(): boolean {
    return this.persistenceDegraded;
  }

  get persistenceDegradedReason(): string | null {
    return this.persistenceError;
  }

  /** Re-read from disk (restart recovery / concurrent tick safety). */
  reload(): void {
    this.load();
  }

  private load(): void {
    const loaded = readJsonSafeSync<{ schemaVersion?: string; grants?: DemoExecutionGrant[] }>(
      this.path,
      { schemaVersion: "demo-execution-grants-v1", grants: [] },
    );
    if (loaded.recovered) {
      this.persistenceDegraded = true;
      this.persistenceError = loaded.error
        ? `Grant store recovered from corrupt file: ${loaded.error}`
        : "Grant store recovered from corrupt/unreadable file.";
      this.grants = [];
      return;
    }
    this.persistenceDegraded = false;
    this.persistenceError = null;
    const raw = loaded.value;
    this.grants = Array.isArray(raw.grants) ? raw.grants : [];
  }

  private save(): void {
    if (this.persistenceDegraded) {
      throw new Error(
        this.persistenceError
          ?? "Grant store persistence is degraded; refusing to overwrite after corrupt load.",
      );
    }
    writeJsonAtomicSync(this.path, {
      schemaVersion: "demo-execution-grants-v1",
      grants: this.grants,
    });
  }

  listActive(nowMs = Date.now()): DemoExecutionGrant[] {
    return this.grants.filter((g) => this.isActive(g, nowMs));
  }

  /**
   * Active DEMO grant that allowlists instrument and maxLots >= lots,
   * with remaining lifetime strictly greater than minRemainingMs.
   */
  findCoveringActive(input: {
    instrument: string;
    lots: number;
    minRemainingMs?: number;
    nowMs?: number;
  }): DemoExecutionGrant | null {
    const nowMs = input.nowMs ?? Date.now();
    const minRemaining = Math.max(0, Math.floor(input.minRemainingMs ?? 0));
    const want = normalizeGrantInstrument(input.instrument);
    const lots = Number(input.lots);
    if (!want || !Number.isFinite(lots) || !(lots > 0)) return null;
    for (const g of this.listActive(nowMs)) {
      const allow = normalizeInstrumentAllowlist(g.instrumentAllowlist);
      if (allow.length === 0) continue;
      if (!allow.some((a) => normalizeGrantInstrument(a) === want)) continue;
      if (Number(g.maxLots ?? 0) < lots) continue;
      const exp = Date.parse(g.expiresAtUtc);
      if (!Number.isFinite(exp)) continue;
      if (exp - nowMs <= minRemaining) continue;
      return g;
    }
    return null;
  }

  isActive(grant: DemoExecutionGrant, nowMs = Date.now()): boolean {
    if (grant.revokedAtUtc) return false;
    if (grant.environment !== "DEMO") return false;
    return Date.parse(grant.expiresAtUtc) > nowMs;
  }

  get(grantId: string): DemoExecutionGrant | null {
    return this.grants.find((g) => g.grantId === grantId) ?? null;
  }

  create(input: {
    ttlMs?: number;
    accountIdMasked?: string | null;
    instrumentAllowlist?: string[];
    maxLots?: number;
  }): DemoExecutionGrant {
    if (this.persistenceDegraded) {
      throw new Error(
        this.persistenceError
          ?? "Grant store persistence is degraded; refusing create after corrupt load.",
      );
    }
    const allowlist = normalizeInstrumentAllowlist(input.instrumentAllowlist);
    if (allowlist.length === 0) {
      throw new GrantAllowlistError(
        "DEMO grant requires a non-empty instrumentAllowlist (e.g. [\"XAU/USD\"]). Empty allowlists are rejected.",
      );
    }

    const ttl = Math.max(60_000, Math.min(MAX_TTL_MS, Math.floor(input.ttlMs ?? DEFAULT_TTL_MS)));
    const maxLotsRaw = Math.floor(Number(input.maxLots ?? 1));
    const maxLots = Number.isFinite(maxLotsRaw)
      ? Math.max(1, Math.min(MAX_LOTS, maxLotsRaw))
      : 1;
    const now = Date.now();
    const grant: DemoExecutionGrant = {
      grantId: randomUUID(),
      createdAtUtc: new Date(now).toISOString(),
      expiresAtUtc: new Date(now + ttl).toISOString(),
      revokedAtUtc: null,
      accountIdMasked: input.accountIdMasked ?? null,
      instrumentAllowlist: allowlist,
      maxLots,
      createdBy: "admin",
      purpose: "PHASE_58_3_DEMO_LIFECYCLE",
      environment: "DEMO",
    };
    this.grants.unshift(grant);
    this.grants = this.grants.slice(0, 50);
    this.save();
    return grant;
  }

  revoke(grantId: string): DemoExecutionGrant | null {
    const g = this.get(grantId);
    if (!g) return null;
    if (!g.revokedAtUtc) {
      g.revokedAtUtc = new Date().toISOString();
      this.save();
    }
    return g;
  }

  requireActive(grantId: string, instrument?: string, lots?: number): {
    ok: true;
    grant: DemoExecutionGrant;
  } | {
    ok: false;
    code: string;
    error: string;
  } {
    if (this.persistenceDegraded) {
      return {
        ok: false,
        code: "GRANT_STORE_PERSISTENCE_DEGRADED",
        error: this.persistenceError
          ?? "Grant store persistence is degraded; refusing authorization.",
      };
    }
    const grant = this.get(grantId);
    if (!grant) return { ok: false, code: "GRANT_NOT_FOUND", error: "DEMO grant not found." };
    if (!this.isActive(grant)) {
      return { ok: false, code: "GRANT_EXPIRED_OR_REVOKED", error: "DEMO grant expired or revoked." };
    }

    // Fail closed: empty/missing allowlist never authorizes any instrument.
    const allow = normalizeInstrumentAllowlist(grant.instrumentAllowlist);
    if (allow.length === 0) {
      return {
        ok: false,
        code: "GRANT_ALLOWLIST_EMPTY",
        error: "DEMO grant has an empty instrument allowlist and cannot authorize any instrument.",
      };
    }

    // Open-market must supply instrument. Close/cancel may omit it and only validate grant liveness;
    // when instrument is provided it must still match the allowlist.
    const instrumentRaw = instrument != null ? String(instrument).trim() : "";
    if (instrumentRaw) {
      const want = normalizeGrantInstrument(instrumentRaw);
      const allowed = allow.some((a) => normalizeGrantInstrument(a) === want);
      if (!allowed) {
        return {
          ok: false,
          code: "INSTRUMENT_NOT_ALLOWLISTED",
          error: "Instrument not on DEMO grant allowlist.",
        };
      }
    }

    if (lots != null && lots > grant.maxLots) {
      return { ok: false, code: "LOTS_EXCEED_GRANT", error: `lots exceeds grant maxLots=${grant.maxLots}.` };
    }
    return { ok: true, grant };
  }
}

let singleton: DemoExecutionGrantStore | null = null;

export function getDemoExecutionGrantStore(): DemoExecutionGrantStore {
  if (!singleton) singleton = new DemoExecutionGrantStore();
  return singleton;
}

export function resetDemoExecutionGrantStoreForTests(): void {
  singleton = null;
}
