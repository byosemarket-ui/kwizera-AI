/**
 * Phase 53.1 / 53.3 / 4.18F.7 — Single-process AT monitoring worker (server-side).
 * Does not depend on browser/React. Never places broker orders.
 * Analyses require validated FXCM OHLC + server-rendered chart image in OpenAI request.
 * Image + evidence consume one immutable observation snapshot (no mid-path refetch).
 */
import fs from "node:fs";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AutomatedTradingVerificationResult } from "../verification-types.js";
import {
  isVerificationAccountIdentityOk,
  evaluateVerificationMarketQuoteFreshness,
  verificationLastQuoteChangeAtUtc,
} from "../verification-gates.js";
import {
  getAtOpenAiAnalysisEngine,
  AT_MTF_EVIDENCE_TIMEFRAMES,
  runCanonicalAnalysis,
  createCanonicalAnalysisProductionDeps,
  type AtOpenAiAnalysisEngine,
} from "../analysis/index.js";
import {
  buildAtObservationSnapshot,
  createChartImageBinding,
  validateImageEvidenceBinding,
  AT_PLATFORM_SCREENSHOT_AVAILABLE,
  AT_PLATFORM_SCREENSHOT_BLOCKER,
} from "../analysis/observation-snapshot.js";
import { validateEvidenceIntegrity } from "../analysis/evidence-integrity.js";
import type { StrategyCandle } from "../auto-engine/strategy/rules.js";
import { overlaysFromObservationSnapshot, renderAtMarketChartPng } from "./chart-render.js";
import {
  AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
  AT_ANALYSIS_SCHEDULE_SLOT_GRACE_MS,
  AT_MONITOR_ANALYSIS_COOLDOWN_MS,
  AT_MONITOR_MAX_RETRIES,
  AT_MONITOR_RETRY_BACKOFF_MS,
  decideFiveMinuteSlot,
  fiveMinuteBoundarySec,
  latestClosedCandleOpenSec,
  nextFiveMinuteBoundaryUtc,
  scheduledSlotDedupeKey,
  type AtAnalysisTrigger,
} from "./schedule.js";
import {
  chartImageDir,
  chartImagePath,
  getAtMonitorStore,
  pruneChartImages,
  type AtMonitorStore,
} from "./store.js";
import {
  AT_MONITOR_TIMEFRAME_LABELS,
  AT_MONITOR_TIMEFRAMES,
  parseAtMonitorTimeframe,
  type AtMonitorTimeframe,
} from "./timeframes.js";
import {
  AT_MONITOR_CYCLE_TERMINAL_MAX,
  AT_MONITOR_PHASE,
  AT_MONITOR_SCHEMA,
  defaultMonitorHealth,
  type AtAutomaticAnalysisStatus,
  type AtMonitorConfig,
  type AtMonitorCycleTerminal,
  type AtMonitorCycleTerminalStatus,
  type AtMonitorPublicStatus,
  type AtMonitorWorkerState,
} from "./types.js";
import { deriveAtAutomaticAnalysisStatus } from "./status.js";

function nowIso(): string {
  return new Date().toISOString();
}

function mapCandles(raw: unknown): Array<{
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ time: number; open: number; high: number; low: number; close: number }> = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const open = Number(o.open);
    const high = Number(o.high);
    const low = Number(o.low);
    const close = Number(o.close);
    if (![open, high, low, close].every((x) => Number.isFinite(x))) continue;
    const tRaw = o.time ?? o.timestamp ?? o.t;
    const t = typeof tRaw === "number" ? tRaw : Number(tRaw);
    if (!Number.isFinite(t)) continue;
    // Normalize ms → sec if needed
    const time = t > 1e12 ? Math.floor(t / 1000) : Math.floor(t);
    out.push({ time, open, high, low, close });
  }
  out.sort((a, b) => a.time - b.time);
  return out;
}

export interface AtMonitorWorkerDeps {
  store?: AtMonitorStore;
  analysisEngine?: AtOpenAiAnalysisEngine;
  storageRoot?: string;
  loadCandles?: (symbol: string, timeframe: string) => Promise<ReturnType<typeof mapCandles>>;
  getVerification?: (
    environment: AutomatedTradingEnvironment,
  ) => AutomatedTradingVerificationResult | null;
  getEnvironmentEpoch?: () => number;
  getSelectedEnvironment?: () => AutomatedTradingEnvironment;
  /**
   * Refresh Phase-52 verification / live quotes before a scheduled cycle freshness gate.
   * Prevents aged lastVerification snapshots from falsely blocking LIVE markets.
   */
  refreshVerification?: (input: {
    environment: AutomatedTradingEnvironment;
    instrument: string;
    timeframe: AtMonitorTimeframe;
  }) => Promise<AutomatedTradingVerificationResult | null>;
  /** When false, scheduled ticks must not start analysis (System Master OFF). */
  isSystemMasterOn?: () => boolean;
  pollIntervalMs?: number;
  /** Disable auto-timer (tests). */
  autoStart?: boolean;
  /**
   * Optional canonical reconciler hook (defaults to production ForexConnect deps).
   * Analysis-only — never places orders. Tests may inject a stub.
   */
  runCanonical?: (input: {
    environment: AutomatedTradingEnvironment;
    instrument: string;
    timeframe: string;
    trigger: AtAnalysisTrigger;
    openAiAnalysis: import("../analysis/types.js").AtOpenAiAnalysisResult | null;
  }) => Promise<{
    ok: boolean;
    result: {
      finalOutcome: string;
      direction: "BUY" | "SELL" | null;
      confidencePct: number | null;
      reconciliationCode?: string | null;
    } | null;
  }>;
}

export class AtMonitorWorker {
  private readonly store: AtMonitorStore;
  private readonly engine: AtOpenAiAnalysisEngine;
  private readonly storageRoot?: string;
  private readonly deps: AtMonitorWorkerDeps;
  private timer: ReturnType<typeof setInterval> | null = null;
  private boundaryTimer: ReturnType<typeof setTimeout> | null = null;
  private tickInFlight = false;
  private analysisInFlight = false;
  private disposed = false;
  private lastAnalysisAttemptMs = 0;
  private runtimeActive = false;
  private runtimeState: AtMonitorWorkerState = "STOPPED";
  /** When verification updates mid-tick, schedule one immediate follow-up evaluation. */
  private pendingVerificationNudge = false;
  private lastFreshnessReasonLogged: string | null = null;
  private cycleStartedAtMs: number | null = null;
  private cycleScheduledAtUtc: string | null = null;
  private cycleSlotSec: number | null = null;

  private async recordCycleTerminal(input: {
    slotSec: number;
    scheduledAtUtc: string;
    startedAtUtc?: string | null;
    terminalStatus: AtMonitorCycleTerminalStatus;
    trigger?: "scheduled" | "manual";
    analysisId?: string | null;
    observationId?: string | null;
    imageId?: string | null;
    imageHash?: string | null;
    lifecycle?: string | null;
    canonicalFinalOutcome?: string | null;
    blockerCode?: string | null;
    includedImageBytesInRequest?: boolean | null;
    durationMs?: number | null;
  }): Promise<void> {
    const completedAtUtc = nowIso();
    const startedAtUtc =
      input.startedAtUtc
      ?? (this.cycleStartedAtMs != null ? new Date(this.cycleStartedAtMs).toISOString() : null);
    const durationMs =
      input.durationMs
      ?? (this.cycleStartedAtMs != null ? Math.max(0, Date.now() - this.cycleStartedAtMs) : null);
    const terminal: AtMonitorCycleTerminal = {
      slotSec: input.slotSec,
      scheduledAtUtc: input.scheduledAtUtc,
      startedAtUtc,
      completedAtUtc,
      durationMs,
      terminalStatus: input.terminalStatus,
      trigger: input.trigger ?? "scheduled",
      analysisId: input.analysisId ?? null,
      observationId: input.observationId ?? null,
      imageId: input.imageId ?? null,
      imageHash: input.imageHash ?? null,
      lifecycle: input.lifecycle ?? null,
      canonicalFinalOutcome: input.canonicalFinalOutcome ?? null,
      blockerCode: input.blockerCode ?? null,
      includedImageBytesInRequest: input.includedImageBytesInRequest ?? null,
    };
    await this.store.update((s) => {
      const prior = Array.isArray(s.health.recentCycleTerminals) ? s.health.recentCycleTerminals : [];
      // Replace same-slot terminal if re-recorded; keep newest first.
      const filtered = prior.filter((t) => t.slotSec !== terminal.slotSec);
      return {
        ...s,
        health: {
          ...s.health,
          lastCycleStartedAtUtc: startedAtUtc ?? s.health.lastCycleStartedAtUtc,
          lastCycleCompletedAtUtc: completedAtUtc,
          lastCycleDurationMs: durationMs,
          lastCycleTerminalStatus: terminal.terminalStatus,
          lastScheduleSlotSec: Math.max(s.health.lastScheduleSlotSec ?? 0, terminal.slotSec),
          lastScheduledAtUtc: terminal.scheduledAtUtc,
          recentCycleTerminals: [terminal, ...filtered].slice(0, AT_MONITOR_CYCLE_TERMINAL_MAX),
        },
      };
    });
  }

