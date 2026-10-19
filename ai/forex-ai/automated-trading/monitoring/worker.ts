/**
 * Phase 53.1 / 53.3 — Single-process AT monitoring worker (server-side).
 * Does not depend on browser/React. Never places broker orders.
 * Analyses require validated FXCM OHLC + server-rendered chart image in OpenAI request.
 */
import fs from "node:fs";
import { getForexConnectBridge } from "../../../market-data/forexconnect/client.js";
import type { AutomatedTradingEnvironment } from "../types.js";
import type { AutomatedTradingVerificationResult } from "../verification-types.js";
import {
  isVerificationAccountIdentityOk,
  isVerificationMarketQuoteFresh,
  verificationLastQuoteChangeAtUtc,
} from "../verification-gates.js";
import {
  getAtOpenAiAnalysisEngine,
  type AtOpenAiAnalysisEngine,
} from "../analysis/index.js";
import { renderAtMarketChartPng } from "./chart-render.js";
import {
  AT_MONITOR_ANALYSIS_COOLDOWN_MS,
  AT_MONITOR_MAX_RETRIES,
  AT_MONITOR_RETRY_BACKOFF_MS,
  latestClosedCandleOpenSec,
  scheduledAnalysisDedupeKey,
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
  nextCandleCloseUtc,
  parseAtMonitorTimeframe,
  type AtMonitorTimeframe,
} from "./timeframes.js";
import {
  AT_MONITOR_PHASE,
  AT_MONITOR_SCHEMA,
  defaultMonitorHealth,
  type AtMonitorConfig,
  type AtMonitorPublicStatus,
  type AtMonitorWorkerState,
} from "./types.js";

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
  pollIntervalMs?: number;
  /** Disable auto-timer (tests). */
  autoStart?: boolean;
}

