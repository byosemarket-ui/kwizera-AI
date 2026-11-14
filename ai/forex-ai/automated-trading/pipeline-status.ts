/**
 * Phase 4.11 — Operator-facing automated-trading pipeline status.
 *
 * Separates safe monitoring from broker execution. Never authorizes orders.
 * Quantity/margin conclusions must come from broker-backed contract scoring
 * (Phase 4.10); this module only labels them for the dashboard.
 */
import {
  scoreInstrumentFor001Lots,
  type DiscoverableInstrumentRow,
  type Instrument001LotScore,
} from "./order-execution/discover-001-lot-instruments.js";

export type AtPipelinePhase =
  | "OFF"
  | "DATA_CONNECTING"
  | "MONITORING"
  | "ANALYZING"
  | "SIGNAL_DETECTED"
  | "RISK_BLOCKED"
  | "EXECUTION_READY"
  | "EXECUTION_BLOCKED"
  | "ORDER_SUBMITTED"
  | "ORDER_ACCEPTED"
  | "PARTIALLY_FILLED"
  | "FILLED"
  | "POSITION_MONITORING"
  | "EXIT_PENDING"
  | "CLOSED"
  | "RECOVERY_REQUIRED"
  | "MARKET_CLOSED";

export interface AtPipelineStatusInput {
  automationLifecycle?: string | null;
  automationReasonCode?: string | null;
  recoveryStatus?: string | null;
  quoteFresh?: boolean | null;
  quoteFreshnessReasonCode?: string | null;
  feedStatus?: string | null;
  marketSession?: string | null;
  instrumentConfigured?: boolean | null;
  brokerConnected?: boolean | null;
  placesOrders?: boolean | null;
  acceptsForExecution?: boolean | null;
  /** Live or mock instrument row for 0.01-lot scoring (null = not evaluated). */
  instrumentContract?: DiscoverableInstrumentRow | null;
  /** When true, instrumentContract came from live broker RO. */
  instrumentContractLive?: boolean;
  nowMs?: number;
}

export interface AtPipelineStatus {
  phase: AtPipelinePhase;
  label: string;
  monitoringAllowed: boolean;
  executionAllowed: false;
  placesOrders: false;
  acceptsForExecution: false;
  /** Null — no fixed owner lot cap; quantity is risk-sized per proposal. */
  ownerMaxLots: null;
  quantityCompatibility: Instrument001LotScore | null;
  blockers: string[];
  remediation: string[];
  note: string;
}

function isMarketClosedSignal(input: AtPipelineStatusInput): boolean {
  const feed = String(input.feedStatus ?? "").toUpperCase();
  const session = String(input.marketSession ?? "").toUpperCase();
  const reason = String(input.quoteFreshnessReasonCode ?? "").toUpperCase();
  if (feed === "MARKET_INACTIVE" || feed === "MARKET_CLOSED") return true;
  if (session === "CLOSED" || session === "MARKET_CLOSED") return true;
  if (reason === "MARKET_INACTIVE" || reason === "MARKET_CLOSED") return true;
  return false;
}

/**
 * Derive honest pipeline status for START AUTO / dashboard.
 * Execution is always false at this product surface (grant-scoped DEMO path is separate).
 */