  constructor(deps: AtMonitorWorkerDeps = {}) {
    this.deps = { ...deps };
    this.store = deps.store ?? getAtMonitorStore(deps.storageRoot);
    this.engine = deps.analysisEngine ?? getAtOpenAiAnalysisEngine(deps.storageRoot);
    this.storageRoot = deps.storageRoot;
    // Default: do not resume until runtime hooks are bound (see resumeFromPersistence).
    // autoStart:true is reserved for tests that inject deps up front.
    if (deps.autoStart === true) {
      this.ensureTimer();
      void this.bootstrapFromPersistence();
    }
  }

  /** Bind AT store readers after construction (avoids circular init). */
  bindRuntimeHooks(hooks: {
    getVerification?: (
      environment: AutomatedTradingEnvironment,
    ) => AutomatedTradingVerificationResult | null;
    getEnvironmentEpoch?: () => number;
    getSelectedEnvironment?: () => AutomatedTradingEnvironment;
    refreshVerification?: AtMonitorWorkerDeps["refreshVerification"];
    isSystemMasterOn?: () => boolean;
  }): void {
    if (hooks.getVerification) this.deps.getVerification = hooks.getVerification;
    if (hooks.getEnvironmentEpoch) this.deps.getEnvironmentEpoch = hooks.getEnvironmentEpoch;
    if (hooks.getSelectedEnvironment) this.deps.getSelectedEnvironment = hooks.getSelectedEnvironment;
    if (hooks.refreshVerification) this.deps.refreshVerification = hooks.refreshVerification;
    if (hooks.isSystemMasterOn) this.deps.isSystemMasterOn = hooks.isSystemMasterOn;
  }

  private automaticStatusPatch(input: {
    lastBlockerCode?: string | null;
    workerActive?: boolean;
    enabled?: boolean;
    analysisInFlight?: boolean;
    lastSuccessfulAnalysisAtUtc?: string | null;
    lastCycleTerminalStatus?: AtMonitorCycleTerminalStatus | null;
  } = {}): AtAutomaticAnalysisStatus {
    const s = this.store.getState();
    return deriveAtAutomaticAnalysisStatus({
      enabled: input.enabled ?? Boolean(s.config?.enabled),
      workerActive:
        input.workerActive
        ?? (this.runtimeActive && Boolean(s.config?.enabled)),
      analysisInFlight: input.analysisInFlight ?? this.analysisInFlight,
      lastBlockerCode:
        input.lastBlockerCode !== undefined
          ? input.lastBlockerCode
          : s.health.lastBlockerCode,
      lastSuccessfulAnalysisAtUtc:
        input.lastSuccessfulAnalysisAtUtc !== undefined
          ? input.lastSuccessfulAnalysisAtUtc
          : s.health.lastSuccessfulAnalysisAtUtc,
      lastCycleTerminalStatus:
        input.lastCycleTerminalStatus !== undefined
          ? input.lastCycleTerminalStatus
          : s.health.lastCycleTerminalStatus,
    });
  }

  private armBoundaryWake(): void {
    if (this.disposed) return;
    if (this.boundaryTimer) {
      clearTimeout(this.boundaryTimer);
      this.boundaryTimer = null;
    }
    const nextAt = Date.parse(nextFiveMinuteBoundaryUtc());
    const delay = Number.isFinite(nextAt)
      ? Math.max(500, nextAt - Date.now() + 400)
      : AT_ANALYSIS_SCHEDULE_INTERVAL_MS;
    this.boundaryTimer = setTimeout(() => {
      this.boundaryTimer = null;
      this.onBoundaryWake();
    }, delay);
    if (typeof this.boundaryTimer === "object" && this.boundaryTimer && "unref" in this.boundaryTimer) {
      this.boundaryTimer.unref();
    }
  }

  /**
   * Fire a schedule wake. If a prior tick still holds the lock, retry every 2s
   * while inside the current slot grace — never jump to the next boundary and
   * orphan the active slot as SCHEDULE_SLOT_MISSED.
   */
  private onBoundaryWake(): void {
    if (this.disposed) return;
    if (this.tickInFlight) {
      const slotSec = fiveMinuteBoundarySec();
      const ageInSlotMs = Math.max(0, Date.now() - slotSec * 1000);
      if (ageInSlotMs < AT_ANALYSIS_SCHEDULE_SLOT_GRACE_MS) {
        this.boundaryTimer = setTimeout(() => {
          this.boundaryTimer = null;
          this.onBoundaryWake();
        }, 2_000);
        if (typeof this.boundaryTimer === "object" && this.boundaryTimer && "unref" in this.boundaryTimer) {
          this.boundaryTimer.unref();
        }
        return;
      }
    }
    void this.tick();
    this.armBoundaryWake();
  }

  /**
   * Phase 53.3 — After hooks are bound, restore enabled monitoring from disk.
   * Safe to call repeatedly (idempotent timer + bootstrap).
   */
  resumeFromPersistence(): void {
    if (this.disposed) return;
    this.ensureTimer();
    void this.bootstrapFromPersistence();
  }

  /**
   * Immediately re-evaluate freshness after Phase 52 verification updates the shared snapshot.
   * Prevents UI PASS Market data vs worker STALE_QUOTES lag across the poll interval.
   */
  notifyVerificationUpdated(): void {
    if (this.disposed) return;
    this.pendingVerificationNudge = true;
    if (!this.tickInFlight) {
      void this.tick();
    }
  }

  private ensureTimer(): void {
    if (this.disposed) return;
    if (!this.timer) {
      const ms = this.deps.pollIntervalMs
        ?? this.store.getState().config?.pollIntervalMs
        ?? 15_000;
      this.timer = setInterval(() => {
        void this.tick();
      }, Math.max(15_000, ms));
      if (typeof this.timer === "object" && this.timer && "unref" in this.timer) {
        this.timer.unref();
      }
    }
    this.armBoundaryWake();
  }

  private async bootstrapFromPersistence(): Promise<void> {
    const state = this.store.getState();
    if (!state.config?.enabled) {
      this.runtimeActive = false;
      this.runtimeState = "STOPPED";
      await this.patchHealth({
        workerState: "STOPPED",
        workerActive: false,
        automaticAnalysisStatus: "STOPPED",
        scheduleIntervalMs: AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
        nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
      });
      return;
    }

    // Resume only when environment selection still matches persisted config.
    const selected = this.deps.getSelectedEnvironment?.();
    if (selected && selected !== state.config.environment) {
      this.runtimeActive = false;
      this.runtimeState = "PAUSED_SAFETY";
      await this.patchHealth({
        workerState: "PAUSED_SAFETY",
        workerActive: false,
        lastBlockerCode: "ENVIRONMENT_MISMATCH",
        lastError:
          "Monitoring not resumed after restart — selected AT environment no longer matches persisted monitor config.",
        automaticAnalysisStatus: this.automaticStatusPatch({
          workerActive: false,
          lastBlockerCode: "ENVIRONMENT_MISMATCH",
        }),
        scheduleIntervalMs: AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
        nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
      });
      return;
    }

    this.runtimeActive = true;
    this.runtimeState = "CONNECTING";
    await this.patchHealth({
      workerState: "CONNECTING",
      workerActive: true,
      lastError: null,
      lastBlockerCode: null,
        automaticAnalysisStatus: this.automaticStatusPatch({
          workerActive: true,
          lastBlockerCode: null,
        }),
      scheduleIntervalMs: AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
      nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
    });
    // Evaluate the current slot promptly after resume (boundary timer covers the next).
    void this.tick();
  }

  private async patchHealth(
    patch: Partial<ReturnType<typeof defaultMonitorHealth>> & { workerState?: AtMonitorWorkerState },
  ): Promise<void> {
    await this.store.update((s) => ({
      ...s,
      health: {
        ...s.health,
        ...patch,
        workerActive: this.runtimeActive,
        analysisInFlight: this.analysisInFlight,
      },
    }));
  }

