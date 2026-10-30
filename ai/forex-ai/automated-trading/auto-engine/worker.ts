/**
 * Phase 4.1 — Auto-engine worker tick.
 * Generates signals, refreshes daily risk, prepares dry-run entries, reconciles positions.
 * NEVER enables mutation or places broker orders.
 */
import { computeDailyRiskSnapshot } from "./daily-risk/compute.js";
import { getDailyRiskStore, type DailyRiskStore } from "./daily-risk/store.js";
import type { DailyRiskSnapshot } from "./daily-risk/types.js";
import { loadAutoEngineConfig, type AutoEngineConfig } from "./config.js";
import { prepareAutoEntryFromSignal } from "./orchestration/prepare-entry.js";
import { reconcilePositions } from "./position-monitor/reconcile.js";
import { generateAutoSignal } from "./signals/engine.js";
import { getAutoSignalStore, type AutoSignalStore } from "./signals/store.js";
import type { AutoSignalRecord } from "./signals/types.js";
import type { StrategyCandle } from "./strategy/rules.js";
import type { DemoOpenMarketRiskInput } from "../demo-execution/open-market-risk.js";

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
  }>;
  nowMs?: number;
}

export interface AutoEnginePublicStatus {
  phase: "4.1";
  enabled: boolean;
  mode: AutoEngineConfig["mode"];
  strategyId: string;
  instruments: string[];
  timeframe: string;
  lastTickAtUtc: string | null;
  lastSignal: AutoSignalRecord | null;
  lastPrepareCode: string | null;
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
  private lastReconcileCode: string | null = null;
  private blockNewEntries = true;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly deps: AutoEngineTickDeps) {}

  getStatus(): AutoEnginePublicStatus {
    const config = this.deps.config ?? loadAutoEngineConfig();
    const daily = (this.deps.dailyRiskStore ?? getDailyRiskStore()).get();
    return {
      phase: "4.1",
      enabled: config.enabled,
      mode: config.mode,
      strategyId: config.strategyId,
      instruments: config.instruments,
      timeframe: config.timeframe,
      lastTickAtUtc: this.lastTickAtUtc,
      lastSignal: this.lastSignal,
      lastPrepareCode: this.lastPrepareCode,
      dailyRisk: daily,
      positionReconcileCode: this.lastReconcileCode,
      blockNewEntries: this.blockNewEntries,
      placesOrders: false,
      acceptsForExecution: false,
      mutatesBroker: false,
      note: "Auto-engine prepares DEMO entries in dry-run only. Mutation/grants/LIVE remain off until explicit activation.",
    };
  }

  async tick(): Promise<AutoEnginePublicStatus> {
    const config = this.deps.config ?? loadAutoEngineConfig();
    const nowMs = this.deps.nowMs ?? Date.now();
    this.lastTickAtUtc = new Date(nowMs).toISOString();
    if (!config.enabled || config.mode === "off") {
      this.blockNewEntries = true;
      return this.getStatus();
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
          mode: config.mode === "armed_prepare_only" ? "armed_prepare_only" : "dry_run",
          nowMs,
        });
        this.lastPrepareCode = prepared.code;
        // Intentionally never calls openMarket / mutation adapter.
      } else if (!generated.ok) {
        this.lastPrepareCode = generated.code;
      }
    }

    return this.getStatus();
  }

  start(): void {
    const config = this.deps.config ?? loadAutoEngineConfig();
    if (this.timer || !config.enabled) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, config.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

let sharedWorker: AutoEngineWorker | null = null;

export function getAutoEngineWorker(): AutoEngineWorker | null {
  return sharedWorker;
}

export function setAutoEngineWorkerForTests(worker: AutoEngineWorker | null): void {
  sharedWorker = worker;
}
