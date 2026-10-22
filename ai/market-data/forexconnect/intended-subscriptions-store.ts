/**
 * Phase 56.3.4 — durable ForexConnect intended-subscription intent.
 * Persists only recovery intent (symbol + timeframe + env). Never stores credentials,
 * tokens, live quotes, or order state. Uses the existing safe-json atomic store pattern.
 */
import fs from "node:fs";
import path from "node:path";
import { readJsonSafeSync, writeJsonAtomic } from "../../../storage/safe-json.js";
import {
  isForexConnectSupportedTimeframe,
  type ForexConnectSupportedTimeframe,
} from "./timeframes.js";
import { normalizeCanonicalSymbol } from "../providers/identity.js";

export const FOREXCONNECT_INTENDED_SCHEMA_VERSION = "56.3.4";
export const FOREXCONNECT_INTENDED_FILE_VERSION = 1 as const;
/** Cap persisted intents — mirrors live-service MAX_SERIES. */
export const FOREXCONNECT_INTENDED_MAX_ENTRIES = 32;

export type ForexConnectPersistedEnvironment = "demo" | "live";

export interface ForexConnectPersistedIntendedEntry {
  providerSymbol: string;
  timeframe: ForexConnectSupportedTimeframe;
  rememberedAtMs: number;
  canonicalSymbol?: string;
}

export interface ForexConnectIntendedSubscriptionsFile {
  version: typeof FOREXCONNECT_INTENDED_FILE_VERSION;
  schemaVersion: string;
  provider: "FOREXCONNECT";
  /** Provider/connection context — restore only when it matches the active session. */
  environment: ForexConnectPersistedEnvironment | null;
  updatedAtMs: number;
  subscriptions: ForexConnectPersistedIntendedEntry[];
}

export interface ForexConnectIntendedHydrateResult {
  ok: boolean;
  loaded: ForexConnectPersistedIntendedEntry[];
  skipped: Array<{ reason: string; providerSymbol?: string; timeframe?: string }>;
  environment: ForexConnectPersistedEnvironment | null;
  recoveredCorrupt: boolean;
  error: string | null;
  storePath: string;
  placesOrders: false;
  acceptsForExecution: false;
}

const EMPTY: ForexConnectIntendedSubscriptionsFile = {
  version: FOREXCONNECT_INTENDED_FILE_VERSION,
  schemaVersion: FOREXCONNECT_INTENDED_SCHEMA_VERSION,
  provider: "FOREXCONNECT",
  environment: null,
  updatedAtMs: 0,
  subscriptions: [],
};

function resolveDefaultStorageRoot(): string {
  const fromEnv = String(process.env.KWIZERA_STORAGE_ROOT ?? "").trim();
  if (fromEnv) return fromEnv;
  return path.join(process.cwd(), "data");
}

export function normalizeForexConnectPersistedEnvironment(
  value: unknown,
): ForexConnectPersistedEnvironment | null {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "demo" || raw === "demo.fxcm.com" || raw.includes("demo")) return "demo";
  if (raw === "live" || raw === "real" || raw === "real.fxcm.com" || raw.includes("real")) {
    return "live";
  }
  return null;
}

function isSafeProviderSymbol(symbol: string): boolean {
  const s = symbol.trim();
  if (!s || s.length > 64) return false;
  // Allow FX pairs (EUR/USD), metals, indices, share suffixes (AAPL.us).
  // Reject path traversal and control characters — '/' is a normal pair separator.
  if (/[\\\0\n\r\t]/.test(s)) return false;
  if (s.includes("..")) return false;
  if (!/^[A-Za-z0-9./_\-]+$/.test(s)) return false;
  return true;
}

