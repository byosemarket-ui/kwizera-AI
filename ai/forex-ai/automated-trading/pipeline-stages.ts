/**
 * Phase 4.14B — Explicit dashboard pipeline stages (PASS/WAITING/BLOCKED/FAILED/NOT_VERIFIED).
 * Never greenwashes execution when only monitoring or snapshots are available.
 */

import type { AtFeedPipelineState } from "./feed-status-breakdown.js";
import type { MarketSelectionGapCode } from "./market-selection.js";

export type PipelineStageVerdict =
  | "PASS"
  | "WAITING"
  | "BLOCKED"
  | "FAILED"
  | "NOT_VERIFIED"
  | "NOT_APPLICABLE";

export interface PipelineStageRow {
  id: string;
  label: string;
  verdict: PipelineStageVerdict;
  reason: string;
  code: string;
}

export interface PipelineStagesInput {
  selectionGapCode: MarketSelectionGapCode | string | null;
  provider: string | null;
  shellInstrument: string | null;
  backendInstrument: string | null;
  brokerConnected: boolean | null;
  environment: string | null;
  feedPipelineState: AtFeedPipelineState | string | null;
  subscriptionConfirmed: boolean | null;
  hasSnapshot: boolean | null;
  updateCount: number | null;
  candleStrategyReady: boolean | null;
  closedCandleCount: number | null;
  strategySignal: string | null;
  strategyReady: boolean | null;
  strategyRejection: string | null;
  quantityCompatible001: boolean | null;
  marginVerified: boolean | null;
  accountPermissionVerified: boolean | null;
  executionAuthorized: boolean | null;
  placesOrders: boolean;
  acceptsForExecution: boolean;
  marketClosed: boolean | null;
}

function stage(
  id: string,
  label: string,
  verdict: PipelineStageVerdict,
  code: string,
  reason: string,
): PipelineStageRow {
  return { id, label, verdict, code, reason };
}

/**
 * Build operator-facing stage rows. Execution stages stay BLOCKED while safety gates fail.
 */
