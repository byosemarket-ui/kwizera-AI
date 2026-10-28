/**
 * Phase 59.0.13 — Automatic DEMO grant lifecycle (create/renew).
 *
 * Reuses DemoExecutionGrantStore + readiness-style gates.
 * Does NOT submit, amend, cancel, or close broker orders.
 * Default mode is "off" — no grant mutation until owner enables dry_run or enabled.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { resolveStorageRoot } from "../../../../storage/paths/storage-paths.js";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import {
  DEMO_GRANT_DEFAULT_TTL_MS,
  DEMO_GRANT_MAX_LOTS,
  DEMO_GRANT_MAX_TTL_MS,
  getDemoExecutionGrantStore,
  normalizeInstrumentAllowlist,
  type DemoExecutionGrantStore,
} from "./grant-store.js";
import {
  getForexConnectDemoMutationAdapter,
  nodeDemoMutationEnvEnabled,
  nodeMutationSecretFingerprint,
} from "./forexconnect-mutation-adapter.js";
import type { DemoExecutionGrant } from "./types.js";

export type AutoDemoGrantMode = "off" | "dry_run" | "enabled";

export interface AutoDemoGrantConfig {
  mode: AutoDemoGrantMode;
  instruments: string[];
  maxLots: number;
  ttlMs: number;
  renewBeforeMs: number;
  pollIntervalMs: number;
  placesOrdersGlobal: false;
  liveLocked: true;
}

export interface AutoDemoGrantGateResult {
  ok: boolean;
  blockers: string[];
  connected: boolean;
  environment: string | null;
  demoSession: boolean;
  nodeMutationEnvEnabled: boolean;
  sidecarMutationEnvEnabled: boolean;
  nodeMutationSecretConfigured: boolean;
  sidecarMutationSecretConfigured: boolean;
  mutationSecretsConsistent: boolean | null;
  instrumentEligible: boolean;
}

export interface AutoDemoGrantTickResult {
  ok: boolean;
  mode: AutoDemoGrantMode;
  action:
    | "DISABLED"
    | "SKIPPED_IN_FLIGHT"
    | "GATES_BLOCKED"
    | "COVERED"
    | "WOULD_CREATE"
    | "CREATED"
    | "STORAGE_FAILED"
    | "ERROR";
  blockers: string[];
  grantId: string | null;
  coveringGrantId: string | null;
  mutatesGrants: boolean;
  mutatesBroker: false;
  placesOrdersGlobal: false;
  dryRun: boolean;
  message: string;
  atUtc: string;
}

export interface AutoDemoGrantLifecycleStatus {
  ok: true;
  phase: "59.0.13";
  config: AutoDemoGrantConfig;
  running: boolean;
  lastTick: AutoDemoGrantTickResult | null;
  lastError: string | null;
  statePath: string;
  placesOrdersGlobal: false;
  liveLocked: true;
  note: string;
}

type GateEvaluator = (instrument: string) => Promise<AutoDemoGrantGateResult>;

export interface AutoDemoGrantLifecycleDeps {
  store?: DemoExecutionGrantStore;
  evaluateGates?: GateEvaluator;
  nowMs?: () => number;
  pollIntervalMs?: number;
  statePath?: string;
  /** When false, start() is a no-op even if mode is dry_run/enabled (tests). */
  allowTimer?: boolean;
}

function parseMode(raw: string): AutoDemoGrantMode {
  const v = String(raw || "off").trim().toLowerCase();
  if (v === "dry_run" || v === "dry-run" || v === "dryrun") return "dry_run";
  if (v === "enabled" || v === "on" || v === "1" || v === "true" || v === "yes") return "enabled";
  return "off";
}

