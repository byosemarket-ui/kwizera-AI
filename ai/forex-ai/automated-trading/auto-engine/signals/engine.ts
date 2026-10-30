import { randomUUID } from "node:crypto";
import { evaluateSmaCrossoverStrategy } from "../strategy/evaluate.js";
import type { StrategyCandle } from "../strategy/rules.js";
import { SMA_CROSSOVER_RULES } from "../strategy/rules.js";
import { getAutoSignalStore, type AutoSignalStore } from "./store.js";
import {
  AUTO_SIGNAL_SCHEMA,
  signalDedupeKey,
  type AutoSignalRecord,
} from "./types.js";
import { isUtcMinuteInSession } from "../../demo-execution/open-market-risk.js";

export interface GenerateAutoSignalInput {
  instrument: string;
  timeframe: string;
  candles: StrategyCandle[];
  pointSize: number | null;
  nowMs?: number;
  sessionUtcStartMinute?: number | null;
  sessionUtcEndMinute?: number | null;
  quoteAgeMs?: number | null;
  quoteMaxAgeMs?: number;
  spread?: number | null;
  maxSpread?: number | null;
  store?: AutoSignalStore;
}

export interface GenerateAutoSignalResult {
  ok: boolean;
  code: string;
  signal: AutoSignalRecord | null;
  duplicate: boolean;
  placesOrders: false;
  mutatesBroker: false;
}

export function generateAutoSignal(input: GenerateAutoSignalInput): GenerateAutoSignalResult {
  const nowMs = input.nowMs ?? Date.now();
  const store = input.store ?? getAutoSignalStore();
  const createdAtUtc = new Date(nowMs).toISOString();

  if (input.sessionUtcStartMinute != null && input.sessionUtcEndMinute != null) {
    const minute = new Date(nowMs).getUTCHours() * 60 + new Date(nowMs).getUTCMinutes();
    if (!isUtcMinuteInSession(minute, input.sessionUtcStartMinute, input.sessionUtcEndMinute)) {
      return {
        ok: false,
        code: "OUTSIDE_TRADING_SESSION",
        signal: null,
        duplicate: false,
        placesOrders: false,
        mutatesBroker: false,
      };
    }
  }

  const maxAge = input.quoteMaxAgeMs ?? 15_000;
  if (input.quoteAgeMs == null || !Number.isFinite(input.quoteAgeMs)) {
    return {
      ok: false,
      code: "QUOTE_AGE_UNAVAILABLE",
      signal: null,
      duplicate: false,
      placesOrders: false,
      mutatesBroker: false,
    };
  }
  if (input.quoteAgeMs > maxAge) {
    return {
      ok: false,
      code: "QUOTE_STALE",
      signal: null,
      duplicate: false,
      placesOrders: false,
      mutatesBroker: false,
    };
  }

  if (
    input.maxSpread != null
    && Number.isFinite(input.maxSpread)
    && (input.spread == null || !Number.isFinite(input.spread) || input.spread > input.maxSpread)
  ) {
    return {
      ok: false,
      code: "SPREAD_REJECTED",
      signal: null,
      duplicate: false,
      placesOrders: false,
      mutatesBroker: false,
    };
  }

  const evaluation = evaluateSmaCrossoverStrategy({
    candles: input.candles,
    pointSize: input.pointSize,
  });

  if (!evaluation.ok || evaluation.direction === "NO_TRADE" || evaluation.closedCandleOpenSec == null) {
    return {
      ok: evaluation.ok,
      code: evaluation.code,
      signal: null,
      duplicate: false,
      placesOrders: false,
      mutatesBroker: false,
    };
  }

  const dedupeKey = signalDedupeKey({
    instrument: input.instrument,
    timeframe: input.timeframe,
    closedCandleOpenSec: evaluation.closedCandleOpenSec,
    direction: evaluation.direction,
  });
  const existing = store.findByDedupe(dedupeKey);
  if (existing && (existing.status === "ACTIVE" || existing.status === "CONSUMED")) {
    return {
      ok: false,
      code: "DUPLICATE_SIGNAL",
      signal: existing,
      duplicate: true,
      placesOrders: false,
      mutatesBroker: false,
    };
  }

  const signal: AutoSignalRecord = {
    schemaVersion: AUTO_SIGNAL_SCHEMA,
    signalId: randomUUID(),
    dedupeKey,
    strategyId: SMA_CROSSOVER_RULES.strategyId,
    instrument: input.instrument,
    timeframe: input.timeframe,
    direction: evaluation.direction,
    status: "ACTIVE",
    code: evaluation.code,
    reasons: evaluation.reasons,
    confidencePct: evaluation.confidencePct,
    closedCandleOpenSec: evaluation.closedCandleOpenSec,
    entryPrice: evaluation.entryPrice,
    stopLoss: evaluation.stopLoss,
    takeProfit: evaluation.takeProfit,
    atr: evaluation.atr,
    createdAtUtc,
    expiresAtUtc: new Date(nowMs + 60 * 60_000).toISOString(),
    consumedAtUtc: null,
  };
  store.upsert(signal);
  return {
    ok: true,
    code: signal.code,
    signal,
    duplicate: false,
    placesOrders: false,
    mutatesBroker: false,
  };
}