  /**
   * True when a *live* persisted monitor config epoch advanced mid-flight.
   * Ephemeral manual analyses (no config, or disabled persisted config) must not
   * trip CONFIG_CHANGED — production smoke hits this when monitor is STOPPED.
   */
  private configEpochInvalidated(expectedEpoch: number): boolean {
    const persisted = this.store.getState().config;
    if (!persisted || persisted.enabled !== true) return false;
    return persisted.configEpoch !== expectedEpoch;
  }

  getPublicStatus(): AtMonitorPublicStatus {
    const s = this.store.getState();
    const workerActive = this.runtimeActive && Boolean(s.config?.enabled);
    const workerState = this.runtimeActive
      ? this.runtimeState
      : (s.config?.enabled ? s.health.workerState : "STOPPED");

    // Phase 57.3 — Never report frozen LIVE_FRESH from disk while worker is stopped.
    // Re-age the current verification snapshot on every status read.
    let health = {
      ...s.health,
      workerActive,
      workerState,
      analysisInFlight: this.analysisInFlight,
    };
    const env = s.config?.environment
      ?? this.deps.getSelectedEnvironment?.();
    if (env && this.deps.getVerification) {
      const verification = this.deps.getVerification(env);
      const freshness = evaluateVerificationMarketQuoteFreshness(verification, {
        expectedInstrument: s.config?.instrument ?? null,
      });
      health = {
        ...health,
        quoteFresh: verification ? freshness.fresh : null,
        feedStatus: freshness.feedStatus ? String(freshness.feedStatus) : health.feedStatus,
        freshnessReasonCode: freshness.reasonCode,
        freshnessThresholdMs: freshness.freshnessThresholdMs,
        verificationAgeMs: freshness.verificationAgeMs,
        effectivePriceChangeAgeMs: freshness.effectivePriceChangeAgeMs,
        effectiveReceiptAgeMs: freshness.effectiveReceiptAgeMs,
        verificationSnapshotAtUtc: freshness.verifiedAtUtc,
        freshnessEvaluatedAtUtc: freshness.evaluatedAtUtc,
        quoteSnapshotFingerprint: freshness.snapshotFingerprint,
        quoteSourceTimestampMs: freshness.sourceTimestampMs,
        quoteReceivedAtMs: freshness.receivedAtMs,
        lastQuoteChangeAtUtc: verificationLastQuoteChangeAtUtc(verification),
      };
    } else if (!workerActive) {
      health = {
        ...health,
        quoteFresh: health.quoteFresh === true ? false : health.quoteFresh,
        freshnessReasonCode:
          health.quoteFresh === true
            ? "QUOTE_AGE_EXCEEDED"
            : health.freshnessReasonCode,
      };
    }

    const automaticAnalysisStatus = deriveAtAutomaticAnalysisStatus({
      enabled: Boolean(s.config?.enabled),
      workerActive,
      analysisInFlight: this.analysisInFlight,
      lastBlockerCode: health.lastBlockerCode,
      lastSuccessfulAnalysisAtUtc: health.lastSuccessfulAnalysisAtUtc,
      lastCycleTerminalStatus: health.lastCycleTerminalStatus,
    });
    health = {
      ...health,
      automaticAnalysisStatus,
      scheduleIntervalMs: AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
      nextScheduledAnalysisAtUtc:
        health.nextScheduledAnalysisAtUtc ?? nextFiveMinuteBoundaryUtc(),
    };

    return {
      schemaVersion: AT_MONITOR_SCHEMA,
      phase: AT_MONITOR_PHASE,
      supportedTimeframes: [...AT_MONITOR_TIMEFRAMES],
      unsupportedNote:
        "H2/2h is not available: ForexConnect project mappings support 5m/15m/30m/1h/4h/1d/1w only (no H2).",
      chartImageSource: "server-ohlc-render",
      chartImageSourceLabel: "SERVER_OHLC_RENDER",
      platformScreenshotAvailable: AT_PLATFORM_SCREENSHOT_AVAILABLE,
      platformScreenshotBlocker: AT_PLATFORM_SCREENSHOT_BLOCKER,
      requiresBrowserOpen: false,
      persistsAcrossAppRestart: true,
      persistsAcrossVpsReboot: "NOT_CLAIMED",
      requiresDashboardClick: false,
      scheduleMode: "five_minute_wall_utc",
      scheduleIntervalMs: AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
      automaticAnalysisStatus,
      config: s.config,
      health,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
    };
  }

  async start(input: {
    environment: AutomatedTradingEnvironment;
    instrument: string;
    timeframe: unknown;
    expectedEnvironmentEpoch?: number;
    currentEnvironment: AutomatedTradingEnvironment;
    currentEnvironmentEpoch: number;
  }): Promise<{ ok: true; status: AtMonitorPublicStatus } | { ok: false; code: string; message: string; status: AtMonitorPublicStatus }> {
    if (input.environment !== input.currentEnvironment) {
      return {
        ok: false,
        code: "ENVIRONMENT_MISMATCH",
        message: `Monitoring for ${input.environment} rejected while selection is ${input.currentEnvironment}.`,
        status: this.getPublicStatus(),
      };
    }
    if (
      Number.isFinite(input.expectedEnvironmentEpoch)
      && Math.floor(Number(input.expectedEnvironmentEpoch)) !== input.currentEnvironmentEpoch
    ) {
      return {
        ok: false,
        code: "STALE_EPOCH",
        message: "Stale environment epoch — refresh status and retry.",
        status: this.getPublicStatus(),
      };
    }
    const tf = parseAtMonitorTimeframe(input.timeframe);
    if (!tf) {
      return {
        ok: false,
        code: "UNSUPPORTED_TIMEFRAME",
        message:
          `Unsupported monitoring timeframe. Allowed: ${AT_MONITOR_TIMEFRAMES.join(", ")}. H2 is not mapped in ForexConnect.`,
        status: this.getPublicStatus(),
      };
    }
    const instrument = String(input.instrument ?? "").trim();
    if (!instrument) {
      return {
        ok: false,
        code: "INSTRUMENT_NOT_SELECTED",
        message: "Select a ForexConnect instrument before starting monitoring.",
        status: this.getPublicStatus(),
      };
    }

    const prev = this.store.getState().config;
    // Idempotent Start: same enabled config does not spawn a second worker or bump epoch.
    if (
      prev?.enabled
      && prev.instrument === instrument
      && prev.timeframe === tf
      && prev.environment === input.environment
    ) {
      this.runtimeActive = true;
      this.ensureTimer();
      return { ok: true, status: this.getPublicStatus() };
    }

    const nextEpoch = (prev?.configEpoch ?? 0) + 1;
    const now = nowIso();
    const config: AtMonitorConfig = {
      enabled: true,
      environment: input.environment,
      instrument,
      timeframe: tf,
      configEpoch: nextEpoch,
      createdAtUtc: prev?.createdAtUtc && prev.instrument === instrument ? prev.createdAtUtc : now,
      updatedAtUtc: now,
      pollIntervalMs: prev?.pollIntervalMs ?? 15_000,
    };

    this.runtimeActive = true;
    this.runtimeState = "CONNECTING";
    this.analysisInFlight = false;
    await this.store.update((s) => ({
      ...s,
      config,
      health: {
        ...defaultMonitorHealth(),
        workerState: "CONNECTING",
        workerActive: true,
        automaticAnalysisStatus: this.automaticStatusPatch({
          workerActive: true,
          lastBlockerCode: null,
        }),
        scheduleIntervalMs: AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
        nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
        // Preserve prior success age across reconfigure so failed cycles cannot erase it.
        lastSuccessfulAnalysisAtUtc: prev ? s.health.lastSuccessfulAnalysisAtUtc : null,
        missedCycles: s.health.missedCycles ?? 0,
        delayedCycles: s.health.delayedCycles ?? 0,
      },
    }));
    this.ensureTimer();
    void this.tick();
    return { ok: true, status: this.getPublicStatus() };
  }

  async stop(reason = "user_stop"): Promise<AtMonitorPublicStatus> {
    this.runtimeActive = false;
    this.runtimeState = "STOPPED";
    this.analysisInFlight = false;
    await this.store.update((s) => ({
      ...s,
      config: s.config ? { ...s.config, enabled: false, updatedAtUtc: nowIso() } : null,
      health: {
        ...s.health,
        workerState: "STOPPED",
        workerActive: false,
        analysisInFlight: false,
        automaticAnalysisStatus: "STOPPED",
        lastError: reason === "user_stop" ? null : reason.slice(0, 200),
        lastBlockerCode: reason === "user_stop" ? null : "STOPPED",
      },
    }));
    return this.getPublicStatus();
  }