export function resolveAutoDemoGrantConfig(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): AutoDemoGrantConfig {
  const mode = parseMode(env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE || "off");
  const instruments = normalizeInstrumentAllowlist(
    String(env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_INSTRUMENTS || "XAU/USD")
      .split(/[,;]+/)
      .map((s) => s.trim()),
  );
  const maxLotsRaw = Math.floor(Number(env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MAX_LOTS ?? 1));
  const maxLots = Number.isFinite(maxLotsRaw)
    ? Math.max(1, Math.min(DEMO_GRANT_MAX_LOTS, maxLotsRaw))
    : 1;
  const ttlRaw = Math.floor(Number(env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_TTL_MS ?? DEMO_GRANT_DEFAULT_TTL_MS));
  const ttlMs = Number.isFinite(ttlRaw)
    ? Math.max(60_000, Math.min(DEMO_GRANT_MAX_TTL_MS, ttlRaw))
    : DEMO_GRANT_DEFAULT_TTL_MS;
  const renewRaw = Math.floor(Number(env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_RENEW_BEFORE_MS ?? 120_000));
  const renewBeforeMs = Number.isFinite(renewRaw)
    ? Math.max(30_000, Math.min(ttlMs - 30_000, renewRaw))
    : 120_000;
  const pollRaw = Math.floor(Number(env.KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_POLL_MS ?? 60_000));
  const pollIntervalMs = Number.isFinite(pollRaw)
    ? Math.max(15_000, Math.min(15 * 60_000, pollRaw))
    : 60_000;
  return {
    mode,
    instruments: instruments.length ? instruments : ["XAU/USD"],
    maxLots,
    ttlMs,
    renewBeforeMs,
    pollIntervalMs,
    placesOrdersGlobal: false,
    liveLocked: true,
  };
}

function defaultStatePath(): string {
  return join(resolveStorageRoot(), "forex", "auto-demo-grant-lifecycle.json");
}

async function defaultEvaluateGates(instrument: string): Promise<AutoDemoGrantGateResult> {
  const blockers: string[] = [];
  let connected = false;
  let environment: string | null = null;
  let demoSession = false;
  let sidecarMutationEnvEnabled = false;
  let sidecarMutationSecretConfigured = false;
  let mutationSecretsConsistent: boolean | null = null;
  let instrumentEligible = false;

  const nodeMutationEnvEnabled = nodeDemoMutationEnvEnabled();
  const nodeMutationSecretConfigured = Boolean(
    String(process.env.KWIZERA_FOREXCONNECT_DEMO_MUTATION_SECRET || "").trim(),
  );

  try {
    const bridge = getForexConnectBridge();
    const status = await bridge.getStatus();
    environment = String((status as { environment?: string }).environment || "").toLowerCase() || null;
    connected = String((status as { status?: string }).status || "") === "CONNECTED";
    demoSession = environment === "demo";
    if (!connected) blockers.push("SESSION_NOT_CONNECTED");
    if (!demoSession) blockers.push("ENVIRONMENT_NOT_DEMO");

    const caps = await getForexConnectDemoMutationAdapter().probeSdkCapabilities();
    sidecarMutationEnvEnabled = Boolean((caps as { mutationEnvEnabled?: boolean }).mutationEnvEnabled);
    sidecarMutationSecretConfigured = Boolean(
      (caps as { mutationSecretConfigured?: boolean }).mutationSecretConfigured,
    );
    const nodeFp = nodeMutationSecretFingerprint();
    const sideFpRaw = (caps as { mutationSecretFingerprint?: string | null }).mutationSecretFingerprint;
    const sideFp = sideFpRaw != null && String(sideFpRaw).trim()
      ? String(sideFpRaw).trim().toLowerCase()
      : null;
    if (nodeFp && sideFp) {
      mutationSecretsConsistent = nodeFp === sideFp;
      if (!mutationSecretsConsistent) blockers.push("MUTATION_SECRET_MISMATCH");
    }

    try {
      const { getForexConnectLiveCandleService } = await import(
        "../../../market-data/forexconnect/live-service.js"
      );
      const ensured = await getForexConnectLiveCandleService().ensureValidatedAtInstrument(
        instrument,
        "1m",
      );
      instrumentEligible = Boolean(ensured.ok);
      if (!ensured.ok) blockers.push(String(ensured.code || "INSTRUMENT_NOT_PERMITTED"));
    } catch {
      instrumentEligible = false;
      blockers.push("INSTRUMENT_ELIGIBILITY_UNAVAILABLE");
    }
  } catch {
    blockers.push("FOREXCONNECT_STATUS_UNAVAILABLE");
  }

  if (!nodeMutationEnvEnabled) blockers.push("NODE_MUTATION_ENV_DISABLED");
  if (!sidecarMutationEnvEnabled) blockers.push("SIDECAR_MUTATION_ENV_DISABLED");
  if (!nodeMutationSecretConfigured) blockers.push("NODE_MUTATION_SECRET_NOT_CONFIGURED");
  if (!sidecarMutationSecretConfigured) blockers.push("SIDECAR_MUTATION_SECRET_NOT_CONFIGURED");

  return {
    ok: blockers.length === 0,
    blockers,
    connected,
    environment,
    demoSession,
    nodeMutationEnvEnabled,
    sidecarMutationEnvEnabled,
    nodeMutationSecretConfigured,
    sidecarMutationSecretConfigured,
    mutationSecretsConsistent,
    instrumentEligible,
  };
}

