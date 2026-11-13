/**
 * Phase 3 — Server-side FXCM payload validation from trusted records.
 * Never trusts frontend payloads. Never submits orders.
 */
import { randomUUID } from "node:crypto";
import type { FxcmTrueMarketOpenPayload } from "../demo-submission-adapter/types.js";
import { redactFxcmPayloadForAudit } from "../demo-submission-adapter/fxcm-payload.js";
import type { AtOrderProposalRecord } from "../order-proposal/types.js";

export const AT_PHASE3_PAYLOAD_SCHEMA = "at-phase3-broker-payload-v1" as const;

export type Phase3PayloadBlockCode =
  | "PAYLOAD_SCHEMA_INVALID"
  | "INSTRUMENT_MISMATCH"
  | "BROKER_METADATA_MISSING"
  | "BROKER_METADATA_STALE"
  | "INVALID_QUANTITY"
  | "QUANTITY_STEP_MISMATCH"
  | "RISK_BUDGET_EXCEEDED"
  | "INVALID_STOP_LOSS"
  | "INVALID_TAKE_PROFIT"
  | "QUOTE_STALE"
  | "PRECHECK_EXPIRED"
  | "PRECHECK_FAILED"
  | "PRECHECK_MISSING"
  | "PROPOSAL_SUPERSEDED"
  | "PROPOSAL_MISSING"
  | "PROPOSAL_MISMATCH"
  | "DUPLICATE_HANDOFF"
  | "DIRECTION_MISMATCH"
  | "INVALID_AMOUNT"
  | "AMOUNT_BELOW_MIN_QUANTITY"
  | "BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT"
  | "OFFER_ID_MISSING"
  | "EXECUTION_DISABLED"
  | "UNKNOWN_FIELD";

export interface Phase3PayloadPackage {
  schemaVersion: typeof AT_PHASE3_PAYLOAD_SCHEMA;
  payloadId: string;
  idempotencyKey: string;
  analysisId: string | null;
  intakeId: string | null;
  proposalId: string;
  riskDecisionId: string | null;
  handoffId: string | null;
  precheckId: string;
  instrument: string;
  direction: "BUY" | "SELL";
  offerId: string | null;
  quantityLots: number;
  amount: number;
  quantityUnit: "FXCM_AMOUNT";
  entry: number | null;
  stopLoss: number;
  takeProfit: number;
  baseUnitSize: number | null;
  quantityMin: number | null;
  quantityStep: number | null;
  contractSource: string | null;
  quoteBid: number | null;
  quoteAsk: number | null;
  quoteFresh: boolean;
  fxcmPayloadRedacted: Record<string, unknown>;
  fxcmPayload: FxcmTrueMarketOpenPayload;
  validationStatus: "PAYLOAD_VALIDATED" | "PAYLOAD_INVALID";
  blockers: Phase3PayloadBlockCode[];
  createdAtUtc: string;
  expiresAtUtc: string;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
  note: string;
}

export interface ValidatePhase3PayloadInput {
  proposal: AtOrderProposalRecord | null | undefined;
  payload: FxcmTrueMarketOpenPayload | null | undefined;
  precheckId: string | null | undefined;
  precheckStatus: string | null | undefined;
  precheckExpiresAtUtc?: string | null;
  precheckPassedDomain?: boolean | null;
  handoffId?: string | null;
  analysisId?: string | null;
  intakeId?: string | null;
  riskDecisionId?: string | null;
  offerId?: string | null;
  baseUnitSize?: number | null;
  quantityMin?: number | null;
  quantityStep?: number | null;
  contractSource?: string | null;
  contractFresh?: boolean | null;
  quoteBid?: number | null;
  quoteAsk?: number | null;
  quoteFresh?: boolean | null;
  individualOrderAllocation?: number | null;
  modeledMaxLoss?: number | null;
  maxLossFractionOfAllocation?: number;
  idempotencyKey?: string | null;
  nowMs?: number;
  ttlMs?: number;
}