  /**
   * Mark automatic analysis blocked without disabling the schedule config.
   * Used when boot cannot select an instrument — surface the exact blocker.
   */
  async markAutomaticAnalysisBlocked(input: {
    code: string;
    message: string;
  }): Promise<AtMonitorPublicStatus> {
    this.runtimeActive = false;
    this.runtimeState = "PAUSED_SAFETY";
    await this.patchHealth({
      workerState: "PAUSED_SAFETY",
      workerActive: false,
      automaticAnalysisStatus: this.automaticStatusPatch({
        workerActive: false,
        lastBlockerCode: input.code.slice(0, 80),
      }),
      lastBlockerCode: input.code.slice(0, 80),
      lastError: input.message.slice(0, 240),
      scheduleIntervalMs: AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
      nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
    });
    return this.getPublicStatus();
  }

  async changeInstrumentTimeframe(input: {
    environment: AutomatedTradingEnvironment;
    instrument: string;
    timeframe: unknown;
    expectedEnvironmentEpoch?: number;
    currentEnvironment: AutomatedTradingEnvironment;
    currentEnvironmentEpoch: number;
  }): Promise<{ ok: true; status: AtMonitorPublicStatus } | { ok: false; code: string; message: string; status: AtMonitorPublicStatus }> {
    // Safe replace: bump epoch (invalidates in-flight) then start new config.
    await this.stop("config_change");
    return this.start(input);
  }

  private async loadCandles(symbol: string, timeframe: string) {
    if (this.deps.loadCandles) return this.deps.loadCandles(symbol, timeframe);
    const bridge = getForexConnectBridge();
    const res = await bridge.getHistoricalCandles({ symbol, timeframe, limit: 120 });
    return mapCandles(res.candles);
  }