function persistState(path: string, payload: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
}

function appendEvent(path: string, event: Record<string, unknown>): void {
  try {
    const logPath = path.replace(/\.json$/i, ".events.jsonl");
    mkdirSync(dirname(logPath), { recursive: true });
    appendFileSync(logPath, `${JSON.stringify(event)}\n`, "utf8");
  } catch {
    /* event log is best-effort */
  }
}

export class AutoDemoGrantLifecycleWorker {
  private readonly deps: AutoDemoGrantLifecycleDeps;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickInFlight = false;
  private disposed = false;
  private lastTick: AutoDemoGrantTickResult | null = null;
  private lastError: string | null = null;
  private readonly statePath: string;

  constructor(deps: AutoDemoGrantLifecycleDeps = {}) {
    this.deps = deps;
    this.statePath = deps.statePath ?? defaultStatePath();
    this.hydrateLastTick();
  }

  private store(): DemoExecutionGrantStore {
    return this.deps.store ?? getDemoExecutionGrantStore();
  }

  private now(): number {
    return this.deps.nowMs?.() ?? Date.now();
  }

  private hydrateLastTick(): void {
    try {
      if (!existsSync(this.statePath)) return;
      const raw = JSON.parse(readFileSync(this.statePath, "utf8")) as {
        lastTick?: AutoDemoGrantTickResult;
        lastError?: string | null;
      };
      if (raw.lastTick && typeof raw.lastTick === "object") this.lastTick = raw.lastTick;
      if (raw.lastError != null) this.lastError = String(raw.lastError);
    } catch {
      /* corrupt state → start clean; fail closed on next tick if storage broken */
    }
  }

  getConfig(): AutoDemoGrantConfig {
    const cfg = resolveAutoDemoGrantConfig();
    if (this.deps.pollIntervalMs != null) {
      return { ...cfg, pollIntervalMs: this.deps.pollIntervalMs };
    }
    return cfg;
  }

  getStatus(): AutoDemoGrantLifecycleStatus {
    const config = this.getConfig();
    return {
      ok: true,
      phase: "59.0.13",
      config,
      running: this.timer != null,
      lastTick: this.lastTick,
      lastError: this.lastError,
      statePath: this.statePath,
      placesOrdersGlobal: false,
      liveLocked: true,
      note:
        "Auto DEMO grant lifecycle is off by default. dry_run reports WOULD_CREATE without writing grants. enabled creates/renews grants only — never broker orders. Set KWIZERA_FOREXCONNECT_AUTO_DEMO_GRANT_MODE=dry_run|enabled after owner approval.",
    };
  }