function finitePositive(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/**
 * Validate a constructed FXCM payload against trusted proposal + precheck linkage.
 */
export function validatePhase3PayloadPackage(
  input: ValidatePhase3PayloadInput,
): Phase3PayloadPackage {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const ttlMs = input.ttlMs ?? 60_000;
  const blockers: Phase3PayloadBlockCode[] = [];
  const proposal = input.proposal ?? null;
  const payload = input.payload ?? null;

  if (!input.precheckId) blockers.push("PRECHECK_MISSING");
  const preStatus = String(input.precheckStatus ?? "").toUpperCase();
  if (input.precheckPassedDomain === false || /BLOCK|FAIL|INCOMPLETE|REJECT/i.test(preStatus)) {
    blockers.push("PRECHECK_FAILED");
  }
  if (input.precheckExpiresAtUtc) {
    const exp = Date.parse(input.precheckExpiresAtUtc);
    if (Number.isFinite(exp) && nowMs > exp) blockers.push("PRECHECK_EXPIRED");
  }

  if (!proposal) blockers.push("PROPOSAL_MISSING");
  else if (
    proposal.lifecycle === "REJECTED"
    || proposal.lifecycle === "SUPERSEDED"
    || proposal.lifecycle === "EXPIRED"
  ) {
    blockers.push("PROPOSAL_SUPERSEDED");
  }

  if (!payload) {
    blockers.push("PAYLOAD_SCHEMA_INVALID");
  } else {
    if (payload.orderTypeConstant !== "TRUE_MARKET_OPEN") blockers.push("PAYLOAD_SCHEMA_INVALID");
    if (payload.buySell !== "BUY" && payload.buySell !== "SELL") blockers.push("PAYLOAD_SCHEMA_INVALID");
    if (!finitePositive(payload.amount) || !Number.isInteger(payload.amount)) {
      blockers.push("INVALID_AMOUNT");
    }
    if (!finitePositive(payload.lots)) blockers.push("INVALID_QUANTITY");
    if (!finitePositive(payload.rateStop)) blockers.push("INVALID_STOP_LOSS");
    if (!finitePositive(payload.rateLimit)) blockers.push("INVALID_TAKE_PROFIT");
    if (payload.protectionIncomplete) blockers.push("INVALID_STOP_LOSS");
  }

  if (proposal && payload) {
    if (proposal.direction !== payload.buySell) blockers.push("DIRECTION_MISMATCH");
    const inst = String(proposal.instrument || "").trim().toUpperCase();
    const sym = String(payload.symbol || "").trim().toUpperCase();
    if (inst && sym && inst.replace(/[^A-Z0-9]/g, "") !== sym.replace(/[^A-Z0-9]/g, "")) {
      blockers.push("INSTRUMENT_MISMATCH");
    }
    const expectedLots = proposal.quantity.normalizedQuantity ?? proposal.quantity.calculatedQuantity;
    if (finitePositive(expectedLots) && Math.abs(expectedLots - payload.lots) > 1e-9) {
      blockers.push("INVALID_QUANTITY");
    }
    if (finitePositive(proposal.pricePlan.stopLoss) && Math.abs(proposal.pricePlan.stopLoss - (payload.rateStop ?? 0)) > 1e-8) {
      blockers.push("INVALID_STOP_LOSS");
    }
    if (finitePositive(proposal.pricePlan.takeProfit) && Math.abs(proposal.pricePlan.takeProfit - (payload.rateLimit ?? 0)) > 1e-8) {
      blockers.push("INVALID_TAKE_PROFIT");
    }
  }

  const offerId = input.offerId ?? payload?.offerId ?? null;
  if (!offerId) blockers.push("OFFER_ID_MISSING");

  if (input.contractFresh === false) blockers.push("BROKER_METADATA_STALE");
  if (!finitePositive(input.baseUnitSize) && !finitePositive(payload?.lots && input.baseUnitSize)) {
    if (!finitePositive(input.baseUnitSize)) blockers.push("BROKER_METADATA_MISSING");
  }

  // quantityMin / quantityStep are FXCM AMOUNT (contract) units — never compare to lots.
  const step = input.quantityStep;
  if (finitePositive(step) && payload && Number.isFinite(payload.amount)) {
    const units = payload.amount / step;
    if (Math.abs(units - Math.round(units)) > 1e-9) blockers.push("QUANTITY_STEP_MISMATCH");
  }
  const minQ = input.quantityMin;
  if (finitePositive(minQ) && payload && Number.isFinite(payload.amount) && payload.amount + 1e-12 < minQ) {
    blockers.push("AMOUNT_BELOW_MIN_QUANTITY");
    blockers.push("INVALID_QUANTITY");
    // Owner-sized lots that cannot meet broker AMOUNT minimum (e.g. XAU baseUnitSize=1, min=1, lots=0.01).
    if (finitePositive(payload.lots) && finitePositive(input.baseUnitSize)) {
      const minLots = minQ / Number(input.baseUnitSize);
      if (payload.lots + 1e-12 < minLots) {
        blockers.push("BROKER_MINIMUM_EXCEEDS_OWNER_LIMIT");
      }
    }
  }

  if (input.quoteFresh === false) blockers.push("QUOTE_STALE");

  const alloc = input.individualOrderAllocation;
  const maxLoss = input.modeledMaxLoss;
  const frac = input.maxLossFractionOfAllocation ?? 0.25;
  if (finitePositive(alloc) && finitePositive(maxLoss) && maxLoss > alloc * frac + 1e-9) {
    blockers.push("RISK_BUDGET_EXCEEDED");
  }

  // Always stamp execution disabled — Phase 3 never authorizes submit.
  blockers.push("EXECUTION_DISABLED");

  const unique = Array.from(new Set(blockers));
  // EXECUTION_DISABLED is expected informational for Phase 3 package; payload can still be VALIDATED
  // for handoff-to-boundary if the only blocker is EXECUTION_DISABLED (+ optional quote soft flags handled above).
  const hard = unique.filter((b) => b !== "EXECUTION_DISABLED");
  const validated = hard.length === 0 && Boolean(payload) && Boolean(proposal);

  const direction =
    (payload?.buySell === "BUY" || payload?.buySell === "SELL"
      ? payload.buySell
      : proposal?.direction === "BUY" || proposal?.direction === "SELL"
        ? proposal.direction
        : "BUY") as "BUY" | "SELL";

  const idem =
    String(input.idempotencyKey || "").trim()
    || `phase3:${input.precheckId || "none"}:${proposal?.proposalId || "none"}`;

  return {
    schemaVersion: AT_PHASE3_PAYLOAD_SCHEMA,
    payloadId: randomUUID(),
    idempotencyKey: idem,
    analysisId: input.analysisId ?? null,
    intakeId: input.intakeId ?? null,
    proposalId: proposal?.proposalId ?? "missing",
    riskDecisionId: input.riskDecisionId ?? null,
    handoffId: input.handoffId ?? null,
    precheckId: String(input.precheckId || "missing"),
    instrument: String(proposal?.instrument || payload?.symbol || ""),
    direction,
    offerId: offerId != null ? String(offerId) : null,
    quantityLots: payload?.lots ?? 0,
    amount: payload?.amount ?? 0,
    quantityUnit: "FXCM_AMOUNT",
    entry: payload?.plannedEntryPrice ?? proposal?.pricePlan.entryPrice ?? null,
    stopLoss: payload?.rateStop ?? proposal?.pricePlan.stopLoss ?? 0,
    takeProfit: payload?.rateLimit ?? proposal?.pricePlan.takeProfit ?? 0,
    baseUnitSize: input.baseUnitSize ?? null,
    quantityMin: input.quantityMin ?? null,
    quantityStep: input.quantityStep ?? null,
    contractSource: input.contractSource ?? null,
    quoteBid: input.quoteBid ?? payload?.executableBid ?? null,
    quoteAsk: input.quoteAsk ?? payload?.executableAsk ?? null,
    quoteFresh: input.quoteFresh !== false,
    fxcmPayloadRedacted: payload ? redactFxcmPayloadForAudit(payload) : {},
    fxcmPayload: payload as FxcmTrueMarketOpenPayload,
    validationStatus: validated ? "PAYLOAD_VALIDATED" : "PAYLOAD_INVALID",
    blockers: unique,
    createdAtUtc: nowIso,
    expiresAtUtc: new Date(nowMs + ttlMs).toISOString(),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note: validated
      ? "Phase 3 FXCM payload validated server-side. EXECUTION_DISABLED — boundary will block submission."
      : `Phase 3 payload invalid: ${hard.join(", ") || "unknown"}.`,
  };
}