  async tick(): Promise<void> {
    if (this.disposed || this.tickInFlight) return;
    const persisted = this.store.getState();
    if (!persisted.config?.enabled) {
      this.runtimeActive = false;
      this.runtimeState = "STOPPED";
      return;
    }
    // System Master owns analysis lifecycle — refuse residual enabled configs while OFF.
    if (this.deps.isSystemMasterOn && this.deps.isSystemMasterOn() !== true) {
      this.runtimeActive = false;
      this.runtimeState = "STOPPED";
      await this.store.update((s) => ({
        ...s,
        config: s.config ? { ...s.config, enabled: false, updatedAtUtc: nowIso() } : null,
        health: {
          ...s.health,
          workerState: "STOPPED",
          workerActive: false,
          automaticAnalysisStatus: "STOPPED",
          lastBlockerCode: "SYSTEM_MASTER_OFF",
          lastError: "System Master OFF — analysis schedule halted.",
        },
      }));
      return;
    }
    this.tickInFlight = true;
    const configEpoch = persisted.config.configEpoch;
    let claimedThisTick = false;
    try {
      const selectedEnv = this.deps.getSelectedEnvironment?.() ?? persisted.config.environment;
      if (selectedEnv !== persisted.config.environment) {
        this.runtimeState = "PAUSED_SAFETY";
        await this.patchHealth({
          workerState: "PAUSED_SAFETY",
          lastBlockerCode: "ENVIRONMENT_MISMATCH",
          lastError: "Monitoring paused — selected AT environment no longer matches monitor config.",
          automaticAnalysisStatus: this.automaticStatusPatch({
            lastBlockerCode: "ENVIRONMENT_MISMATCH",
          }),
          nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
        });
        return;
      }

      this.runtimeActive = true;
      const slotDecision = decideFiveMinuteSlot({
        lastCompletedSlotSec: persisted.health.lastScheduleSlotSec,
      });

      await this.patchHealth({
        scheduleIntervalMs: AT_ANALYSIS_SCHEDULE_INTERVAL_MS,
        nextScheduledAnalysisAtUtc:
          slotDecision.action === "run" || slotDecision.action === "missed"
            ? nextFiveMinuteBoundaryUtc()
            : ("nextAtUtc" in slotDecision ? slotDecision.nextAtUtc : nextFiveMinuteBoundaryUtc()),
        automaticAnalysisStatus: this.automaticStatusPatch(),
      });

      if (slotDecision.action === "done" || slotDecision.action === "wait") {
        if (!this.analysisInFlight) {
          this.runtimeState = "MONITORING_LIVE";
          await this.patchHealth({
            workerState: "MONITORING_LIVE",
            automaticAnalysisStatus: this.automaticStatusPatch(),
          });
        }
        return;
      }

      const dedupe = scheduledSlotDedupeKey({
        environment: persisted.config.environment,
        instrument: persisted.config.instrument,
        timeframe: persisted.config.timeframe,
        slotSec: slotDecision.slotSec,
        configEpoch,
      });
      if (this.store.hasDedupe(dedupe)) {
        await this.store.update((s) => ({
          ...s,
          health: {
            ...s.health,
            lastScheduleSlotSec: Math.max(s.health.lastScheduleSlotSec ?? 0, slotDecision.slotSec),
            nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
          },
        }));
        return;
      }

      if (slotDecision.action === "missed") {
        // Explicit no-backlog policy: record missed, consume the slot, wait for next boundary.
        await this.store.rememberDedupe(dedupe);
        await this.store.update((s) => ({
          ...s,
          health: {
            ...s.health,
            missedCycles: (s.health.missedCycles ?? 0) + 1,
            lastBlockerCode: "SCHEDULE_SLOT_MISSED",
            lastError:
              `Analysis slot ${slotDecision.scheduledAtUtc} missed (grace exceeded; no backlog).`,
            nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
          },
        }));
        await this.recordCycleTerminal({
          slotSec: slotDecision.slotSec,
          scheduledAtUtc: slotDecision.scheduledAtUtc,
          terminalStatus: "SCHEDULE_SLOT_MISSED",
          blockerCode: "SCHEDULE_SLOT_MISSED",
          durationMs: 0,
        });
        return;
      }

      if (this.analysisInFlight) {
        // Overlap policy: skip this slot; never fabricate an on-time completion.
        await this.store.rememberDedupe(dedupe);
        await this.store.update((s) => ({
          ...s,
          health: {
            ...s.health,
            delayedCycles: (s.health.delayedCycles ?? 0) + 1,
            missedCycles: (s.health.missedCycles ?? 0) + 1,
            lastBlockerCode: "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT",
            lastError:
              `Analysis slot ${slotDecision.scheduledAtUtc} skipped — previous cycle still in flight.`,
            nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
          },
        }));
        await this.recordCycleTerminal({
          slotSec: slotDecision.slotSec,
          scheduledAtUtc: slotDecision.scheduledAtUtc,
          terminalStatus: "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT",
          blockerCode: "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT",
          durationMs: 0,
        });
        return;
      }

      const sinceLast = Date.now() - this.lastAnalysisAttemptMs;
      if (sinceLast < AT_MONITOR_ANALYSIS_COOLDOWN_MS) return;

      // Claim the slot BEFORE refresh/candle awaits. Otherwise a slow ForexConnect
      // failure can hold tickInFlight past grace and the next tick falsely records
      // SCHEDULE_SLOT_MISSED without ever emitting a freshness/provider terminal.
      const cycleStartedAtUtc = nowIso();
      await this.store.rememberDedupe(dedupe);
      await this.store.update((s) => ({
        ...s,
        health: {
          ...s.health,
          lastScheduleSlotSec: slotDecision.slotSec,
          lastDedupeKey: dedupe,
          lastScheduledAtUtc: slotDecision.scheduledAtUtc,
          lastCycleStartedAtUtc: cycleStartedAtUtc,
          nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
        },
      }));
      this.cycleScheduledAtUtc = slotDecision.scheduledAtUtc;
      this.cycleSlotSec = slotDecision.slotSec;
      this.cycleStartedAtMs = Date.parse(cycleStartedAtUtc) || Date.now();
      claimedThisTick = true;

      // Refresh live verification before freshness gate (avoid aged snapshot false STALE).
      let verification =
        this.deps.getVerification?.(persisted.config.environment) ?? null;
      if (this.deps.refreshVerification) {
        try {
          const refreshed = await this.deps.refreshVerification({
            environment: persisted.config.environment,
            instrument: persisted.config.instrument,
            timeframe: persisted.config.timeframe,
          });
          if (refreshed) verification = refreshed;
          else verification = this.deps.getVerification?.(persisted.config.environment) ?? verification;
        } catch {
          verification = this.deps.getVerification?.(persisted.config.environment) ?? verification;
        }
      }
      if (this.store.getState().config?.configEpoch !== configEpoch) {
        await this.recordCycleTerminal({
          slotSec: slotDecision.slotSec,
          scheduledAtUtc: slotDecision.scheduledAtUtc,
          startedAtUtc: cycleStartedAtUtc,
          terminalStatus: "CONFIG_CHANGED",
          blockerCode: "CONFIG_EPOCH_CHANGED",
          durationMs: Math.max(0, Date.now() - this.cycleStartedAtMs),
        });
        return;
      }

      let candles: ReturnType<typeof mapCandles> = [];
      try {
        candles = await this.loadCandles(persisted.config.instrument, persisted.config.timeframe);
      } catch (candleErr) {
        const message =
          candleErr instanceof Error ? candleErr.message.slice(0, 200) : "Candle load failed.";
        this.runtimeState = "PROVIDER_ERROR";
        await this.patchHealth({
          workerState: "PROVIDER_ERROR",
          lastError: message,
          lastBlockerCode: "PROVIDER_ERROR",
          automaticAnalysisStatus: this.automaticStatusPatch({
            lastBlockerCode: "PROVIDER_ERROR",
          }),
          consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
        });
        await this.recordCycleTerminal({
          slotSec: slotDecision.slotSec,
          scheduledAtUtc: slotDecision.scheduledAtUtc,
          startedAtUtc: cycleStartedAtUtc,
          terminalStatus: "PROVIDER_ERROR",
          blockerCode: "PROVIDER_ERROR",
          durationMs: Math.max(0, Date.now() - this.cycleStartedAtMs),
        });
        return;
      }
      if (this.store.getState().config?.configEpoch !== configEpoch) {
        await this.recordCycleTerminal({
          slotSec: slotDecision.slotSec,
          scheduledAtUtc: slotDecision.scheduledAtUtc,
          startedAtUtc: cycleStartedAtUtc,
          terminalStatus: "CONFIG_CHANGED",
          blockerCode: "CONFIG_EPOCH_CHANGED",
          durationMs: Math.max(0, Date.now() - this.cycleStartedAtMs),
        });
        return;
      }

      const freshness = evaluateVerificationMarketQuoteFreshness(verification, {
        expectedInstrument: persisted.config.instrument,
      });
      const quoteFresh = freshness.fresh;
      const feedStatus = freshness.feedStatus;
      const lastQuoteChange = verificationLastQuoteChangeAtUtc(verification);
      const identityOk = isVerificationAccountIdentityOk(verification);
      const closed = latestClosedCandleOpenSec(
        candles.map((c) => c.time),
        persisted.config.timeframe,
      );

      await this.patchHealth({
        lastCandleUpdateAtUtc: nowIso(),
        lastObservationAtUtc: nowIso(),
        lastQuoteChangeAtUtc: lastQuoteChange,
        lastClosedCandleOpenSec: closed?.openTimeSec ?? null,
        quoteFresh: verification ? quoteFresh : null,
        feedStatus: feedStatus ? String(feedStatus) : null,
        freshnessReasonCode: freshness.reasonCode,
        freshnessThresholdMs: freshness.freshnessThresholdMs,
        verificationAgeMs: freshness.verificationAgeMs,
        effectivePriceChangeAgeMs: freshness.effectivePriceChangeAgeMs,
        effectiveReceiptAgeMs: freshness.effectiveReceiptAgeMs,
        verificationSnapshotAtUtc: freshness.verifiedAtUtc,
        freshnessEvaluatedAtUtc: freshness.evaluatedAtUtc,
        quoteSnapshotFingerprint: freshness.snapshotFingerprint,
        quoteSourceTimestampMs: freshness.sourceTimestampMs,
        quoteReceivedAtMs: freshness.receivedAtMs,
        lastScheduledAtUtc: slotDecision.scheduledAtUtc,
        delayedCycles: slotDecision.delayed
          ? (this.store.getState().health.delayedCycles ?? 0) + 1
          : this.store.getState().health.delayedCycles ?? 0,
        nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
      });

      if (!verification || !identityOk) {
        this.runtimeState = "VERIFICATION_REQUIRED";
        await this.patchHealth({
          workerState: "VERIFICATION_REQUIRED",
          lastBlockerCode: "VERIFICATION_REQUIRED",
          lastError: "Fresh Phase 52 verification is required before scheduled OpenAI analysis.",
          automaticAnalysisStatus: this.automaticStatusPatch({
            lastBlockerCode: "VERIFICATION_REQUIRED",
          }),
        });
        await this.recordCycleTerminal({
          slotSec: slotDecision.slotSec,
          scheduledAtUtc: slotDecision.scheduledAtUtc,
          startedAtUtc: cycleStartedAtUtc,
          terminalStatus: "BLOCKED_VERIFICATION",
          blockerCode: "VERIFICATION_REQUIRED",
          durationMs: Math.max(0, Date.now() - this.cycleStartedAtMs),
        });
        return;
      }

      if (!candles.length) {
        this.runtimeState = "DATA_INSUFFICIENT";
        await this.patchHealth({
          workerState: "DATA_INSUFFICIENT",
          lastBlockerCode: "DATA_INSUFFICIENT",
          lastError: "No candles returned from ForexConnect.",
          automaticAnalysisStatus: this.automaticStatusPatch({
            lastBlockerCode: "DATA_INSUFFICIENT",
          }),
        });
        await this.recordCycleTerminal({
          slotSec: slotDecision.slotSec,
          scheduledAtUtc: slotDecision.scheduledAtUtc,
          startedAtUtc: cycleStartedAtUtc,
          terminalStatus: "BLOCKED_DATA_INSUFFICIENT",
          blockerCode: "DATA_INSUFFICIENT",
          durationMs: Math.max(0, Date.now() - this.cycleStartedAtMs),
        });
        return;
      }

      if (!quoteFresh) {
        this.runtimeState = "STALE_QUOTES";
        const reason = freshness.reasonCode;
        const staleMsg =
          reason === this.lastFreshnessReasonLogged
            ? `Quotes not fresh (${reason}) — schedule advanced; OpenAI analysis blocked.`
            : `Quotes not fresh (${reason}) — schedule advanced; LIVE not claimed; OpenAI analysis blocked.`;
        this.lastFreshnessReasonLogged = reason;
        await this.patchHealth({
          workerState: "STALE_QUOTES",
          lastBlockerCode: "STALE_QUOTES",
          lastError: staleMsg,
          automaticAnalysisStatus: this.automaticStatusPatch({
            lastBlockerCode: "STALE_QUOTES",
          }),
        });
        await this.recordCycleTerminal({
          slotSec: slotDecision.slotSec,
          scheduledAtUtc: slotDecision.scheduledAtUtc,
          startedAtUtc: cycleStartedAtUtc,
          terminalStatus: "BLOCKED_STALE_QUOTES",
          blockerCode: "STALE_QUOTES",
          durationMs: Math.max(0, Date.now() - this.cycleStartedAtMs),
        });
        return;
      }
      this.lastFreshnessReasonLogged = freshness.reasonCode;

      await this.patchHealth({
        lastCycleStartedAtUtc: cycleStartedAtUtc,
        lastScheduledAtUtc: slotDecision.scheduledAtUtc,
        lastBlockerCode: null,
        lastError: null,
      });
      await this.runAnalysis({
        trigger: "scheduled",
        dedupeKey: dedupe,
        config: persisted.config,
        candles,
        verification,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 200) : "Monitor tick failed.";
      this.runtimeState = "PROVIDER_ERROR";
      await this.patchHealth({
        workerState: "PROVIDER_ERROR",
        lastError: message,
        lastBlockerCode: "PROVIDER_ERROR",
        automaticAnalysisStatus: this.automaticStatusPatch({
          lastBlockerCode: "PROVIDER_ERROR",
        }),
        consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
      });
      // If this tick already claimed the slot, emit a terminal so a provider hang/throw
      // is never mislabeled later as SCHEDULE_SLOT_MISSED.
      if (
        claimedThisTick
        && typeof this.cycleSlotSec === "number"
        && this.cycleScheduledAtUtc
      ) {
        const slotSec = this.cycleSlotSec;
        const already =
          this.store.getState().health.recentCycleTerminals?.some(
            (t) => t.slotSec === slotSec && t.completedAtUtc,
          ) ?? false;
        if (!already) {
          await this.recordCycleTerminal({
            slotSec,
            scheduledAtUtc: this.cycleScheduledAtUtc,
            startedAtUtc: this.cycleStartedAtMs
              ? new Date(this.cycleStartedAtMs).toISOString()
              : null,
            terminalStatus: "PROVIDER_ERROR",
            blockerCode: "PROVIDER_ERROR",
            durationMs: this.cycleStartedAtMs
              ? Math.max(0, Date.now() - this.cycleStartedAtMs)
              : 0,
          });
        }
      }
    } finally {
      this.tickInFlight = false;
      if (this.pendingVerificationNudge && !this.disposed) {
        this.pendingVerificationNudge = false;
        void this.tick();
      }
    }
  }

  async runAnalysis(input: {
    trigger: AtAnalysisTrigger;
    dedupeKey?: string | null;
    config: AtMonitorConfig;
    candles: ReturnType<typeof mapCandles>;
    verification: AutomatedTradingVerificationResult | null;
    timeoutMs?: unknown;
  }): Promise<
    | { ok: true; analysisId: string }
    | { ok: false; code: string; message: string }
  > {
    if (this.analysisInFlight) {
      return { ok: false, code: "ANALYSIS_IN_FLIGHT", message: "Analysis already in progress." };
    }
    const configEpoch = input.config.configEpoch;
    this.analysisInFlight = true;
    this.lastAnalysisAttemptMs = Date.now();
    this.runtimeState = "ANALYSIS_IN_PROGRESS";
    await this.patchHealth({
      workerState: "ANALYSIS_IN_PROGRESS",
      analysisInFlight: true,
      lastError: null,
      lastBlockerCode: null,
    });

    try {
      const tf = input.config.timeframe;
      const nowMs = Date.now();
      const tfMs =
        tf === "5m" ? 300_000
          : tf === "15m" ? 900_000
            : tf === "30m" ? 1_800_000
              : 3_600_000;
      const nowSec = Math.floor(nowMs / 1000);

      const toStrategy = (
        rows: ReturnType<typeof mapCandles>,
        timeframeMs: number,
      ): StrategyCandle[] =>
        rows.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          closed: nowSec >= c.time + Math.floor(timeframeMs / 1000),
        }));

