/**
 * Phase 59.0 — Analysis decision + simulation draft → DemoOpenMarketRequest plan.
 * Pure / non-mutating. Does not call ForexConnect. Does not create grants.
 */
import { randomUUID } from "node:crypto";
import type { AtDecisionResult } from "../decision/types.js";
import type { AtSimDraftResult } from "../simulation-risk/types.js";
import { evaluateProtectiveGeometry } from "../broker-intent/protective-geometry.js";
import type { DemoOpenMarketRequest } from "../demo-execution/types.js";
import { mapProposedQuantityToLots } from "./map-lots.js";
import {
  AT_ORDER_EXECUTION_BANNER,
  AT_ORDER_EXECUTION_PHASE,
  AT_ORDER_EXECUTION_SCHEMA,
  type AtExecutionPlan,
  type AtExecutionRejection,
  type AtExecutionRiskAudit,
} from "./types.js";
import { validateDecisionForExecution } from "./validate-decision.js";

export interface PrepareDemoExecutionPlanInput {
  decision: AtDecisionResult | null | undefined;
  draft: AtSimDraftResult | null | undefined;
  grantId: string;
  grantActive: boolean;
  grantMaxLots: number;
  grantInstrumentAllowlist: string[];
  /** Selected AT environment — LIVE is always rejected for mutation plans. */
  environment: "DEMO" | "LIVE" | string | null;
  lotsOverride?: number | null;
  maxDecisionAgeMs?: number | null;
  nowMs?: number;
  /** When true (default), SL+TP required and geometry validated. */
  requireProtective?: boolean;
}

function rejectPlan(
  partial: Partial<AtExecutionPlan> & {
    rejections: AtExecutionRejection[];
    riskAudit: AtExecutionRiskAudit;
    status: "REJECTED" | "BLOCKED";
  },
): AtExecutionPlan {
  return {
    schemaVersion: AT_ORDER_EXECUTION_SCHEMA,
    phase: AT_ORDER_EXECUTION_PHASE,
    planId: partial.planId ?? randomUUID(),
    status: partial.status,
    createdAtUtc: partial.createdAtUtc ?? new Date().toISOString(),
    sourceDecisionId: partial.sourceDecisionId ?? null,
    sourceAnalysisId: partial.sourceAnalysisId ?? null,
    sourceDraftId: partial.sourceDraftId ?? null,
    instrument: partial.instrument ?? null,
    direction: partial.direction ?? null,
    entryPrice: partial.entryPrice ?? null,
    stopLoss: partial.stopLoss ?? null,
    takeProfit: partial.takeProfit ?? null,
    proposedQuantity: partial.proposedQuantity ?? null,
    lots: partial.lots ?? null,
    riskAudit: partial.riskAudit,
    demoRequest: null,
    rejections: partial.rejections,
    maySubmitDemoMutation: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    banner: AT_ORDER_EXECUTION_BANNER,
    note: partial.note ?? "Execution plan rejected — no broker request built.",
  };
}

function emptyRiskAudit(): AtExecutionRiskAudit {
  return {
    sourceDraftId: null,
    draftOverallStatus: null,
    proposedQuantity: null,
    proposedQuantityNote: null,
    lots: null,
    lotsMethod: null,
    grantMaxLots: null,
    clampedToGrant: false,
    estimatedStopLossRisk: null,
    rewardRiskRatio: null,
    entryPrice: null,
    stopLoss: null,
    takeProfit: null,
    quoteFresh: null,
    note: "",
  };
}

/**
 * Build an auditable DEMO open-market request from decision + validated sim draft.
 * Returns READY_FOR_DEMO_GRANT_SUBMISSION only when construction succeeds.
 * Caller must still pass DEMO readiness / mutation env / orchestrator gates to submit.
 */
