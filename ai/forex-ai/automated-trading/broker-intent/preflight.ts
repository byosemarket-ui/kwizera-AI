/**
 * Phase 57.0 — Pure broker-intent preflight (no mutation access).
 * Passing preflight never enables or invokes execution.
 */
import { isInstrumentAllowlisted } from "../simulation-risk/allowlist.js";
import { evaluateProtectiveGeometry } from "./protective-geometry.js";
import type {
  BrokerIntentLifecycleState,
  BrokerIntentRecord,
  BrokerIntentRejection,
  BrokerIntentRiskEnvelope,
} from "./types.js";
import { BROKER_INTENT_PHASE, BROKER_INTENT_SCHEMA } from "./types.js";
import type { AtBinaryDirection } from "../analysis/direction.js";

const MAX_SL_FRACTION = 0.25 as const;

export interface BrokerIntentPreflightInput {
  idempotencyKey: string;
  environment: "DEMO" | "LIVE";
  environmentVerified: boolean;
  accountIdMasked: string | null;
  accountStateVerified: boolean;
  instrument: string;
  direction: AtBinaryDirection | null;
  quantity: number | null;
  quantityUnit: string | null;
  quantityUnitAmbiguous: boolean;
  contractSizeVerified: boolean;
  pointSize: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  quoteFresh: boolean;
  quotePresent: boolean;
  strategyAllocationPercent: number | null;
  perOrderAllocation: number | null;
  estimatedSlLossAccount: number | null;
  sourceDraftId: string | null;
  sourceDecisionId: string | null;
  masterEnable: boolean;
  emergencyEntryLock: boolean;
  placesOrders: boolean;
  acceptsForExecution: boolean;
  forexConnectTradingEnabled: boolean;
  automaticEntryEnabled: boolean;
  automaticReentryEnabled: boolean;
  duplicateIdempotencyKey: boolean;
  exposureReconciliationRequired: boolean;
  protectionCapabilityVerified: boolean;
  ownerExecutionAuthorized: boolean;
  requireProtective: boolean;
  requireThreeR: boolean;
}