      // Phase 4.18F.7 — load full MTF ladder once; primary + evidence share this immutable bag.
      const candlesByTf: Record<string, StrategyCandle[]> = {
        [tf]: toStrategy(input.candles, tfMs),
      };
      const mtfMs: Record<string, number> = {
        "5m": 300_000,
        "15m": 900_000,
        "30m": 1_800_000,
        "1h": 3_600_000,
        "4h": 14_400_000,
        "1d": 86_400_000,
      };
      for (const other of AT_MTF_EVIDENCE_TIMEFRAMES) {
        if (other === tf) continue;
        try {
          const rows = await this.loadCandles(input.config.instrument, other);
          candlesByTf[other] = toStrategy(rows, mtfMs[other] ?? 900_000);
        } catch {
          candlesByTf[other] = [];
        }
      }

      if (this.configEpochInvalidated(configEpoch)) {
        return { ok: false, code: "CONFIG_CHANGED", message: "Monitor configuration changed; analysis aborted." };
      }

      const freshness = evaluateVerificationMarketQuoteFreshness(input.verification, {
        expectedInstrument: input.config.instrument,
      });
      let tickLastAcceptedAtMs: number | null = null;
      let tickAccepted = 0;
      let windowIds: string[] = [];
      let freshWindowCount = 0;
      let totalWindows = 0;
      try {
        const { getGenuineTickCaptureService } = await import(
          "../../../market-data/forexconnect/genuine-tick-capture.js"
        );
        const capture = getGenuineTickCaptureService();
        const counters = capture.getCounters();
        tickLastAcceptedAtMs = counters.lastAcceptedAtMs ?? null;
        tickAccepted = counters.accepted ?? 0;
        const snap = capture.getSnapshot(input.config.instrument, { asOfMs: nowMs });
        const windows = Array.isArray(snap.windows) ? snap.windows : [];
        windowIds = windows.map((w) => String(w.windowId));
        totalWindows = windows.length;
        freshWindowCount = windows.filter((w) => w.freshness === "LIVE").length;
      } catch {
        /* tick store optional — freshness model records UNAVAILABLE */
      }

      const market = input.verification?.market;
      const bid = market?.bid != null && Number.isFinite(market.bid) ? market.bid : null;
      const ask = market?.ask != null && Number.isFinite(market.ask) ? market.ask : null;
      const mid = bid != null && ask != null ? (bid + ask) / 2 : null;
      const spread = market?.spread != null && Number.isFinite(market.spread)
        ? market.spread
        : (bid != null && ask != null ? ask - bid : null);

      const snapshot = buildAtObservationSnapshot({
        instrument: input.config.instrument,
        primaryTimeframe: tf,
        candlesByTf,
        primaryTimeframeMs: tfMs,
        nowMs,
        quote: {
          bid,
          ask,
          mid,
          spread,
          quoteFresh: freshness.fresh,
          freshnessReasonCode: freshness.reasonCode,
          sourceTimestampMs: freshness.sourceTimestampMs,
          receivedAtMs: freshness.receivedAtMs,
        },
        ticks: {
          lastAcceptedAtMs: tickLastAcceptedAtMs,
          accepted: tickAccepted,
          windowIds,
          freshWindowCount,
          totalWindows,
        },
      });

      const primaryCandles = snapshot.primaryCandles;
      const chartCandles = primaryCandles.map((c) => ({
        time: c.time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        isClosed: c.closed !== false,
      }));
      const rendered = renderAtMarketChartPng({
        instrument: snapshot.instrument,
        timeframe: tf,
        timeframeLabel: AT_MONITOR_TIMEFRAME_LABELS[tf],
        candles: chartCandles,
        observationUtc: snapshot.observationUtc,
        overlays: overlaysFromObservationSnapshot(snapshot),
      });

      if (!rendered.ok) {
        this.runtimeState = "IMAGE_UNAVAILABLE";
        await this.patchHealth({
          workerState: "IMAGE_UNAVAILABLE",
          lastBlockerCode: "IMAGE_UNAVAILABLE",
          lastError: rendered.message,
          lastObservationId: snapshot.observationId,
          lastImageSourceLabel: "SERVER_OHLC_RENDER",
          tickFresh: snapshot.freshness.genuineTicks === "FRESH",
          candleFresh: snapshot.freshness.historicalCandles === "FRESH",
          imageFresh: false,
          consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
        });
        if (this.cycleSlotSec != null && this.cycleScheduledAtUtc) {
          await this.recordCycleTerminal({
            slotSec: this.cycleSlotSec,
            scheduledAtUtc: this.cycleScheduledAtUtc,
            terminalStatus: "BLOCKED_IMAGE",
            blockerCode: "IMAGE_UNAVAILABLE",
            observationId: snapshot.observationId,
          });
          this.cycleSlotSec = null;
          this.cycleScheduledAtUtc = null;
          this.cycleStartedAtMs = null;
        }
        return { ok: false, code: "IMAGE_UNAVAILABLE", message: rendered.message };
      }

      const binding = createChartImageBinding({
        snapshot,
        imageHash: rendered.imageHash,
        byteLength: rendered.byteLength,
        width: rendered.width,
        height: rendered.height,
      });
      const bindCheck = validateImageEvidenceBinding({
        snapshot,
        binding,
        imageBytes: rendered.png,
      });
      if (!bindCheck.ok) {
        this.runtimeState = "IMAGE_UNAVAILABLE";
        await this.patchHealth({
          workerState: "IMAGE_UNAVAILABLE",
          lastBlockerCode: bindCheck.code,
          lastError: bindCheck.message,
          lastObservationId: snapshot.observationId,
          lastImageId: binding.imageId,
          lastImageSourceLabel: "SERVER_OHLC_RENDER",
          tickFresh: snapshot.freshness.genuineTicks === "FRESH",
          candleFresh: snapshot.freshness.historicalCandles === "FRESH",
          imageFresh: false,
          consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
        });
        if (this.cycleSlotSec != null && this.cycleScheduledAtUtc) {
          await this.recordCycleTerminal({
            slotSec: this.cycleSlotSec,
            scheduledAtUtc: this.cycleScheduledAtUtc,
            terminalStatus: "BLOCKED_IMAGE",
            blockerCode: bindCheck.code,
            observationId: snapshot.observationId,
            imageId: binding.imageId,
          });
          this.cycleSlotSec = null;
          this.cycleScheduledAtUtc = null;
          this.cycleStartedAtMs = null;
        }
        return { ok: false, code: bindCheck.code, message: bindCheck.message };
      }