export function deriveAtPipelineStatus(input: AtPipelineStatusInput = {}): AtPipelineStatus {
  const blockers: string[] = [];
  const remediation: string[] = [];
  const placesOrders = false as const;
  const acceptsForExecution = false as const;
  const executionAllowed = false as const;

  let quantityCompatibility: Instrument001LotScore | null = null;
  if (input.instrumentContract) {
    const row: DiscoverableInstrumentRow = {
      ...input.instrumentContract,
      evidenceSource: input.instrumentContractLive
        ? "live_broker"
        : (input.instrumentContract.evidenceSource ?? "inferred"),
    };
    // Dynamic sizing: evaluate the broker's own minimum quantity (no fixed owner lot cap).
    const minLots =
      typeof row.minQuantity === "number" && typeof row.baseUnitSize === "number"
      && row.minQuantity > 0 && row.baseUnitSize > 0
        ? row.minQuantity / row.baseUnitSize
        : null;
    if (minLots == null) {
      blockers.push("BROKER_METADATA_UNAVAILABLE");
      remediation.push("Live broker minQuantity/baseUnitSize unavailable — refresh TradingSettings; quantity is not invented.");
    } else {
      quantityCompatibility = scoreInstrumentFor001Lots(row, minLots);
      if (!quantityCompatibility.compatible001Lot) {
        blockers.push(...quantityCompatibility.blockers.slice(0, 8));
        remediation.push(
          `Broker minimum ${minLots} lots does not form a valid AMOUNT/margin under live metadata — sizing blocked.`,
        );
      }
    }
  } else {
    blockers.push("INSTRUMENT_CONTRACT_NOT_EVALUATED");
    remediation.push("Select an instrument and refresh live TradingSettings before expecting execution readiness.");
  }

  // Global AT page never arms broker execution.
  blockers.push("GLOBAL_AT_EXECUTION_DISABLED");
  remediation.push(
    "START AUTO enables monitoring/analysis only. Broker submit requires a separate DEMO grant path after all safety gates pass.",
  );

  if (input.placesOrders === true || input.acceptsForExecution === true) {
    blockers.push("UNEXPECTED_EXECUTION_FLAGS");
  }

  let phase: AtPipelinePhase = "OFF";
  const life = String(input.automationLifecycle ?? "OFF").toUpperCase();
  const recovery = String(input.recoveryStatus ?? "").toUpperCase();

  if (recovery === "AMBIGUOUS_RECOVERY" || recovery === "RECOVERY_BLOCKED") {
    phase = "RECOVERY_REQUIRED";
  } else if (isMarketClosedSignal(input)) {
    phase = "MARKET_CLOSED";
    remediation.push("Market appears inactive/closed — do not treat stale quotes as LIVE; monitoring may wait safely.");
  } else if (!input.instrumentConfigured) {
    phase = "OFF";
    blockers.push("INSTRUMENT_NOT_CONFIGURED");
    remediation.push("Select a market/instrument in the Forex shell before START AUTO.");
  } else if (input.brokerConnected === false) {
    phase = "DATA_CONNECTING";
    remediation.push("Wait for ForexConnect DEMO CONNECTED, then Refresh/Verify.");
  } else if (life === "MONITORING") {
    phase = quantityCompatibility && !quantityCompatibility.compatible001Lot
      ? "EXECUTION_BLOCKED"
      : "MONITORING";
  } else if (life === "BLOCKED" || life === "ERROR") {
    phase = isMarketClosedSignal(input) ? "MARKET_CLOSED" : "RISK_BLOCKED";
  } else if (life === "STARTING") {
    phase = "DATA_CONNECTING";
  } else {
    phase = "OFF";
  }

  // Execution never READY on this surface while 0.01 incompatible or global flags false.
  if (phase === "EXECUTION_READY") {
    phase = "EXECUTION_BLOCKED";
  }

  const label = (() => {
    switch (phase) {
      case "MARKET_CLOSED":
        return "MARKET CLOSED — monitoring wait / no executable entries";
      case "MONITORING":
        return "MONITORING — analysis only; broker execution disabled";
      case "EXECUTION_BLOCKED":
        return "EXECUTION BLOCKED — quantity/margin or authorization gates";
      case "RECOVERY_REQUIRED":
        return "RECOVERY REQUIRED — resolve automation/monitor alignment";
      case "DATA_CONNECTING":
        return "DATA CONNECTING — waiting for DEMO feed/session";
      case "RISK_BLOCKED":
        return "RISK / READINESS BLOCKED — see reason codes";
      default:
        return "OFF — START AUTO for monitoring when prerequisites pass";
    }
  })();

  return {
    phase,
    label,
    monitoringAllowed: phase === "MONITORING" || phase === "MARKET_CLOSED" || phase === "EXECUTION_BLOCKED",
    executionAllowed,
    placesOrders,
    acceptsForExecution,
    ownerMaxLots: null,
    quantityCompatibility,
    blockers: [...new Set(blockers)],
    remediation: [...new Set(remediation)],
    note:
      "Pipeline labels are observational. DEMO order submission remains blocked until owner 0.01-lot compatibility, margin, grants, and armed_execute gates all pass.",
  };
}
