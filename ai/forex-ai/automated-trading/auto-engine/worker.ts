/**
 * Phase 4.1/4.3 — Auto-engine worker tick.
 * Generates signals, refreshes daily risk, prepares entries, reconciles positions.
 * Broker submit only when mode=armed_execute AND submitAuthorized AND all gates pass.
 */
import { randomUUID } from "node:crypto";
import { computeDailyRiskSnapshot } from "./daily-risk/compute.js";
import { getDailyRiskStore, type DailyRiskStore } from "./daily-risk/store.js";
import type { DailyRiskSnapshot } from "./daily-risk/types.js";
import { loadAutoEngineConfig, type AutoEngineConfig } from "./config.js";
import { prepareAutoEntryFromSignal } from "./orchestration/prepare-entry.js";
import { submitPreparedDemoEntry } from "./orchestration/submit-prepared-entry.js";
import { reconcilePositions } from "./position-monitor/reconcile.js";
import { generateAutoSignal } from "./signals/engine.js";
import { getAutoSignalStore, type AutoSignalStore } from "./signals/store.js";
import type { AutoSignalRecord } from "./signals/types.js";
import type { StrategyCandle } from "./strategy/rules.js";
import type { DemoOpenMarketRiskInput } from "../demo-execution/open-market-risk.js";
import {
  ownsAutoEngineWorkerLock,
  tryAcquireAutoEngineWorkerLock,
  type WorkerLockHandle,
} from "./worker-lock.js";
import type { DemoLifecycleOrchestrator } from "../demo-execution/orchestrator.js";

export interface AutoEngineTickDeps {
  config?: AutoEngineConfig;
  signalStore?: AutoSignalStore;
  dailyRiskStore?: DailyRiskStore;
  loadCandles: (instrument: string, timeframe: string) => Promise<StrategyCandle[]>;
  loadPointSize: (instrument: string) => Promise<number | null>;
  loadQuoteMeta: (instrument: string) => Promise<{
    ageMs: number | null;
    spread: number | null;
  }>;
  loadAccountRiskContext: () => Promise<{
    riskPartial: Omit<
      DemoOpenMarketRiskInput,
      | "instrument"
      | "direction"
      | "lots"
      | "stopLoss"
      | "takeProfit"
      | "entryPrice"
      | "requireProtective"
      | "dayRealizedPnlAccount"
      | "dayStartEquity"
      | "grantMaxLots"
    >;
    grantMaxLots: number;
    emergencyEntryLock: boolean;
    masterEnable: boolean;
    allowDemoMutationEnabled: boolean;
    entriesUsedInGrant: number;
    cooldownUntilMs: number | null;
    accountId: string | null;
    accountCurrency: string | null;
    equity: number | null;
    balance: number | null;
    usableMargin: number | null;
    accountsFetchedAtUtc: string | null;
    dayClosedTrades: Array<{
      tradeId?: string | null;
      closeTimeUtc: string | null;
      realizedPnl: number | null;
    }> | null;
    closedTradesFetchOk: boolean;
    closedTradesFetchedAtUtc: string | null;
    openUnrealizedPnl: number | null;
    openTradesFetchOk: boolean;
    openTradesFetchedAtUtc: string | null;
    brokerConnected: boolean;
    brokerPositions: Array<{
      tradeId: string;
      instrument: string;
      lots: number | null;
      amount: number | null;
    }> | null;
    internalPositions: Array<{
      lifecycleId: string;
      instrument: string;
      tradeId: string | null;
      direction: "BUY" | "SELL" | null;
      lots: number | null;
      protectionStatus: string | null;
      fillConfirmed: boolean;
      blocksAdditionalEntries: boolean;
    }>;
    activeGrantId: string | null;
  }>;
  /** Optional orchestrator for armed_execute submits. */
  getOrchestrator?: () => Pick<DemoLifecycleOrchestrator, "openMarket">;
  nowMs?: number;
}