      const capturedAtUtc = binding.generatedAtUtc;
      const imageBase64 = rendered.png.toString("base64");
      const chartMeta = {
        available: true as const,
        imageHash: rendered.imageHash,
        capturedAtUtc,
        source: rendered.source,
        note: rendered.note,
        blocker: null as string | null,
        width: rendered.width,
        height: rendered.height,
        byteLength: rendered.byteLength,
        observationUtc: snapshot.observationUtc,
        // Engine binds marketDataFingerprint to evidence.fingerprint from the same candlesByTf.
        marketDataFingerprint: null,
        evidenceWindowStartUtc: snapshot.candleRange.firstOpenSec != null
          ? new Date(snapshot.candleRange.firstOpenSec * 1000).toISOString()
          : null,
        evidenceWindowEndUtc: snapshot.candleRange.lastOpenSec != null
          ? new Date(snapshot.candleRange.lastOpenSec * 1000).toISOString()
          : null,
        imageSourceLabel: "SERVER_OHLC_RENDER" as const,
        observationId: snapshot.observationId,
        imageId: binding.imageId,
        overlaysDrawn: rendered.overlaysDrawn,
        includedInOpenAiRequest: false,
      };
      await this.patchHealth({
        lastScreenshotAtUtc: capturedAtUtc,
        lastScreenshotImageHash: chartMeta.imageHash,
        lastObservationId: snapshot.observationId,
        lastImageId: binding.imageId,
        lastImageSourceLabel: "SERVER_OHLC_RENDER",
        tickFresh: snapshot.freshness.genuineTicks === "FRESH",
        candleFresh: snapshot.freshness.historicalCandles === "FRESH",
        imageFresh: true,
        lastImageDeliveryLifecycle: "CAPTURE_CREATED",
        storageHealth: "OK",
      });

      if (this.configEpochInvalidated(configEpoch)) {
        return { ok: false, code: "CONFIG_CHANGED", message: "Monitor configuration changed; analysis aborted." };
      }

      const envEpoch = this.deps.getEnvironmentEpoch?.() ?? 0;
      const mtfTimeframes = [
        tf,
        ...AT_MTF_EVIDENCE_TIMEFRAMES.filter((t) => t !== tf),
      ];
      const result = await this.engine.analyzeWithChart({
        environment: input.config.environment,
        environmentEpoch: envEpoch,
        instrument: input.config.instrument,
        primaryTimeframe: tf,
        timeframes: mtfTimeframes,
        candlesByTf,
        verification: input.verification,
        timeoutMs: input.timeoutMs,
        trigger: input.trigger,
        monitorConfigEpoch: configEpoch,
        chartImage: {
          mimeType: "image/png" as const,
          base64: imageBase64,
          meta: chartMeta,
        },
        // Phase 53.3 — never silently fall back to text-only for monitor analyses.
        requireImage: true,
      });

      if (this.configEpochInvalidated(configEpoch)) {
        return { ok: false, code: "CONFIG_CHANGED", message: "Monitor configuration changed; discarding stale result." };
      }

      if (!result.ok || !result.analysis) {
        this.runtimeState = result.code === "DATA_INSUFFICIENT" ? "DATA_INSUFFICIENT" : "PROVIDER_ERROR";
        await this.patchHealth({
          workerState: this.runtimeState,
          lastBlockerCode: result.code,
          lastError: result.message,
          lastImageDeliveryLifecycle:
            result.analysis?.evidenceDelivery?.imageDeliveryLifecycle
            ?? "DELIVERY_FAILED",
          lastIncludedImageBytesInRequest:
            result.analysis?.evidenceDelivery?.includedImageBytesInRequest ?? false,
          consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
        });
        if (this.cycleSlotSec != null && this.cycleScheduledAtUtc) {
          const terminalStatus: AtMonitorCycleTerminalStatus =
            result.code === "DATA_INSUFFICIENT"
              ? "BLOCKED_DATA_INSUFFICIENT"
              : result.code === "ANALYSIS_IN_FLIGHT"
                ? "SCHEDULE_SLOT_SKIPPED_IN_FLIGHT"
                : result.code === "CONFIG_CHANGED"
                  ? "CONFIG_CHANGED"
                  : "PROVIDER_ERROR";
          await this.recordCycleTerminal({
            slotSec: this.cycleSlotSec,
            scheduledAtUtc: this.cycleScheduledAtUtc,
            terminalStatus,
            blockerCode: result.code,
            lifecycle: result.analysis?.lifecycle ?? null,
            includedImageBytesInRequest:
              result.analysis?.evidenceDelivery?.includedImageBytesInRequest ?? false,
          });
          this.cycleSlotSec = null;
          this.cycleScheduledAtUtc = null;
          this.cycleStartedAtMs = null;
        }
        return { ok: false, code: result.code, message: result.message };
      }

      // Persist chart bytes keyed by analysis id (if available).
      let storageHealth: "OK" | "DEGRADED" = "OK";
      try {
        const dir = chartImageDir(this.storageRoot);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(chartImagePath(result.analysis.analysisId, this.storageRoot), rendered.png);
        pruneChartImages(this.storageRoot);
      } catch {
        storageHealth = "DEGRADED";
      }

      if (input.dedupeKey) await this.store.rememberDedupe(input.dedupeKey);

      const delivery = result.analysis.evidenceDelivery;
      const integrity = validateEvidenceIntegrity({
        observationId: snapshot.observationId,
        imageId: binding.imageId,
        imageHash: rendered.imageHash,
        instrument: snapshot.instrument,
        primaryTimeframe: tf,
        marketDataFingerprint: result.analysis.chartImage?.marketDataFingerprint
          ?? result.analysis.inputFingerprint,
        deliveryObservationId: delivery?.observationId ?? null,
        deliveryImageId: delivery?.imageId ?? null,
        deliveryImageHash: delivery?.imageHash ?? null,
        evidenceFingerprint: result.analysis.inputFingerprint,
        analysisInstrument: result.analysis.instrument,
        analysisPrimaryTimeframe: result.analysis.primaryTimeframe,
        includedImageBytesInRequest: delivery?.includedImageBytesInRequest ?? null,
        requireImage: true,
      });

      // Integrate canonical reconciler — OpenAI is advisory; deterministic authority preserved.
      let canonicalOutcome: string | null = null;
      let canonicalDirection: "BUY" | "SELL" | "NO_TRADE" | null = null;
      let canonicalConfidence: number | null = null;
      try {
        const runCanon = this.deps.runCanonical
          ?? (async (canonInput) => {
            const out = await runCanonicalAnalysis(
              {
                environment: canonInput.environment,
                instrument: canonInput.instrument,
                timeframe: canonInput.timeframe,
                trigger: canonInput.trigger === "legacy" ? "manual" : canonInput.trigger,
                openAiAnalysis: canonInput.openAiAnalysis,
                includeOpenAi: true,
                persist: true,
              },
              createCanonicalAnalysisProductionDeps(),
            );
            return {
              ok: out.ok,
              result: out.result
                ? {
                  finalOutcome: out.result.finalOutcome,
                  direction: out.result.direction,
                  confidencePct: out.result.confidencePct,
                  reconciliationCode: out.result.reconciliationCode ?? null,
                }
                : null,
            };
          });
        const canon = await runCanon({
          environment: input.config.environment,
          instrument: input.config.instrument,
          timeframe: tf,
          trigger: input.trigger,
          openAiAnalysis: result.analysis,
        });
        if (canon.result) {
          canonicalOutcome = canon.result.finalOutcome;
          if (canon.result.direction === "BUY" || canon.result.direction === "SELL") {
            canonicalDirection = canon.result.direction;
          } else if (
            canon.result.finalOutcome === "NO_TRADE"
            || /NO_TRADE|NO_CROSSOVER|INSUFFICIENT|STALE|CONFLICT/i.test(canon.result.finalOutcome)
          ) {
            canonicalDirection = "NO_TRADE";
          } else {
            canonicalDirection = null;
          }
          canonicalConfidence = canon.result.confidencePct;
        }
      } catch {
        canonicalOutcome = "CANONICAL_INTEGRATION_ERROR";
      }