export interface BrokerIntentPreflightResult {
  intent: BrokerIntentRecord;
  preflightPassed: boolean;
  /** Always false — Phase 57.0 never authorizes submission. */
  maySubmitToBroker: false;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

function id(): string {
  return `bi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Evaluate a future DEMO broker intent. Always ends EXECUTION_DISABLED or BLOCKED.
 * Even when structural checks pass, global execution prohibition blocks submission.
 */
export function evaluateBrokerIntentPreflight(
  input: BrokerIntentPreflightInput,
): BrokerIntentPreflightResult {
  const rejections: BrokerIntentRejection[] = [];
  const ts = now();

  if (!String(input.idempotencyKey ?? "").trim()) {
    rejections.push({
      code: "IDEMPOTENCY_KEY_REQUIRED",
      message: "Idempotency key is required for durable intent deduplication.",
    });
  }
  if (input.duplicateIdempotencyKey) {
    rejections.push({
      code: "DUPLICATE_INTENT",
      message: "An intent with this idempotency key already exists.",
    });
  }

  // LIVE is always unauthorized in this phase (and beyond without separate review).
  if (input.environment === "LIVE") {
    rejections.push({
      code: "LIVE_EXECUTION_UNAUTHORIZED",
      message: "LIVE broker execution is unauthorized.",
    });
  }
  if (!input.environmentVerified || input.environment !== "DEMO") {
    rejections.push({
      code: "DEMO_ENVIRONMENT_UNVERIFIED",
      message: "DEMO environment identity is not independently verified.",
    });
  }
  if (!input.accountStateVerified) {
    rejections.push({
      code: "ACCOUNT_STATE_UNVERIFIED",
      message: "Account equity/state is not verified for risk preflight.",
    });
  }
  if (!isInstrumentAllowlisted(input.instrument)) {
    rejections.push({
      code: "INSTRUMENT_NOT_ALLOWED",
      message: `Instrument ${input.instrument || "(empty)"} is outside the XAU/USD allowlist.`,
    });
  }
  if (!input.contractSizeVerified) {
    rejections.push({
      code: "CONTRACT_SIZE_UNVERIFIED",
      message: "Contract size metadata is unverified — fail closed.",
    });
  }
  if (input.quantityUnitAmbiguous) {
    rejections.push({
      code: "QUANTITY_UNIT_AMBIGUOUS",
      message: "Quantity unit is ambiguous — fail closed.",
    });
  }
  if (input.quantity == null || !Number.isFinite(input.quantity) || !(input.quantity > 0)) {
    rejections.push({
      code: "QUANTITY_INVALID",
      message: "Quantity must be a finite positive number.",
    });
  }
  if (!input.quotePresent) {
    rejections.push({ code: "QUOTE_MISSING", message: "Quote is missing at preflight boundary." });
  } else if (!input.quoteFresh) {
    rejections.push({ code: "QUOTE_STALE", message: "Quote is stale at preflight boundary." });
  }

  const geometry = evaluateProtectiveGeometry({
    direction: input.direction,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    requireProtective: input.requireProtective,
    requireThreeR: input.requireThreeR,
  });
  rejections.push(...geometry.rejections);

  if (!input.protectionCapabilityVerified) {
    rejections.push({
      code: "PROTECTION_CAPABILITY_UNVERIFIED",
      message:
        "Broker-side protective-order capability is unverified — readiness blocked.",
    });
  }

  const alloc = input.perOrderAllocation;
  const slLoss = input.estimatedSlLossAccount;
  let allocationOk: boolean | null = null;
  let riskLimitOk: boolean | null = null;
  if (alloc != null && Number.isFinite(alloc) && alloc > 0) {
    allocationOk = true;
    if (slLoss != null && Number.isFinite(slLoss)) {
      riskLimitOk = slLoss <= alloc * MAX_SL_FRACTION;
      if (!riskLimitOk) {
        rejections.push({
          code: "RISK_LIMIT_EXCEEDED",
          message:
            "Estimated SL loss exceeds 25% of the individual order allocation.",
        });
      }
    }
  }

  // Safety locks — must remain enforced.
  if (input.masterEnable !== false) {
    rejections.push({
      code: "MASTER_TRADING_OFF_REQUIRED",
      message: "Master Trading must remain OFF.",
    });
  }
  if (input.emergencyEntryLock !== true) {
    rejections.push({
      code: "EMERGENCY_LOCK_ON_REQUIRED",
      message: "Emergency Entry Lock must remain ON.",
    });
  }
  if (input.placesOrders !== false || input.acceptsForExecution !== false) {
    rejections.push({
      code: "EXECUTION_FORBIDDEN",
      message: "placesOrders/acceptsForExecution must remain false.",
    });
  }
  if (input.forexConnectTradingEnabled) {
    rejections.push({
      code: "EXECUTION_FORBIDDEN",
      message: "ForexConnect trading must remain DISABLED.",
    });
  }
  if (input.automaticEntryEnabled || input.automaticReentryEnabled) {
    rejections.push({
      code: "EXECUTION_FORBIDDEN",
      message: "Automatic entry/re-entry must remain DISABLED.",
    });
  }
  if (input.exposureReconciliationRequired) {
    rejections.push({
      code: "BROKER_STATE_RECONCILIATION_REQUIRED",
      message: "Broker exposure reconciliation is required before any future execution.",
    });
  }
  if (!input.ownerExecutionAuthorized) {
    rejections.push({
      code: "AUTHORIZATION_REQUIRED",
      message: "Owner authorization for broker execution is not granted.",
    });
  }

  // Global hard block — always append even if structural checks somehow passed.
  rejections.push({
    code: "EXECUTION_FORBIDDEN",
    message:
      "Phase 57.0 — EXECUTION_FORBIDDEN. Preflight cannot authorize or invoke broker mutation.",
  });

  const structuralOk =
    geometry.ok
    && isInstrumentAllowlisted(input.instrument)
    && input.environment === "DEMO"
    && input.environmentVerified
    && input.accountStateVerified
    && input.contractSizeVerified
    && !input.quantityUnitAmbiguous
    && input.quoteFresh
    && input.quotePresent
    && input.protectionCapabilityVerified
    && !input.exposureReconciliationRequired
    && input.masterEnable === false
    && input.emergencyEntryLock === true
    && input.placesOrders === false
    && input.acceptsForExecution === false
    && !input.forexConnectTradingEnabled
    && !input.automaticEntryEnabled
    && !input.automaticReentryEnabled
    && !input.duplicateIdempotencyKey
    && Boolean(String(input.idempotencyKey ?? "").trim());

  // Ready for authorization only means "structurally prepared" — never submittable.
  const state: BrokerIntentLifecycleState = structuralOk
    ? "EXECUTION_DISABLED"
    : "BLOCKED";

  const risk: BrokerIntentRiskEnvelope = {
    strategyAllocationPercent: input.strategyAllocationPercent,
    perOrderAllocation: input.perOrderAllocation,
    estimatedSlLossAccount: input.estimatedSlLossAccount,
    maxSlLossFractionOfAllocation: MAX_SL_FRACTION,
    rewardRiskTarget: 3,
    allocationOk,
    riskLimitOk,
  };

  const intent: BrokerIntentRecord = {
    schemaVersion: BROKER_INTENT_SCHEMA,
    phase: BROKER_INTENT_PHASE,
    intentId: id(),
    idempotencyKey: String(input.idempotencyKey ?? "").trim(),
    createdAtUtc: ts,
    updatedAtUtc: ts,
    environment: input.environment,
    accountIdMasked: input.accountIdMasked,
    instrument: input.instrument,
    direction: input.direction,
    quantity: input.quantity,
    quantityUnit: input.quantityUnit,
    entryPrice: input.entryPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    contractSizeVerified: input.contractSizeVerified,
    pointSize: input.pointSize,
    sourceDraftId: input.sourceDraftId,
    sourceDecisionId: input.sourceDecisionId,
    risk,
    state,
    rejections,
    authorizationGranted: false,
    authorizationExpiresAtUtc: null,
    brokerOrderId: null,
    brokerDealId: null,
    brokerPositionId: null,
    protectiveStatus: geometry.protectiveStatus,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    intentOnly: true,
    executionDisabled: true,
    note:
      state === "EXECUTION_DISABLED"
        ? "Structurally prepared intent — EXECUTION_DISABLED. No broker order was submitted."
        : "Intent BLOCKED by preflight. No broker order was submitted.",
  };

  return {
    intent,
    preflightPassed: structuralOk,
    maySubmitToBroker: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}