export function validatePersistedIntendedEntry(
  raw: unknown,
  options?: { catalogSymbols?: ReadonlySet<string> | null },
): { ok: true; entry: ForexConnectPersistedIntendedEntry } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "entry_not_object" };
  }
  const row = raw as Record<string, unknown>;
  const providerSymbol = String(row.providerSymbol ?? "").trim();
  const timeframe = String(row.timeframe ?? "").trim();
  const rememberedAtMs = Number(row.rememberedAtMs ?? 0);
  if (!isSafeProviderSymbol(providerSymbol)) {
    return { ok: false, reason: "invalid_provider_symbol" };
  }
  if (!isForexConnectSupportedTimeframe(timeframe)) {
    return { ok: false, reason: "unsupported_timeframe" };
  }
  if (!Number.isFinite(rememberedAtMs) || rememberedAtMs < 0) {
    return { ok: false, reason: "invalid_rememberedAtMs" };
  }
  const catalog = options?.catalogSymbols;
  if (catalog && catalog.size > 0) {
    const canon = normalizeCanonicalSymbol(providerSymbol);
    const upper = providerSymbol.toUpperCase();
    const hit = [...catalog].some((c) => {
      const u = String(c).toUpperCase();
      return u === upper
        || normalizeCanonicalSymbol(String(c)) === canon;
    });
    if (!hit) {
      return { ok: false, reason: "not_in_provider_catalog" };
    }
  }
  return {
    ok: true,
    entry: {
      providerSymbol,
      timeframe,
      rememberedAtMs: Math.floor(rememberedAtMs) || Date.now(),
      canonicalSymbol: normalizeCanonicalSymbol(providerSymbol),
    },
  };
}

export class ForexConnectIntendedSubscriptionsStore {
  private readonly rootDir: string;
  private readonly storePath: string;
  private ready = false;
  private writeChain: Promise<void> = Promise.resolve();
  private lastError: string | null = null;
  private lastWriteAtMs: number | null = null;
  private lastHydrateAtMs: number | null = null;
  private lastRecoveredCorrupt = false;

  constructor(storageRoot?: string) {
    this.rootDir = path.join(storageRoot ?? resolveDefaultStorageRoot(), "forexconnect");
    this.storePath = path.join(this.rootDir, "intended-subscriptions.json");
  }