      const lifecycle = result.analysis.lifecycle;
      const semanticOk = lifecycle === "ANALYSIS_VALID";
      const workerState: AtMonitorWorkerState = !integrity.ok
        ? "PROVIDER_ERROR"
        : semanticOk
          ? "ANALYSIS_SUCCESS"
          : lifecycle === "DATA_INSUFFICIENT"
            ? "DATA_INSUFFICIENT"
            : "ANALYSIS_SEMANTIC_REJECTED";
      this.runtimeState = workerState;
      await this.patchHealth({
        workerState,
        lastAnalysisAtUtc: result.analysis.createdAtUtc,
        lastAnalysisId: result.analysis.analysisId,
        lastDedupeKey: input.dedupeKey ?? null,
        consecutiveFailures: semanticOk && integrity.ok ? 0 : (this.store.getState().health.consecutiveFailures ?? 0) + 1,
        lastError: !integrity.ok
          ? integrity.reasons[0] ?? integrity.status
          : (!semanticOk ? `OpenAI lifecycle ${lifecycle}` : null),
        lastBlockerCode: !integrity.ok
          ? integrity.status
          : (!semanticOk ? lifecycle : null),
        nextScheduledAnalysisAtUtc: nextFiveMinuteBoundaryUtc(),
        lastObservationId: snapshot.observationId,
        lastImageId: binding.imageId,
        lastImageSourceLabel: "SERVER_OHLC_RENDER",
        lastMtfAlignment: delivery?.categoriesIncluded?.mtfAlignment
          ? "INCLUDED"
          : null,
        lastImageDeliveryLifecycle: delivery?.imageDeliveryLifecycle ?? null,
        lastIncludedImageBytesInRequest: delivery?.includedImageBytesInRequest ?? null,
        lastAnalysisLifecycle: lifecycle,
        lastCanonicalFinalOutcome: canonicalOutcome,
        lastCanonicalDirection: canonicalDirection,
        lastCanonicalConfidencePct: canonicalConfidence,
        lastEvidenceIntegrityStatus: integrity.status,
        imageFresh: true,
        storageHealth,
        lastSuccessfulAnalysisAtUtc:
          semanticOk && integrity.ok
            ? result.analysis.createdAtUtc
            : this.store.getState().health.lastSuccessfulAnalysisAtUtc,
        automaticAnalysisStatus: this.automaticStatusPatch({
          lastBlockerCode: !integrity.ok
            ? integrity.status
            : (!semanticOk ? lifecycle : null),
          lastSuccessfulAnalysisAtUtc:
            semanticOk && integrity.ok
              ? result.analysis.createdAtUtc
              : this.store.getState().health.lastSuccessfulAnalysisAtUtc,
          lastCycleTerminalStatus: !integrity.ok
            ? "ANALYSIS_FAILED"
            : semanticOk
              ? "ANALYSIS_VALID"
              : "ANALYSIS_SEMANTIC_REJECTED",
        }),
      });
      if (this.cycleSlotSec != null && this.cycleScheduledAtUtc) {
        const terminalStatus: AtMonitorCycleTerminalStatus = !integrity.ok
          ? "ANALYSIS_FAILED"
          : semanticOk
            ? "ANALYSIS_VALID"
            : "ANALYSIS_SEMANTIC_REJECTED";
        await this.recordCycleTerminal({
          slotSec: this.cycleSlotSec,
          scheduledAtUtc: this.cycleScheduledAtUtc,
          terminalStatus,
          analysisId: result.analysis.analysisId,
          observationId: snapshot.observationId,
          imageId: binding.imageId,
          imageHash: rendered.imageHash,
          lifecycle,
          canonicalFinalOutcome: canonicalOutcome,
          blockerCode: !integrity.ok
            ? integrity.status
            : (!semanticOk ? lifecycle : null),
          includedImageBytesInRequest: delivery?.includedImageBytesInRequest ?? null,
        });
      }
      this.cycleStartedAtMs = null;
      this.cycleScheduledAtUtc = null;
      this.cycleSlotSec = null;
      return { ok: true, analysisId: result.analysis.analysisId };
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 200) : "Analysis failed.";
      this.runtimeState = "PROVIDER_ERROR";
      await this.patchHealth({
        workerState: "PROVIDER_ERROR",
        lastError: message,
        lastBlockerCode: "ANALYSIS_FAILED",
        consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
      });
      if (this.cycleSlotSec != null && this.cycleScheduledAtUtc) {
        await this.recordCycleTerminal({
          slotSec: this.cycleSlotSec,
          scheduledAtUtc: this.cycleScheduledAtUtc,
          terminalStatus: "ANALYSIS_FAILED",
          blockerCode: "ANALYSIS_FAILED",
        });
        this.cycleSlotSec = null;
        this.cycleScheduledAtUtc = null;
        this.cycleStartedAtMs = null;
      }
      // Bounded backoff marker only — next tick will retry after cooldown.
      if ((this.store.getState().health.consecutiveFailures ?? 0) <= AT_MONITOR_MAX_RETRIES) {
        this.lastAnalysisAttemptMs = Date.now() + AT_MONITOR_RETRY_BACKOFF_MS - AT_MONITOR_ANALYSIS_COOLDOWN_MS;
      }
      return { ok: false, code: "ANALYSIS_FAILED", message };
    } finally {
      this.analysisInFlight = false;
      await this.patchHealth({ analysisInFlight: false });
    }
  }

  async runManualNow(input: {
    environment: AutomatedTradingEnvironment;
    instrument?: string;
    timeframe?: unknown;
    expectedEnvironmentEpoch?: number;
    currentEnvironment: AutomatedTradingEnvironment;
    currentEnvironmentEpoch: number;
    verification: AutomatedTradingVerificationResult | null;
  }): Promise<
    | { ok: true; analysisId: string; status: AtMonitorPublicStatus }
    | { ok: false; code: string; message: string; status: AtMonitorPublicStatus }
  > {
    const started = this.store.getState().config;
    const useConfig = started?.enabled
      ? started
      : null;
    const instrument = String(input.instrument ?? useConfig?.instrument ?? "").trim();
    const tf = parseAtMonitorTimeframe(input.timeframe ?? useConfig?.timeframe);
    if (input.environment !== input.currentEnvironment) {
      return {
        ok: false,
        code: "ENVIRONMENT_MISMATCH",
        message: "Environment mismatch.",
        status: this.getPublicStatus(),
      };
    }
    if (
      Number.isFinite(input.expectedEnvironmentEpoch)
      && Math.floor(Number(input.expectedEnvironmentEpoch)) !== input.currentEnvironmentEpoch
    ) {
      return {
        ok: false,
        code: "STALE_EPOCH",
        message: "Stale environment epoch.",
        status: this.getPublicStatus(),
      };
    }
    if (!instrument || !tf) {
      return {
        ok: false,
        code: "INSTRUMENT_OR_TIMEFRAME_REQUIRED",
        message: "Instrument and supported timeframe are required for manual analysis.",
        status: this.getPublicStatus(),
      };
    }
    if (!input.verification) {
      return {
        ok: false,
        code: "VERIFICATION_REQUIRED",
        message: "Run Phase 52 Verify before OpenAI analysis.",
        status: this.getPublicStatus(),
      };
    }
    const manualFreshness = evaluateVerificationMarketQuoteFreshness(input.verification, {
      expectedInstrument: instrument,
    });
    if (!manualFreshness.fresh) {
      return {
        ok: false,
        code: "STALE_QUOTES",
        message:
          `Quotes are not fresh (${manualFreshness.reasonCode}) — analysis blocked until LIVE market evidence is available.`,
        status: this.getPublicStatus(),
      };
    }
    // Ephemeral configs must reuse the on-disk epoch (not +1). Bumping would make
    // configEpochInvalidated fire against the disabled persisted config immediately.
    const persistedEpoch = this.store.getState().config?.configEpoch ?? 0;
    const config: AtMonitorConfig = useConfig && useConfig.instrument === instrument && useConfig.timeframe === tf
      ? useConfig
      : {
          enabled: false,
          environment: input.environment,
          instrument,
          timeframe: tf,
          configEpoch: persistedEpoch,
          createdAtUtc: nowIso(),
          updatedAtUtc: nowIso(),
          pollIntervalMs: 20_000,
        };
    const candles = await this.loadCandles(instrument, tf);
    const result = await this.runAnalysis({
      trigger: "manual",
      dedupeKey: null,
      config,
      candles,
      verification: input.verification,
    });
    if (!result.ok) {
      return { ok: false, code: result.code, message: result.message, status: this.getPublicStatus() };
    }
    return { ok: true, analysisId: result.analysisId, status: this.getPublicStatus() };
  }

  readChartImage(analysisId: string): Buffer | null {
    const p = chartImagePath(analysisId, this.storageRoot);
    try {
      if (!fs.existsSync(p)) return null;
      return fs.readFileSync(p);
    } catch {
      return null;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.runtimeActive = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.boundaryTimer) {
      clearTimeout(this.boundaryTimer);
      this.boundaryTimer = null;
    }
  }
}

let workerSingleton: AtMonitorWorker | null = null;

/**
 * Process-singleton worker. Does not auto-resume until `resumeFromPersistence()`
 * (after runtime hooks are bound). Pass storageRoot only for isolated tests.
 */
export function getAtMonitorWorker(storageRoot?: string): AtMonitorWorker {
  if (storageRoot) return new AtMonitorWorker({ storageRoot, autoStart: false });
  if (!workerSingleton) workerSingleton = new AtMonitorWorker({ autoStart: false });
  return workerSingleton;
}

export function resetAtMonitorWorkerForTests(): void {
  workerSingleton?.dispose();
  workerSingleton = null;
}