export function buildAtPipelineStages(input: PipelineStagesInput): PipelineStageRow[] {
  const rows: PipelineStageRow[] = [];
  const gap = String(input.selectionGapCode ?? "NO_MARKET_SELECTED");
  const shell = input.shellInstrument;
  const backend = input.backendInstrument;

  if (gap === "SYNCED" && shell) {
    rows.push(stage(
      "market_selection",
      "Market selection",
      "PASS",
      "SYNCED",
      `Shell and backend agree on ${shell} (${input.provider ?? "FOREXCONNECT"}).`,
    ));
  } else if (gap === "SHELL_ONLY" || gap === "BACKEND_ONLY" || gap === "MISMATCH") {
    rows.push(stage(
      "market_selection",
      "Market selection",
      "BLOCKED",
      gap,
      `Selection disagreement: shell=${shell ?? "—"} backend=${backend ?? "—"}.`,
    ));
  } else if (gap === "NO_MARKET_SELECTED") {
    rows.push(stage(
      "market_selection",
      "Market selection",
      "BLOCKED",
      "NO_MARKET_SELECTED",
      "No ForexConnect instrument selected — refuse silent defaults.",
    ));
  } else {
    rows.push(stage(
      "market_selection",
      "Market selection",
      "NOT_VERIFIED",
      gap || "UNKNOWN",
      "Selection state not fully verified.",
    ));
  }

  if (input.brokerConnected === true) {
    rows.push(stage(
      "broker_connection",
      "Broker connection",
      "PASS",
      "CONNECTED",
      `Session connected (${input.environment ?? "DEMO"}).`,
    ));
  } else if (input.brokerConnected === false) {
    rows.push(stage(
      "broker_connection",
      "Broker connection",
      "FAILED",
      "DISCONNECTED",
      "ForexConnect session not connected.",
    ));
  } else {
    rows.push(stage(
      "broker_connection",
      "Broker connection",
      "NOT_VERIFIED",
      "SESSION_UNKNOWN",
      "Connection state not verified.",
    ));
  }

  const feed = String(input.feedPipelineState ?? "");
  if (input.subscriptionConfirmed === true) {
    rows.push(stage(
      "subscription",
      "Offers subscription",
      "PASS",
      "SUBSCRIPTION_CONFIRMED",
      "Intended Offers subscription confirmed for selected instrument.",
    ));
  } else if (input.subscriptionConfirmed === false) {
    rows.push(stage(
      "subscription",
      "Offers subscription",
      "BLOCKED",
      "SUBSCRIPTION_NOT_CONFIRMED",
      "Instrument may be persisted but Offers subscribe is not confirmed.",
    ));
  } else {
    rows.push(stage(
      "subscription",
      "Offers subscription",
      "NOT_VERIFIED",
      "SUBSCRIPTION_UNKNOWN",
      "Subscription confirmation not observed.",
    ));
  }

  if (input.marketClosed === true || feed === "MARKET_CLOSED") {
    rows.push(stage(
      "market_data",
      "Market data ingestion",
      "WAITING",
      "MARKET_CLOSED",
      "Market closed/inactive — snapshot may exist; genuine ticks not expected until reopen.",
    ));
  } else if (feed === "LIVE") {
    rows.push(stage(
      "market_data",
      "Market data ingestion",
      "PASS",
      "LIVE",
      "Genuine fresh price changes observed.",
    ));
  } else if (feed === "SNAPSHOT_ONLY" || feed === "NO_PRICE_CHANGE" || feed === "HEARTBEAT_ONLY") {
    rows.push(stage(
      "market_data",
      "Market data ingestion",
      "WAITING",
      feed || "NO_PRICE_CHANGE",
      `Connected with snapshot/heartbeat only (updateCount=${input.updateCount ?? 0}); not LIVE.`,
    ));
  } else if (feed === "DISCONNECTED" || feed === "FEED_ERROR") {
    rows.push(stage(
      "market_data",
      "Market data ingestion",
      "FAILED",
      feed,
      "Feed disconnected or in error.",
    ));
  } else {
    rows.push(stage(
      "market_data",
      "Market data ingestion",
      "NOT_VERIFIED",
      feed || "FEED_UNKNOWN",
      "Feed pipeline state not fully verified.",
    ));
  }

  if (input.candleStrategyReady === true) {
    rows.push(stage(
      "historical",
      "Historical candles",
      "PASS",
      "CANDLE_QUALITY_OK",
      `Closed candles sufficient (${input.closedCandleCount ?? "—"}) for strategy.`,
    ));
  } else if (input.candleStrategyReady === false) {
    rows.push(stage(
      "historical",
      "Historical candles",
      "BLOCKED",
      "INSUFFICIENT_OR_INVALID_HISTORY",
      `Closed bars=${input.closedCandleCount ?? "—"} — strategy not ready.`,
    ));
  } else {
    rows.push(stage(
      "historical",
      "Historical candles",
      "NOT_VERIFIED",
      "HISTORY_NOT_AUDITED",
      "Candle quality not audited this cycle.",
    ));
  }

  if (input.strategyReady === true) {
    rows.push(stage(
      "strategy",
      "Strategy analysis",
      "PASS",
      "STRATEGY_READY",
      `Signal=${input.strategySignal ?? "NO_SIGNAL"} (NO_SIGNAL is valid).`,
    ));
  } else if (input.strategyRejection) {
    rows.push(stage(
      "strategy",
      "Strategy analysis",
      "BLOCKED",
      input.strategyRejection,
      `Strategy rejected: ${input.strategyRejection}.`,
    ));
  } else {
    rows.push(stage(
      "strategy",
      "Strategy analysis",
      "NOT_VERIFIED",
      "STRATEGY_NOT_RUN",
      "Strategy analysis not verified this cycle.",
    ));
  }

  if (input.quantityCompatible001 === true) {
    rows.push(stage(
      "quantity",
      "Quantity compatibility (0.01 lots)",
      "PASS",
      "QUANTITY_COMPATIBLE",
      "Owner 0.01-lot maps to a broker-legal AMOUNT.",
    ));
  } else if (input.quantityCompatible001 === false) {
    rows.push(stage(
      "quantity",
      "Quantity compatibility (0.01 lots)",
      "BLOCKED",
      "NO_COMPATIBLE_INSTRUMENT_FOR_OWNER_LIMIT",
      "0.01 lots is below broker minQuantity/AMOUNT — do not raise owner max or invent specs.",
    ));
  } else {
    rows.push(stage(
      "quantity",
      "Quantity compatibility (0.01 lots)",
      "NOT_VERIFIED",
      "CONTRACT_NOT_EVALUATED",
      "Broker TradingSettings not scored for 0.01 lots.",
    ));
  }

  if (input.marginVerified === true) {
    rows.push(stage("margin", "Margin verification", "PASS", "MARGIN_VERIFIED", "Margin checked against broker MMR."));
  } else {
    rows.push(stage(
      "margin",
      "Margin verification",
      input.marginVerified === false ? "BLOCKED" : "NOT_VERIFIED",
      input.marginVerified === false ? "MARGIN_INSUFFICIENT_OR_UNVERIFIED" : "MARGIN_NOT_VERIFIED",
      "Do not treat equity alone as margin proof.",
    ));
  }

  const execAuth = input.executionAuthorized === true
    && input.placesOrders === true
    && input.acceptsForExecution === true;
  if (execAuth) {
    rows.push(stage(
      "execution",
      "Order eligibility",
      "PASS",
      "DEMO_EXECUTION_AUTHORIZED",
      "All execution gates verified.",
    ));
  } else {
    rows.push(stage(
      "execution",
      "Order eligibility",
      "BLOCKED",
      "EXECUTION_FORBIDDEN",
      "Broker execution remains disabled (no grant / armed_execute / safety gates).",
    ));
  }

  return rows;
}