  get path(): string {
    return this.storePath;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  getDiagnostics(): {
    storePath: string;
    lastError: string | null;
    lastWriteAtMs: number | null;
    lastHydrateAtMs: number | null;
    lastRecoveredCorrupt: boolean;
    placesOrders: false;
    acceptsForExecution: false;
  } {
    return {
      storePath: this.storePath,
      lastError: this.lastError,
      lastWriteAtMs: this.lastWriteAtMs,
      lastHydrateAtMs: this.lastHydrateAtMs,
      lastRecoveredCorrupt: this.lastRecoveredCorrupt,
      placesOrders: false,
      acceptsForExecution: false,
    };
  }

  async ensureReady(): Promise<void> {
    if (this.ready) return;
    fs.mkdirSync(this.rootDir, { recursive: true });
    if (!fs.existsSync(this.storePath)) {
      await writeJsonAtomic(this.storePath, EMPTY);
    }
    this.ready = true;
  }

  private readFile(): { file: ForexConnectIntendedSubscriptionsFile; recovered: boolean; error: string | null } {
    const result = readJsonSafeSync<ForexConnectIntendedSubscriptionsFile>(this.storePath, EMPTY);
    this.lastRecoveredCorrupt = Boolean(result.recovered);
    if (result.error) this.lastError = result.error.slice(0, 300);
    const value = result.value ?? EMPTY;
    if (value.version !== FOREXCONNECT_INTENDED_FILE_VERSION) {
      this.lastError = `unsupported_store_version:${String(value.version)}`;
      return {
        file: { ...EMPTY },
        recovered: true,
        error: this.lastError,
      };
    }
    if (
      value.schemaVersion
      && value.schemaVersion !== FOREXCONNECT_INTENDED_SCHEMA_VERSION
      && !String(value.schemaVersion).startsWith("56.3.")
    ) {
      this.lastError = `incompatible_schema:${value.schemaVersion}`;
      return {
        file: { ...EMPTY },
        recovered: true,
        error: this.lastError,
      };
    }
    return {
      file: {
        version: FOREXCONNECT_INTENDED_FILE_VERSION,
        schemaVersion: FOREXCONNECT_INTENDED_SCHEMA_VERSION,
        provider: "FOREXCONNECT",
        environment: normalizeForexConnectPersistedEnvironment(value.environment),
        updatedAtMs: Number(value.updatedAtMs) || 0,
        subscriptions: Array.isArray(value.subscriptions) ? value.subscriptions : [],
      },
      recovered: Boolean(result.recovered),
      error: result.error ?? null,
    };
  }

  /**
   * Load and validate persisted intents for the active environment.
   * Never invents LIVE — caller must restore sessions and wait for genuine quotes.
   */
  async hydrate(options?: {
    environment?: string | null;
    catalogSymbols?: ReadonlySet<string> | null;
  }): Promise<ForexConnectIntendedHydrateResult> {
    const skipped: ForexConnectIntendedHydrateResult["skipped"] = [];
    try {
      await this.ensureReady();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message.slice(0, 300);
      return {
        ok: false,
        loaded: [],
        skipped: [{ reason: "persistence_unavailable" }],
        environment: null,
        recoveredCorrupt: false,
        error: this.lastError,
        storePath: this.storePath,
        placesOrders: false,
        acceptsForExecution: false,
      };
    }

    const { file, recovered, error } = this.readFile();
    this.lastHydrateAtMs = Date.now();
    const activeEnv = normalizeForexConnectPersistedEnvironment(options?.environment);
    if (file.environment && activeEnv && file.environment !== activeEnv) {
      skipped.push({
        reason: `environment_mismatch:store=${file.environment}:active=${activeEnv}`,
      });
      return {
        ok: true,
        loaded: [],
        skipped,
        environment: file.environment,
        recoveredCorrupt: recovered,
        error: error,
        storePath: this.storePath,
        placesOrders: false,
        acceptsForExecution: false,
      };
    }

    const loaded: ForexConnectPersistedIntendedEntry[] = [];
    const seen = new Set<string>();
    for (const raw of file.subscriptions) {
      const validated = validatePersistedIntendedEntry(raw, {
        catalogSymbols: options?.catalogSymbols ?? null,
      });
      if (!validated.ok) {
        const row = raw && typeof raw === "object"
          ? (raw as Record<string, unknown>)
          : {};
        skipped.push({
          reason: validated.reason,
          providerSymbol: row.providerSymbol != null ? String(row.providerSymbol) : undefined,
          timeframe: row.timeframe != null ? String(row.timeframe) : undefined,
        });
        continue;
      }
      const key = `${normalizeCanonicalSymbol(validated.entry.providerSymbol)}:${validated.entry.timeframe}`;
      if (seen.has(key)) {
        skipped.push({
          reason: "duplicate",
          providerSymbol: validated.entry.providerSymbol,
          timeframe: validated.entry.timeframe,
        });
        continue;
      }
      seen.add(key);
      loaded.push(validated.entry);
      if (loaded.length >= FOREXCONNECT_INTENDED_MAX_ENTRIES) break;
    }

    return {
      ok: true,
      loaded,
      skipped,
      environment: file.environment ?? activeEnv,
      recoveredCorrupt: recovered,
      error: error,
      storePath: this.storePath,
      placesOrders: false,
      acceptsForExecution: false,
    };
  }

  async save(
    environment: ForexConnectPersistedEnvironment | null,
    subscriptions: ForexConnectPersistedIntendedEntry[],
  ): Promise<void> {
    const run = this.writeChain.then(async () => {
      await this.ensureReady();
      const deduped: ForexConnectPersistedIntendedEntry[] = [];
      const seen = new Set<string>();
      for (const row of subscriptions) {
        const validated = validatePersistedIntendedEntry(row);
        if (!validated.ok) continue;
        const key = `${normalizeCanonicalSymbol(validated.entry.providerSymbol)}:${validated.entry.timeframe}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(validated.entry);
        if (deduped.length >= FOREXCONNECT_INTENDED_MAX_ENTRIES) break;
      }
      const file: ForexConnectIntendedSubscriptionsFile = {
        version: FOREXCONNECT_INTENDED_FILE_VERSION,
        schemaVersion: FOREXCONNECT_INTENDED_SCHEMA_VERSION,
        provider: "FOREXCONNECT",
        environment,
        updatedAtMs: Date.now(),
        subscriptions: deduped,
      };
      await writeJsonAtomic(this.storePath, file);
      this.lastWriteAtMs = file.updatedAtMs;
      this.lastError = null;
    });
    this.writeChain = run.then(() => undefined, (error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = message.slice(0, 300);
    });
    await run;
  }

  async clear(): Promise<void> {
    await this.save(null, []);
  }
}
