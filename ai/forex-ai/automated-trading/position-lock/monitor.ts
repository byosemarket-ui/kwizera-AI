/**
 * XAU/USD position lifecycle monitor — read-only reconciliation tick.
 * Reads Trades/Orders/ClosedTrades, updates the lock, tracks floating P/L against the
 * captured 25% budget, and freezes new entries on a breach. Never submits/modifies/cancels/closes.
 */
import type { BrokerRoTableSnapshot } from "../simulation-risk/exposure-reconciliation.js";
import { classifyXauBrokerExposure } from "./classify.js";
import type { XauPositionLockStore } from "./store.js";
import type { XauBrokerEvidence, XauPositionLockRecord } from "./types.js";

export interface XauMonitorDeps {
  store: XauPositionLockStore;
  fetchTrades: () => Promise<BrokerRoTableSnapshot | null>;
  fetchOrders: () => Promise<BrokerRoTableSnapshot | null>;
  fetchClosedTrades?: () => Promise<BrokerRoTableSnapshot | null>;
  symbol: string;
  offerId: string | null;
  accountBindingHash: string | null;
  nowMs?: number;
  confirmIntervalMs?: number;
}

export interface XauMonitorAlert {
  code:
    | "RISK_LIMIT_EXCEEDED"
    | "PROTECTIVE_STOP_NOT_OBSERVED"
    | "BROKER_STATE_UNKNOWN"
    | "EXTERNAL_XAU_POSITION_PRESENT";
  severity: "CRITICAL" | "WARNING" | "INFO";
  message: string;
  tradeId: string | null;
}

export interface XauMonitorTickResult {
  evidence: XauBrokerEvidence;
  record: XauPositionLockRecord;
  alerts: XauMonitorAlert[];
  readOnly: true;
  placesOrders: false;
  mutatesBroker: false;
}

async function safe(fn: (() => Promise<BrokerRoTableSnapshot | null>) | undefined): Promise<BrokerRoTableSnapshot | null> {
  if (!fn) return null;
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function runXauPositionMonitorTick(deps: XauMonitorDeps): Promise<XauMonitorTickResult> {
  const nowMs = deps.nowMs ?? Date.now();
  const before = deps.store.get();
  const [trades, orders, closed] = await Promise.all([
    safe(deps.fetchTrades),
    safe(deps.fetchOrders),
    safe(deps.fetchClosedTrades),
  ]);
  const evidence = classifyXauBrokerExposure({
    trades,
    orders,
    closedTrades: closed,
    symbol: deps.symbol,
    offerId: deps.offerId,
    trackedTradeIds: before.trackedTradeIds,
    trackedOrderIds: before.trackedOrderIds,
    accountBindingHash: deps.accountBindingHash,
    nowMs,
  });
  let record = await deps.store.reconcile(evidence, { nowMs, confirmIntervalMs: deps.confirmIntervalMs });

  const alerts: XauMonitorAlert[] = [];
  if (evidence.status === "UNKNOWN" && record.state !== "AVAILABLE") {
    alerts.push({
      code: "BROKER_STATE_UNKNOWN",
      severity: "WARNING",
      message: "Broker XAU/USD state unknown — lock kept occupied.",
      tradeId: null,
    });
  }
  const maxRisk = record.reservation?.maxRiskAccountCurrency ?? null;
  for (const p of evidence.positions) {
    if (p.ownership !== "AUTOMATED") {
      alerts.push({
        code: "EXTERNAL_XAU_POSITION_PRESENT",
        severity: "INFO",
        message: "External XAU/USD position observed read-only — automated entry blocked; not managed.",
        tradeId: p.tradeId,
      });
      continue;
    }
    if (p.stopLoss == null) {
      alerts.push({
        code: "PROTECTIVE_STOP_NOT_OBSERVED",
        severity: "WARNING",
        message: "Automated XAU/USD position has no observable Stop Loss on the broker row.",
        tradeId: p.tradeId,
      });
    }
    if (maxRisk != null && maxRisk > 0 && p.floatingPl != null && -p.floatingPl >= maxRisk) {
      alerts.push({
        code: "RISK_LIMIT_EXCEEDED",
        severity: "CRITICAL",
        message: `Floating loss ${-p.floatingPl} ≥ captured 25% budget ${maxRisk} — entries frozen; no broker action taken.`,
        tradeId: p.tradeId,
      });
      record = await deps.store.raiseRiskBreach({
        tradeId: p.tradeId,
        observedLossAccountCurrency: -p.floatingPl,
        maxRiskAccountCurrency: maxRisk,
        reason: "FLOATING_LOSS_REACHED_25PCT_BUDGET",
        nowMs,
      });
    }
  }

  return { evidence, record, alerts, readOnly: true, placesOrders: false, mutatesBroker: false };
}