export function prepareDemoExecutionPlan(
  input: PrepareDemoExecutionPlanInput,
): AtExecutionPlan {
  const planId = randomUUID();
  const createdAtUtc = new Date().toISOString();
  const rejections: AtExecutionRejection[] = [];
  const riskAudit = emptyRiskAudit();
  riskAudit.grantMaxLots = input.grantMaxLots;

  const env = String(input.environment || "").toUpperCase();
  if (env === "LIVE") {
    rejections.push({
      code: "LIVE_LOCKED",
      message: "LIVE environment is locked — Phase 59.0 builds DEMO plans only.",
    });
    return rejectPlan({
      planId,
      createdAtUtc,
      status: "REJECTED",
      rejections,
      riskAudit,
      note: "LIVE locked.",
    });
  }
  if (env && env !== "DEMO") {
    rejections.push({
      code: "ENVIRONMENT_UNSUPPORTED",
      message: `environment=${input.environment} — DEMO required for execution plans.`,
    });
  }

  if (!input.grantActive) {
    rejections.push({
      code: "NO_ACTIVE_DEMO_GRANT",
      message: "Active DEMO execution grant required to prepare a submission-ready plan.",
    });
  }
  const grantId = String(input.grantId || "").trim();
  if (!grantId) {
    rejections.push({
      code: "GRANT_ID_REQUIRED",
      message: "grantId is required.",
    });
  }

  const draft = input.draft;
  if (!draft) {
    rejections.push({
      code: "DRAFT_MISSING",
      message: "Simulation risk draft is required — levels and size are not invented.",
    });
    return rejectPlan({
      planId,
      createdAtUtc,
      status: "BLOCKED",
      rejections,
      riskAudit,
      sourceDecisionId: input.decision?.decisionId ?? null,
      note: "Missing simulation draft.",
    });
  }

  riskAudit.sourceDraftId = draft.draftId;
  riskAudit.draftOverallStatus = draft.overallStatus;
  riskAudit.proposedQuantity = draft.proposedQuantity;
  riskAudit.proposedQuantityNote = draft.proposedQuantityNote;
  riskAudit.entryPrice = draft.entryPrice;
  riskAudit.stopLoss = draft.stopLoss;
  riskAudit.takeProfit = draft.takeProfit;
  riskAudit.quoteFresh = draft.quoteSnapshot?.fresh
    ?? (draft.quoteFreshnessStatus === "PASS" ? true : draft.quoteFreshnessStatus === "FAIL" ? false : null);
  riskAudit.estimatedStopLossRisk = draft.rewardRiskAnalysis?.estimatedStopLossRisk ?? null;
  riskAudit.rewardRiskRatio = draft.rewardRiskAnalysis?.riskRewardRatio ?? null;

  if (draft.placesOrders !== false || draft.acceptsForExecution !== false) {
    rejections.push({
      code: "DRAFT_SAFETY_FLAGS_INVALID",
      message: "Draft must retain placesOrders=false and acceptsForExecution=false.",
    });
  }

  if (draft.overallStatus !== "VALIDATION_PASSED") {
    rejections.push({
      code: "DRAFT_NOT_VALIDATED",
      message: `draft.overallStatus=${draft.overallStatus} — require VALIDATION_PASSED.`,
    });
  }

  if (!draft.structuralOk) {
    rejections.push({
      code: "DRAFT_STRUCTURAL_FAIL",
      message: "Draft structuralOk=false.",
    });
  }

  const decisionCheck = validateDecisionForExecution({
    decision: input.decision,
    expectedInstrument: draft.instrument,
    maxDecisionAgeMs: input.maxDecisionAgeMs,
    nowMs: input.nowMs,
  });
  rejections.push(...decisionCheck.rejections);

  if (
    input.decision
    && draft.sourceDecisionId
    && input.decision.decisionId !== draft.sourceDecisionId
  ) {
    rejections.push({
      code: "DECISION_DRAFT_MISMATCH",
      message: "Draft sourceDecisionId does not match the provided decision.",
    });
  }

  const instrument = String(draft.instrument || "").trim();
  if (!instrument) {
    rejections.push({
      code: "INSTRUMENT_REQUIRED",
      message: "Draft instrument is required.",
    });
  }

  const allow = input.grantInstrumentAllowlist || [];
  if (
    allow.length > 0
    && instrument
    && !allow.some((a) => String(a).trim().toUpperCase() === instrument.toUpperCase())
  ) {
    rejections.push({
      code: "INSTRUMENT_NOT_IN_GRANT",
      message: `Instrument ${instrument} is not in the DEMO grant allowlist.`,
    });
  }

  const direction = decisionCheck.direction
    ?? (draft.direction === "BUY" || draft.direction === "SELL" ? draft.direction : null);

  if (direction !== "BUY" && direction !== "SELL") {
    if (!rejections.some((r) => r.code === "WAIT_OR_NO_TRADE")) {
      rejections.push({
        code: "WAIT_OR_NO_TRADE",
        message: "No BUY/SELL direction — WAIT/NO-TRADE never produces an order.",
      });
    }
  } else if (
    draft.direction
    && draft.direction !== direction
  ) {
    rejections.push({
      code: "DIRECTION_CONFLICT",
      message: `Decision direction ${direction} conflicts with draft direction ${draft.direction}.`,
    });
  }

  const entry = draft.entryPrice;
  const stopLoss = draft.stopLoss;
  const takeProfit = draft.takeProfit;
  const requireProtective = input.requireProtective !== false;

  if (requireProtective) {
    if (stopLoss == null || !Number.isFinite(stopLoss)) {
      rejections.push({
        code: "STOP_LOSS_REQUIRED",
        message: "Finite Stop Loss is required on the simulation draft.",
      });
    }
    if (takeProfit == null || !Number.isFinite(takeProfit)) {
      rejections.push({
        code: "TAKE_PROFIT_REQUIRED",
        message: "Finite Take Profit is required on the simulation draft.",
      });
    }
  }

  if (
    (direction === "BUY" || direction === "SELL")
    && entry != null
    && Number.isFinite(entry)
    && stopLoss != null
    && takeProfit != null
  ) {
    const geometry = evaluateProtectiveGeometry({
      direction,
      entryPrice: entry,
      stopLoss,
      takeProfit,
      requireProtective,
      requireThreeR: false,
    });
    if (!geometry.ok) {
      for (const r of geometry.rejections) {
        rejections.push({ code: r.code, message: r.message });
      }
    }
    if (geometry.rewardRisk != null) riskAudit.rewardRiskRatio = geometry.rewardRisk;
  }

  const lotsResult = mapProposedQuantityToLots({
    proposedQuantity: draft.proposedQuantity,
    grantMaxLots: input.grantMaxLots,
    lotsOverride: input.lotsOverride,
  });
  rejections.push(...lotsResult.rejections);
  riskAudit.lots = lotsResult.lots;
  riskAudit.lotsMethod = lotsResult.method;
  riskAudit.clampedToGrant = lotsResult.clampedToGrant;
  riskAudit.note = lotsResult.note;

  if (rejections.length > 0) {
    const status = rejections.some((r) =>
      r.code === "DRAFT_MISSING"
      || r.code === "PROPOSED_QUANTITY_MISSING"
      || r.code === "NO_ACTIVE_DEMO_GRANT"
    )
      ? "BLOCKED"
      : "REJECTED";
    return rejectPlan({
      planId,
      createdAtUtc,
      status,
      rejections,
      riskAudit,
      sourceDecisionId: input.decision?.decisionId ?? draft.sourceDecisionId,
      sourceAnalysisId: input.decision?.sourceAnalysisId ?? draft.sourceAnalysisId,
      sourceDraftId: draft.draftId,
      instrument,
      direction,
      entryPrice: entry,
      stopLoss,
      takeProfit,
      proposedQuantity: draft.proposedQuantity,
      lots: lotsResult.lots,
      note: `Plan ${status.toLowerCase()}: ${rejections.map((r) => r.code).join(",")}`,
    });
  }

  const decisionId = input.decision!.decisionId;
  const idempotencyKey = `at59_${decisionId}_${draft.draftId}`;

  const demoRequest: DemoOpenMarketRequest = {
    grantId,
    instrument,
    direction: direction as "BUY" | "SELL",
    lots: lotsResult.lots!,
    requireProtective: true,
    stopLoss: stopLoss!,
    takeProfit: takeProfit!,
    entryHint: entry,
    attachProtectiveAfterFill: true,
    // Must match evaluateUnprotectedFillPolicy: no autonomous close on unprotected fill.
    closeIfUnprotected: false,
    idempotencyKey,
    sourceDecisionId: decisionId,
    sourceAnalysisId: input.decision!.sourceAnalysisId,
    sourceDraftId: draft.draftId,
    sourcePlanId: planId,
  };

  return {
    schemaVersion: AT_ORDER_EXECUTION_SCHEMA,
    phase: AT_ORDER_EXECUTION_PHASE,
    planId,
    status: "READY_FOR_DEMO_GRANT_SUBMISSION",
    createdAtUtc,
    sourceDecisionId: decisionId,
    sourceAnalysisId: input.decision!.sourceAnalysisId,
    sourceDraftId: draft.draftId,
    instrument,
    direction: direction as "BUY" | "SELL",
    entryPrice: entry,
    stopLoss,
    takeProfit,
    proposedQuantity: draft.proposedQuantity,
    lots: lotsResult.lots,
    riskAudit,
    demoRequest,
    rejections: [],
    maySubmitDemoMutation: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    banner: AT_ORDER_EXECUTION_BANNER,
    note:
      "Plan ready for grant-scoped DEMO openMarket only. Prepare does not submit. "
      + "Global placesOrders remains false. Owner must authorize mutation env + call open-market separately.",
  };
}
