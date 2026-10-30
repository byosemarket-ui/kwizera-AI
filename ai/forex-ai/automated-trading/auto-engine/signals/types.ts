import type { StrategyDirection } from "../strategy/rules.js";

export const AUTO_SIGNAL_SCHEMA = "kwizera.auto-signal.v1" as const;

export type AutoSignalStatus = "ACTIVE" | "CONSUMED" | "EXPIRED" | "REJECTED";

export interface AutoSignalRecord {
  schemaVersion: typeof AUTO_SIGNAL_SCHEMA;
  signalId: string;
  dedupeKey: string;
  strategyId: string;
  instrument: string;
  timeframe: string;
  direction: StrategyDirection;
  status: AutoSignalStatus;
  code: string;
  reasons: string[];
  confidencePct: number | null;
  closedCandleOpenSec: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  atr: number | null;
  createdAtUtc: string;
  expiresAtUtc: string | null;
  consumedAtUtc: string | null;
}

export function signalDedupeKey(input: {
  instrument: string;
  timeframe: string;
  closedCandleOpenSec: number;
  direction: string;
}): string {
  return [
    String(input.instrument).replace(/\s+/g, "").toUpperCase(),
    input.timeframe,
    String(input.closedCandleOpenSec),
    input.direction,
  ].join("|");
}