export class AtMonitorWorker {
  private readonly store: AtMonitorStore;
  private readonly engine: AtOpenAiAnalysisEngine;
  private readonly storageRoot?: string;
  private readonly deps: AtMonitorWorkerDeps;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tickInFlight = false;
  private analysisInFlight = false;
  private disposed = false;
  private lastAnalysisAttemptMs = 0;
  private runtimeActive = false;
  private runtimeState: AtMonitorWorkerState = "STOPPED";

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
  }): void {
    if (hooks.getVerification) this.deps.getVerification = hooks.getVerification;
    if (hooks.getEnvironmentEpoch) this.deps.getEnvironmentEpoch = hooks.getEnvironmentEpoch;
    if (hooks.getSelectedEnvironment) this.deps.getSelectedEnvironment = hooks.getSelectedEnvironment;
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

  private ensureTimer(): void {
    if (this.timer || this.disposed) return;
    const ms = this.deps.pollIntervalMs
      ?? this.store.getState().config?.pollIntervalMs
      ?? 20_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, Math.max(15_000, ms));
    if (typeof this.timer === "object" && this.timer && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  private async bootstrapFromPersistence(): Promise<void> {
    const state = this.store.getState();
    if (!state.config?.enabled) {
      this.runtimeActive = false;
      this.runtimeState = "STOPPED";
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
      nextScheduledAnalysisAtUtc: nextCandleCloseUtc(state.config.timeframe),
    });
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

  getPublicStatus(): AtMonitorPublicStatus {
    const s = this.store.getState();
    return {
      schemaVersion: AT_MONITOR_SCHEMA,
      phase: AT_MONITOR_PHASE,
      supportedTimeframes: [...AT_MONITOR_TIMEFRAMES],
      unsupportedNote:
        "H2/2h is not available: ForexConnect project mappings support 5m/15m/30m/1h/4h/1d/1w only (no H2).",
      chartImageSource: "server-ohlc-render",
      requiresBrowserOpen: false,
      persistsAcrossAppRestart: true,
      persistsAcrossVpsReboot: "NOT_CLAIMED",
      config: s.config,
      health: {
        ...s.health,
        workerActive: this.runtimeActive && Boolean(s.config?.enabled),
        workerState: this.runtimeActive ? this.runtimeState : (s.config?.enabled ? s.health.workerState : "STOPPED"),
        analysisInFlight: this.analysisInFlight,
      },
      placesOrders: false,
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
      pollIntervalMs: prev?.pollIntervalMs ?? 20_000,
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
        nextScheduledAnalysisAtUtc: nextCandleCloseUtc(tf),
      },
    }));
    this.ensureTimer();
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
        lastError: reason === "user_stop" ? null : reason.slice(0, 200),
        lastBlockerCode: reason === "user_stop" ? null : "STOPPED",
      },
    }));
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
    this.tickInFlight = true;
    const configEpoch = persisted.config.configEpoch;
    try {
      const selectedEnv = this.deps.getSelectedEnvironment?.() ?? persisted.config.environment;
      if (selectedEnv !== persisted.config.environment) {
        this.runtimeState = "PAUSED_SAFETY";
        await this.patchHealth({
          workerState: "PAUSED_SAFETY",
          lastBlockerCode: "ENVIRONMENT_MISMATCH",
          lastError: "Monitoring paused — selected AT environment no longer matches monitor config.",
        });
        return;
      }

      this.runtimeActive = true;
      const candles = await this.loadCandles(persisted.config.instrument, persisted.config.timeframe);
      // Abort if config changed mid-tick
      if (this.store.getState().config?.configEpoch !== configEpoch) return;

      const verification = this.deps.getVerification?.(persisted.config.environment) ?? null;
      // Use Phase 52 contract fields (identityStatus + LIVE Bid/Ask) — not invented aliases.
      const quoteFresh = isVerificationMarketQuoteFresh(verification);
      const feedStatus = verification?.market?.feedStatus ?? null;
      const lastQuoteChange = verificationLastQuoteChangeAtUtc(verification);
      const identityOk = isVerificationAccountIdentityOk(verification);

      await this.patchHealth({
        lastCandleUpdateAtUtc: nowIso(),
        lastObservationAtUtc: nowIso(),
        lastQuoteChangeAtUtc: lastQuoteChange,
        quoteFresh: verification ? quoteFresh : null,
        feedStatus: feedStatus ? String(feedStatus) : null,
        nextScheduledAnalysisAtUtc: nextCandleCloseUtc(persisted.config.timeframe),
      });

      if (!verification || !identityOk) {
        this.runtimeState = "VERIFICATION_REQUIRED";
        await this.patchHealth({
          workerState: "VERIFICATION_REQUIRED",
          lastBlockerCode: "VERIFICATION_REQUIRED",
          lastError: "Fresh Phase 52 verification is required before scheduled OpenAI analysis.",
        });
        return;
      }

      if (!candles.length) {
        this.runtimeState = "DATA_INSUFFICIENT";
        await this.patchHealth({
          workerState: "DATA_INSUFFICIENT",
          lastBlockerCode: "DATA_INSUFFICIENT",
          lastError: "No candles returned from ForexConnect.",
        });
        return;
      }

      if (!quoteFresh) {
        this.runtimeState = "STALE_QUOTES";
        await this.patchHealth({
          workerState: "STALE_QUOTES",
          lastBlockerCode: "STALE_QUOTES",
          lastError:
            "Quotes are not fresh — monitoring continues but LIVE is not claimed and analysis is blocked.",
        });
        return;
      }

      if (!this.analysisInFlight) {
        this.runtimeState = "MONITORING_LIVE";
        await this.patchHealth({ workerState: "MONITORING_LIVE" });
      }

      const closed = latestClosedCandleOpenSec(
        candles.map((c) => c.time),
        persisted.config.timeframe,
      );
      if (!closed) {
        this.runtimeState = "WAITING_CANDLE_CLOSE";
        await this.patchHealth({ workerState: "WAITING_CANDLE_CLOSE" });
        return;
      }

      await this.patchHealth({ lastClosedCandleOpenSec: closed.openTimeSec });

      const dedupe = scheduledAnalysisDedupeKey({
        environment: persisted.config.environment,
        instrument: persisted.config.instrument,
        timeframe: persisted.config.timeframe,
        closedCandleOpenSec: closed.openTimeSec,
        configEpoch,
      });
      if (this.store.hasDedupe(dedupe)) return;

      const sinceLast = Date.now() - this.lastAnalysisAttemptMs;
      if (sinceLast < AT_MONITOR_ANALYSIS_COOLDOWN_MS) return;
      if (this.analysisInFlight) return;

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
        consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
      });
    } finally {
      this.tickInFlight = false;
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
      const chartCandles = input.candles.map((c) => ({
        ...c,
        isClosed: Math.floor(nowMs / 1000) >= c.time + (
          tf === "5m" ? 300 : tf === "15m" ? 900 : tf === "30m" ? 1800 : 3600
        ),
      }));
      const rendered = renderAtMarketChartPng({
        instrument: input.config.instrument,
        timeframe: tf,
        timeframeLabel: AT_MONITOR_TIMEFRAME_LABELS[tf],
        candles: chartCandles,
        observationUtc: nowIso(),
      });

      if (!rendered.ok) {
        this.runtimeState = "IMAGE_UNAVAILABLE";
        await this.patchHealth({
          workerState: "IMAGE_UNAVAILABLE",
          lastBlockerCode: "IMAGE_UNAVAILABLE",
          lastError: rendered.message,
          consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
        });
        return { ok: false, code: "IMAGE_UNAVAILABLE", message: rendered.message };
      }

      const imageBase64 = rendered.png.toString("base64");
      const chartMeta = {
        available: true as const,
        imageHash: rendered.imageHash,
        capturedAtUtc: nowIso(),
        source: rendered.source,
        note: rendered.note,
        blocker: null as string | null,
        width: rendered.width,
        height: rendered.height,
        byteLength: rendered.byteLength,
        observationUtc: nowIso(),
      };
      await this.patchHealth({
        lastScreenshotAtUtc: chartMeta.capturedAtUtc,
        lastScreenshotImageHash: chartMeta.imageHash,
      });

      if (this.store.getState().config?.configEpoch !== configEpoch) {
        return { ok: false, code: "CONFIG_CHANGED", message: "Monitor configuration changed; analysis aborted." };
      }

      const envEpoch = this.deps.getEnvironmentEpoch?.() ?? 0;
      const result = await this.engine.analyzeWithChart({
        environment: input.config.environment,
        environmentEpoch: envEpoch,
        instrument: input.config.instrument,
        primaryTimeframe: tf,
        timeframes: [tf],
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

      if (this.store.getState().config?.configEpoch !== configEpoch) {
        return { ok: false, code: "CONFIG_CHANGED", message: "Monitor configuration changed; discarding stale result." };
      }

      if (!result.ok || !result.analysis) {
        this.runtimeState = result.code === "DATA_INSUFFICIENT" ? "DATA_INSUFFICIENT" : "PROVIDER_ERROR";
        await this.patchHealth({
          workerState: this.runtimeState,
          lastBlockerCode: result.code,
          lastError: result.message,
          consecutiveFailures: (this.store.getState().health.consecutiveFailures ?? 0) + 1,
        });
        return { ok: false, code: result.code, message: result.message };
      }

      // Persist chart bytes keyed by analysis id (if available).
      if (rendered.ok && result.analysis.analysisId) {
        const dir = chartImageDir(this.storageRoot);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(chartImagePath(result.analysis.analysisId, this.storageRoot), rendered.png);
        pruneChartImages(this.storageRoot);
      }

      if (input.dedupeKey) await this.store.rememberDedupe(input.dedupeKey);

      this.runtimeState = "ANALYSIS_SUCCESS";
      await this.patchHealth({
        workerState: "ANALYSIS_SUCCESS",
        lastAnalysisAtUtc: result.analysis.createdAtUtc,
        lastAnalysisId: result.analysis.analysisId,
        lastDedupeKey: input.dedupeKey ?? null,
        consecutiveFailures: 0,
        lastError: null,
        lastBlockerCode: null,
        nextScheduledAnalysisAtUtc: nextCandleCloseUtc(tf),
      });
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
    if (!isVerificationMarketQuoteFresh(input.verification)) {
      return {
        ok: false,
        code: "STALE_QUOTES",
        message: "Quotes are not fresh — analysis blocked until LIVE market evidence is available.",
        status: this.getPublicStatus(),
      };
    }
    const config: AtMonitorConfig = useConfig && useConfig.instrument === instrument && useConfig.timeframe === tf
      ? useConfig
      : {
          enabled: false,
          environment: input.environment,
          instrument,
          timeframe: tf,
          configEpoch: (useConfig?.configEpoch ?? 0) + 1,
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