export interface AutoEnginePublicStatus {
  phase: "4.3";
  enabled: boolean;
  mode: AutoEngineConfig["mode"];
  strategyId: string;
  instruments: string[];
  timeframe: string;
  lots: number;
  continuousEnabled: boolean;
  submitAuthorized: boolean;
  workerLockHeld: boolean;
  lastTickAtUtc: string | null;
  lastSignal: AutoSignalRecord | null;
  lastPrepareCode: string | null;
  lastSubmitCode: string | null;
  dailyRisk: DailyRiskSnapshot | null;
  positionReconcileCode: string | null;
  blockNewEntries: boolean;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export class AutoEngineWorker {
  private lastTickAtUtc: string | null = null;
  private lastSignal: AutoSignalRecord | null = null;
  private lastPrepareCode: string | null = null;
  private lastSubmitCode: string | null = null;
  private lastReconcileCode: string | null = null;
  private blockNewEntries = true;
  private timer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** Prevents overlapping ticks when poll interval < tick duration. */
  private tickInFlight = false;
  private readonly ownerId = randomUUID();
  private lockHandle: WorkerLockHandle | null = null;

  constructor(private readonly deps: AutoEngineTickDeps) {}

  getStatus(): AutoEnginePublicStatus {
    const config = this.deps.config ?? loadAutoEngineConfig();
    const daily = (this.deps.dailyRiskStore ?? getDailyRiskStore()).get();
    const lockHeld = this.lockHandle != null
      && ownsAutoEngineWorkerLock({ ownerId: this.ownerId, path: this.lockHandle.path });
    return {
      phase: "4.3",
      enabled: config.enabled,
      mode: config.mode,
      strategyId: config.strategyId,
      instruments: config.instruments,
      timeframe: config.timeframe,
      lots: config.lots,
      continuousEnabled: config.continuousEnabled,
      submitAuthorized: config.submitAuthorized,
      workerLockHeld: lockHeld,
      lastTickAtUtc: this.lastTickAtUtc,
      lastSignal: this.lastSignal,
      lastPrepareCode: this.lastPrepareCode,
      lastSubmitCode: this.lastSubmitCode,
      dailyRisk: daily,
      positionReconcileCode: this.lastReconcileCode,
      blockNewEntries: this.blockNewEntries,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      note: config.mode === "armed_execute" && config.submitAuthorized
        ? "Auto-engine armed_execute: grant-scoped DEMO submit only when all gates pass. LIVE remains unauthorized."
        : "Auto-engine prepares DEMO entries; broker mutation stays disabled unless armed_execute + submitAuthorized + gates.",
    };
  }

  async tick(): Promise<AutoEnginePublicStatus> {
    if (this.tickInFlight) {
      return {
        ...this.getStatus(),
        lastPrepareCode: this.lastPrepareCode ?? "TICK_IN_FLIGHT",
        note: "Skipped overlapping tick (concurrent protection).",
      };
    }
    this.tickInFlight = true;
    try {
      const config = this.deps.config ?? loadAutoEngineConfig();
      const nowMs = this.deps.nowMs ?? Date.now();
      this.lastTickAtUtc = new Date(nowMs).toISOString();
      if (!config.enabled || config.mode === "off") {
        this.blockNewEntries = true;
        return this.getStatus();
      }

      if (this.lockHandle) {
        if (!this.lockHandle.heartbeat()) {
          this.blockNewEntries = true;
          this.lastPrepareCode = "WORKER_LOCK_LOST";
          return this.getStatus();
        }
      }

      const ctx = await this.deps.loadAccountRiskContext();
      const dailyStore = this.deps.dailyRiskStore ?? getDailyRiskStore();
      const daily = computeDailyRiskSnapshot({
        nowMs,
        accountId: ctx.accountId,
        accountCurrency: ctx.accountCurrency,
        equity: ctx.equity,
        balance: ctx.balance,
        usableMargin: ctx.usableMargin,
        accountsFetchedAtUtc: ctx.accountsFetchedAtUtc,
        prior: dailyStore.get(),
        dayClosedTrades: ctx.dayClosedTrades,
        closedTradesFetchOk: ctx.closedTradesFetchOk,
        closedTradesFetchedAtUtc: ctx.closedTradesFetchedAtUtc,
        openUnrealizedPnl: ctx.openUnrealizedPnl,
        openTradesFetchOk: ctx.openTradesFetchOk,
        openTradesFetchedAtUtc: ctx.openTradesFetchedAtUtc,
      });
      dailyStore.save(daily);

      const reconcile = reconcilePositions({
        brokerConnected: ctx.brokerConnected,
        tradesFetchOk: ctx.openTradesFetchOk,
        internal: ctx.internalPositions,
        broker: ctx.brokerPositions,
        allowlistInstruments: config.instruments,
      });
      this.lastReconcileCode = reconcile.code;
      this.blockNewEntries = reconcile.blockNewEntries || !daily.authoritative;

      const signalStore = this.deps.signalStore ?? getAutoSignalStore();
      const prepareMode = config.mode === "dry_run" ? "dry_run" : "armed_prepare_only";

      for (const instrument of config.instruments) {
        const candles = await this.deps.loadCandles(instrument, config.timeframe);
        const pointSize = await this.deps.loadPointSize(instrument);
        const quote = await this.deps.loadQuoteMeta(instrument);
        const generated = generateAutoSignal({
          instrument,
          timeframe: config.timeframe,
          candles,
          pointSize,
          nowMs,
          sessionUtcStartMinute: config.sessionUtcStartMinute,
          sessionUtcEndMinute: config.sessionUtcEndMinute,
          quoteAgeMs: quote.ageMs,
          spread: quote.spread,
          maxSpread: config.maxSpread,
          store: signalStore,
        });
        if (generated.signal) this.lastSignal = generated.signal;

        if (
          generated.ok
          && generated.signal
          && generated.signal.direction !== "NO_TRADE"
          && !this.blockNewEntries
        ) {
          const prepared = prepareAutoEntryFromSignal({
            signal: generated.signal,
            lots: config.lots,
            grantMaxLots: ctx.grantMaxLots,
            riskInput: ctx.riskPartial,
            dailyRisk: daily,
            emergencyEntryLock: ctx.emergencyEntryLock,
            masterEnable: ctx.masterEnable,
            allowDemoMutationEnabled: ctx.allowDemoMutationEnabled,
            entriesUsedInGrant: ctx.entriesUsedInGrant,
            cooldownUntilMs: ctx.cooldownUntilMs,
            mode: prepareMode,
            nowMs,
          });
          this.lastPrepareCode = prepared.code;

          if (
            prepared.ok
            && config.mode === "armed_execute"
            && config.submitAuthorized
            && this.deps.getOrchestrator
            && ctx.activeGrantId
          ) {
            const submitted = await submitPreparedDemoEntry({
              prepared,
              dailyRisk: daily,
              grantId: ctx.activeGrantId,
              allowDemoMutationEnabled: ctx.allowDemoMutationEnabled,
              emergencyEntryLock: ctx.emergencyEntryLock,
              masterEnable: ctx.masterEnable,
              reconcileBlockNewEntries: reconcile.blockNewEntries,
              submitAuthorized: true,
              accountId: ctx.accountId,
              orchestrator: this.deps.getOrchestrator(),
              nowMs,
            });
            this.lastSubmitCode = submitted.code;
            if (submitted.submitted && !submitted.fillConfirmed) {
              this.blockNewEntries = true;
            }
          }
        } else if (!generated.ok) {
          this.lastPrepareCode = generated.code;
        }
      }

      return this.getStatus();
    } finally {
      this.tickInFlight = false;
    }
  }

  /**
   * Start continuous polling only after acquiring cross-process ownership.
   * Returns false when another healthy worker holds the lock.
   */
  start(): { ok: boolean; code: string } {
    const config = this.deps.config ?? loadAutoEngineConfig();
    if (this.timer || !config.enabled) {
      return { ok: false, code: this.timer ? "ALREADY_STARTED" : "ENGINE_DISABLED" };
    }
    if (!config.continuousEnabled) {
      return { ok: false, code: "CONTINUOUS_NOT_ENABLED" };
    }
    const acquired = tryAcquireAutoEngineWorkerLock({ ownerId: this.ownerId });
    if (!acquired.ok) {
      return { ok: false, code: acquired.code };
    }
    this.lockHandle = acquired.handle;
    this.timer = setInterval(() => {
      void this.tick();
    }, config.pollIntervalMs);
    this.heartbeatTimer = setInterval(() => {
      this.lockHandle?.heartbeat();
    }, Math.min(30_000, Math.max(5_000, Math.floor(config.pollIntervalMs / 2))));
    void this.tick();
    return { ok: true, code: "WORKER_STARTED" };
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = null;
    this.lockHandle?.release();
    this.lockHandle = null;
  }
}

let sharedWorker: AutoEngineWorker | null = null;

export function getAutoEngineWorker(): AutoEngineWorker | null {
  return sharedWorker;
}

export function setAutoEngineWorkerForTests(worker: AutoEngineWorker | null): void {
  sharedWorker = worker;
}

export function installSharedAutoEngineWorker(worker: AutoEngineWorker): AutoEngineWorker {
  if (sharedWorker && sharedWorker !== worker) {
    sharedWorker.stop();
  }
  sharedWorker = worker;
  return worker;
}
