/**
 * Stage 2 — Live read-only risk intelligence types.
 * Never mutates broker state; never authorizes submission.
 */

export const RISK_INTELLIGENCE_SCHEMA = "kwizera.risk-intelligence.v1" as const;
export const RISK_INTELLIGENCE_STAGE = "STAGE_2_LIVE_READ_ONLY" as const;

export type RiskFieldStatus =
  | "VERIFIED"
  | "UNAVAILABLE"
  | "STALE"
  | "INVALID"
  | "NOT_CONFIGURED";

export interface RiskFieldMeta {
  status: RiskFieldStatus;
  reason: string | null;
}

export interface RiskIntelligenceAccount {
  accountId: string | null;
  accountIdMasked: string | null;
  environment: string | null;
  accountCurrency: string | null;
  balance: number | null;
  equity: number | null;
  usedMargin: number | null;
  usableMargin: number | null;
  dayPl: number | null;
  grossPl: number | null;
  fetchedAtUtc: string | null;
  fetchedAtMs: number | null;
  isFresh: boolean | null;
  missingFields: string[];
  meta: RiskFieldMeta;
}

export interface RiskIntelligencePosition {
  tradeId: string | null;
  instrument: string | null;
  direction: "BUY" | "SELL" | null;
  lots: number | null;
  amount: number | null;
  openPrice: number | null;
  markPrice: number | null;
  unrealizedPnl: number | null;
}

export interface RiskIntelligenceExposure {
  openPositionCountAccount: number | null;
  openPositionCountInstrument: number | null;
  openExposureLotsAccount: number | null;
  openExposureLotsInstrument: number | null;
  /** Values fed to Phase 2 precheck (instrument-scoped when instrument known). */
  openExposureLots: number | null;
  openPositionCount: number | null;
  exposureAuthoritative: boolean;
  duplicateTradeSuspected: boolean | null;
  positions: RiskIntelligencePosition[];
  baseUnitSize: number | null;
  contractVerified: boolean;
  meta: RiskFieldMeta;
}

export interface RiskIntelligenceDaily {
  tradingDayKey: string | null;
  timezone: "UTC";
  dayRealizedPnlAccount: number | null;
  dayRealizedSource: "accounts.dayPl" | "closed_trades_sum" | null;
  unrealizedPnlAccount: number | null;
  dayStartEquity: number | null;
  dayStartBalance: number | null;
  dayStartRecordedAtUtc: string | null;
  dailyDrawdownFraction: number | null;
  dailyLossAccount: number | null;
  authoritative: boolean;
  blockers: string[];
  meta: RiskFieldMeta;
  drawdownMeta: RiskFieldMeta;
}

export interface RiskIntelligenceSpread {
  instrument: string | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  quoteAgeMs: number | null;
  maxSpreadAbsolute: number | null;
  meta: RiskFieldMeta;
  limitMeta: RiskFieldMeta;
}

export interface RiskIntelligenceSnapshot {
  schemaVersion: typeof RISK_INTELLIGENCE_SCHEMA;
  stage: typeof RISK_INTELLIGENCE_STAGE;
  computedAtUtc: string;
  environment: string;
  instrument: string | null;
  brokerConnected: boolean;
  forexConnectAvailable: boolean;
  account: RiskIntelligenceAccount;
  exposure: RiskIntelligenceExposure;
  daily: RiskIntelligenceDaily;
  spread: RiskIntelligenceSpread;
  /** Ready-to-feed Phase 2 precheck slices. */
  precheckAccount: {
    equity: number | null;
    balance: number | null;
    usableMargin: number | null;
    usedMargin: number | null;
    currency: string | null;
    accountIdMasked: string | null;
    fetchedAtMs: number | null;
    isFresh: boolean | null;
  } | null;
  precheckExposure: {
    openExposureLots: number | null;
    openPositionCount: number | null;
    exposureAuthoritative: boolean;
    duplicateTradeSuspected: boolean | null;
    dayRealizedPnlAccount: number | null;
    dayStartEquity: number | null;
  };
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}