  /** Start periodic ticks when mode is dry_run or enabled. Idempotent. */
  start(): void {
    if (this.disposed) return;
    const config = this.getConfig();
    if (config.mode === "off") return;
    if (this.deps.allowTimer === false) return;
    if (this.timer) return;
    const ms = Math.max(15_000, config.pollIntervalMs);
    this.timer = setInterval(() => {
      void this.tick();
    }, ms);
    if (typeof this.timer === "object" && this.timer && "unref" in this.timer) {
      this.timer.unref();
    }
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  /**
   * Idempotent lifecycle tick. Never places broker orders.
   */
  async tick(): Promise<AutoDemoGrantTickResult> {
    const atUtc = new Date(this.now()).toISOString();
    const config = this.getConfig();

    if (config.mode === "off") {
      const result: AutoDemoGrantTickResult = {
        ok: true,
        mode: "off",
        action: "DISABLED",
        blockers: [],
        grantId: null,
        coveringGrantId: null,
        mutatesGrants: false,
        mutatesBroker: false,
        placesOrdersGlobal: false,
        dryRun: false,
        message: "Auto DEMO grant lifecycle is disabled (mode=off).",
        atUtc,
      };
      this.record(result, null);
      return result;
    }

    if (this.tickInFlight) {
      const result: AutoDemoGrantTickResult = {
        ok: true,
        mode: config.mode,
        action: "SKIPPED_IN_FLIGHT",
        blockers: [],
        grantId: null,
        coveringGrantId: this.lastTick?.grantId ?? null,
        mutatesGrants: false,
        mutatesBroker: false,
        placesOrdersGlobal: false,
        dryRun: config.mode === "dry_run",
        message: "Skipped overlapping lifecycle tick.",
        atUtc,
      };
      return result;
    }

    this.tickInFlight = true;
    try {
      if (!config.instruments.length) {
        const result: AutoDemoGrantTickResult = {
          ok: false,
          mode: config.mode,
          action: "GATES_BLOCKED",
          blockers: ["AUTO_GRANT_INSTRUMENTS_EMPTY"],
          grantId: null,
          coveringGrantId: null,
          mutatesGrants: false,
          mutatesBroker: false,
          placesOrdersGlobal: false,
          dryRun: config.mode === "dry_run",
          message: "Configured instrument allowlist is empty.",
          atUtc,
        };
        this.record(result, null);
        return result;
      }

      // One instrument policy for v1 (XAU/USD default); extend later without schema change.
      const instrument = config.instruments[0];
      const evaluate = this.deps.evaluateGates ?? defaultEvaluateGates;
      const gates = await evaluate(instrument);
      if (!gates.ok) {
        const result: AutoDemoGrantTickResult = {
          ok: false,
          mode: config.mode,
          action: "GATES_BLOCKED",
          blockers: gates.blockers,
          grantId: null,
          coveringGrantId: null,
          mutatesGrants: false,
          mutatesBroker: false,
          placesOrdersGlobal: false,
          dryRun: config.mode === "dry_run",
          message: `Auto grant blocked: ${gates.blockers.join(",")}`,
          atUtc,
        };
        this.record(result, null);
        return result;
      }

      const store = this.store();
      try {
        store.reload();
      } catch (error) {
        const result: AutoDemoGrantTickResult = {
          ok: false,
          mode: config.mode,
          action: "STORAGE_FAILED",
          blockers: ["GRANT_STORE_RELOAD_FAILED"],
          grantId: null,
          coveringGrantId: null,
          mutatesGrants: false,
          mutatesBroker: false,
          placesOrdersGlobal: false,
          dryRun: config.mode === "dry_run",
          message: error instanceof Error ? error.message : "Grant store reload failed.",
          atUtc,
        };
        this.record(result, result.message);
        return result;
      }

      const covering = store.findCoveringActive({
        instrument,
        lots: config.maxLots,
        minRemainingMs: config.renewBeforeMs,
        nowMs: this.now(),
      });
      if (covering) {
        const result: AutoDemoGrantTickResult = {
          ok: true,
          mode: config.mode,
          action: "COVERED",
          blockers: [],
          grantId: covering.grantId,
          coveringGrantId: covering.grantId,
          mutatesGrants: false,
          mutatesBroker: false,
          placesOrdersGlobal: false,
          dryRun: config.mode === "dry_run",
          message: `Active covering grant ${covering.grantId} still within renew window.`,
          atUtc,
        };
        this.record(result, null);
        return result;
      }

      if (config.mode === "dry_run") {
        const result: AutoDemoGrantTickResult = {
          ok: true,
          mode: "dry_run",
          action: "WOULD_CREATE",
          blockers: [],
          grantId: null,
          coveringGrantId: null,
          mutatesGrants: false,
          mutatesBroker: false,
          placesOrdersGlobal: false,
          dryRun: true,
          message:
            `Dry-run: would create DEMO grant for ${instrument} maxLots=${config.maxLots} ttlMs=${config.ttlMs}.`,
          atUtc,
        };
        this.record(result, null);
        return result;
      }

      // Re-check covering under lock-ish in-flight flag after reload (idempotent).
      store.reload();
      const race = store.findCoveringActive({
        instrument,
        lots: config.maxLots,
        minRemainingMs: config.renewBeforeMs,
        nowMs: this.now(),
      });
      if (race) {
        const result: AutoDemoGrantTickResult = {
          ok: true,
          mode: config.mode,
          action: "COVERED",
          blockers: [],
          grantId: race.grantId,
          coveringGrantId: race.grantId,
          mutatesGrants: false,
          mutatesBroker: false,
          placesOrdersGlobal: false,
          dryRun: false,
          message: `Concurrent tick found covering grant ${race.grantId}.`,
          atUtc,
        };
        this.record(result, null);
        return result;
      }

      let grant: DemoExecutionGrant;
      try {
        grant = store.create({
          ttlMs: config.ttlMs,
          maxLots: config.maxLots,
          instrumentAllowlist: config.instruments,
          accountIdMasked: null,
        });
      } catch (error) {
        const result: AutoDemoGrantTickResult = {
          ok: false,
          mode: config.mode,
          action: "STORAGE_FAILED",
          blockers: ["GRANT_CREATE_FAILED"],
          grantId: null,
          coveringGrantId: null,
          mutatesGrants: false,
          mutatesBroker: false,
          placesOrdersGlobal: false,
          dryRun: false,
          message: error instanceof Error ? error.message : "Grant create failed.",
          atUtc,
        };
        this.record(result, result.message);
        return result;
      }

      const result: AutoDemoGrantTickResult = {
        ok: true,
        mode: "enabled",
        action: "CREATED",
        blockers: [],
        grantId: grant.grantId,
        coveringGrantId: grant.grantId,
        mutatesGrants: true,
        mutatesBroker: false,
        placesOrdersGlobal: false,
        dryRun: false,
        message:
          `Created DEMO grant ${grant.grantId} for ${instrument} (ttlMs=${config.ttlMs}, maxLots=${config.maxLots}). No broker order submitted.`,
        atUtc,
      };
      this.record(result, null);
      return result;
    } catch (error) {
      const result: AutoDemoGrantTickResult = {
        ok: false,
        mode: config.mode,
        action: "ERROR",
        blockers: ["AUTO_GRANT_TICK_ERROR"],
        grantId: null,
        coveringGrantId: null,
        mutatesGrants: false,
        mutatesBroker: false,
        placesOrdersGlobal: false,
        dryRun: config.mode === "dry_run",
        message: error instanceof Error ? error.message : "Auto grant tick failed.",
        atUtc,
      };
      this.record(result, result.message);
      return result;
    } finally {
      this.tickInFlight = false;
    }
  }

  private record(result: AutoDemoGrantTickResult, error: string | null): void {
    this.lastTick = result;
    this.lastError = error;
    try {
      persistState(this.statePath, {
        schemaVersion: "auto-demo-grant-lifecycle-v1",
        updatedAtUtc: result.atUtc,
        config: this.getConfig(),
        lastTick: result,
        lastError: error,
        placesOrdersGlobal: false,
        liveLocked: true,
      });
      appendEvent(this.statePath, {
        atUtc: result.atUtc,
        action: result.action,
        mode: result.mode,
        grantId: result.grantId,
        blockers: result.blockers,
        mutatesGrants: result.mutatesGrants,
        mutatesBroker: false,
      });
    } catch (persistError) {
      this.lastError = persistError instanceof Error
        ? persistError.message
        : "Failed to persist auto-grant lifecycle state.";
    }
  }
}

let singleton: AutoDemoGrantLifecycleWorker | null = null;

export function getAutoDemoGrantLifecycleWorker(
  deps?: AutoDemoGrantLifecycleDeps,
): AutoDemoGrantLifecycleWorker {
  if (deps) return new AutoDemoGrantLifecycleWorker(deps);
  if (!singleton) singleton = new AutoDemoGrantLifecycleWorker();
  return singleton;
}

export function resetAutoDemoGrantLifecycleWorkerForTests(): void {
  singleton?.dispose();
  singleton = null;
}

/**
 * Resume from process boot: starts timer only when mode is dry_run|enabled.
 * Safe to call repeatedly. Never enables broker mutation.
 */
export function resumeAutoDemoGrantLifecycleFromPersistence(): void {
  const worker = getAutoDemoGrantLifecycleWorker();
  worker.start();
}
