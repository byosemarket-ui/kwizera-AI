/**
 * Stage 1 — Spread/slippage policy readiness report (software + evidence gates).
 * Never marks STAGE_1_COMPLETE without owner-approved VERIFIED policies + evidence.
 */
import {
  ownerApprovalRequirements,
  type QuoteProvenanceLabel,
} from "./observation-evidence.js";
import { resolveSlippageLimit, resolveSpreadLimit } from "./resolve.js";
import {
  draftSpreadRecommendation,
  type SpreadRecommendationDraft,
} from "./spread-recommendation.js";
import {
  estimateForexMarketOpenUtc,
  stage1SpreadCollectionGate,
  summarizeInstrumentSpreadEvidence,
  type LiveSpreadObservationRecord,
} from "./spread-observation-collector.js";
import {
  SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION,
  getSlippageEvidenceCollectionWorkflow,
  summarizeSlippageEvidence,
  type SlippageFillEvidenceRecord,
} from "./slippage-evidence.js";
import {
  STAGE3_ACTIVE_INSTRUMENTS,
  STAGE3_TRACKED_INSTRUMENTS,
  getInstrumentPhaseStatus,
  isStage3ActiveInstrument,
  type InstrumentPhaseStatus,
  type Stage3TrackedInstrument,
} from "./types.js";
import { getAtRiskPolicyStore } from "./store.js";

export type Stage1InstrumentStatus =
  | "WAITING_FOR_LIVE_MARKET"
  | "WAITING_FOR_OWNER_APPROVAL"
  | "WAITING_FOR_CONTROLLED_DEMO_EVIDENCE"
  | "INSUFFICIENT_LIVE_EVIDENCE"
  | "NOT_CONFIGURED"
  | "OUT_OF_SCOPE"
  | "RESOLVED";

export interface Stage1InstrumentReport {
  instrument: Stage3TrackedInstrument;
  phaseStatus: InstrumentPhaseStatus;
  spreadPolicyStatus: string;
  slippagePolicyStatus: string;
  spreadEvidence: ReturnType<typeof summarizeInstrumentSpreadEvidence>;
  slippageEvidence: ReturnType<typeof summarizeSlippageEvidence>;
  spreadRecommendation: SpreadRecommendationDraft | null;
  overall: Stage1InstrumentStatus;
  staleXau030Rejected: true;
}

export interface Stage1ReadinessReport {
  stage: "STAGE_1_SPREAD_SLIPPAGE_POLICY";
  stageComplete: false | true;
  completionCode: "STAGE_1_COMPLETE" | "NOT_RESOLVED";
  activePhase: {
    module: "KWIZERA_AI_STUDIO_FOREX_AUTOMATED_TRADING";
    activeInstruments: readonly string[];
    trackedCatalog: readonly string[];
    note: string;
  };
  marketGate: ReturnType<typeof stage1SpreadCollectionGate>;
  ownerApproval: ReturnType<typeof ownerApprovalRequirements>;
  slippageWorkflow: ReturnType<typeof getSlippageEvidenceCollectionWorkflow>;
  instruments: Stage1InstrumentReport[];
  tradingSafety: {
    placesOrders: false;
    mutatesBroker: false;
    mayApproveOnBehalfOfOwner: false;
    mayFabricateLiveObservations: false;
    mayInventThresholds: false;
  };
  note: string;
}

function overallFor(inst: Stage1InstrumentReport, marketOpen: boolean): Stage1InstrumentStatus {
  if (inst.phaseStatus === "OUT_OF_SCOPE") return "OUT_OF_SCOPE";
  if (inst.spreadPolicyStatus === "VERIFIED" && inst.slippagePolicyStatus === "VERIFIED") {
    return "RESOLVED";
  }
  if (!marketOpen) return "WAITING_FOR_LIVE_MARKET";
  if (inst.slippageEvidence.status === SLIPPAGE_EVIDENCE_REQUIRES_CONTROLLED_DEMO_EXECUTION) {
    // Spread may still need live samples / owner approval
    if (inst.spreadPolicyStatus !== "VERIFIED") {
      if (!inst.spreadEvidence.sufficientForRecommendation) return "INSUFFICIENT_LIVE_EVIDENCE";
      return "WAITING_FOR_OWNER_APPROVAL";
    }
    return "WAITING_FOR_CONTROLLED_DEMO_EVIDENCE";
  }
  if (inst.spreadPolicyStatus !== "VERIFIED") {
    if (!inst.spreadEvidence.sufficientForRecommendation) return "INSUFFICIENT_LIVE_EVIDENCE";
    return "WAITING_FOR_OWNER_APPROVAL";
  }
  if (inst.slippagePolicyStatus !== "VERIFIED") {
    return "WAITING_FOR_OWNER_APPROVAL";
  }
  return "NOT_CONFIGURED";
}

export function buildStage1ReadinessReport(input?: {
  nowMs?: number;
  marketOpen?: boolean | null;
  acceptedSpreadByInstrument?: Partial<Record<Stage3TrackedInstrument, LiveSpreadObservationRecord[]>>;
  slippageFillsByInstrument?: Partial<Record<string, SlippageFillEvidenceRecord[]>>;
  store?: { getInstrument: (instrument: string | null | undefined) => ReturnType<ReturnType<typeof getAtRiskPolicyStore>["getInstrument"]> };
}): Stage1ReadinessReport {
  const nowMs = input?.nowMs ?? Date.now();
  const marketOpen = input?.marketOpen ?? estimateForexMarketOpenUtc(nowMs);
  const marketGate = stage1SpreadCollectionGate(nowMs);
  const store = input?.store ?? getAtRiskPolicyStore();

  const instruments: Stage1InstrumentReport[] = STAGE3_TRACKED_INSTRUMENTS.map((instrument) => {
    const phaseStatus = getInstrumentPhaseStatus(instrument);
    const spread = resolveSpreadLimit({ instrument, store });
    const slip = resolveSlippageLimit({ instrument, store });
    const accepted = input?.acceptedSpreadByInstrument?.[instrument] ?? [];
    const spreadEvidence = summarizeInstrumentSpreadEvidence({
      instrument,
      accepted,
      marketOpen,
      policyStatus: spread.status === "VERIFIED" ? "APPROVED" : "NOT_CONFIGURED",
    });
    const slippageEvidence = summarizeSlippageEvidence({
      instrument,
      productionFills: input?.slippageFillsByInstrument?.[instrument] ?? [],
    });
    const spreadRecommendation = phaseStatus === "ACTIVE" && accepted.length > 0
      ? draftSpreadRecommendation({ instrument, acceptedLive: accepted })
      : null;

    const report: Stage1InstrumentReport = {
      instrument,
      phaseStatus,
      spreadPolicyStatus: spread.status,
      slippagePolicyStatus: slip.status,
      spreadEvidence,
      slippageEvidence,
      spreadRecommendation,
      overall: "NOT_CONFIGURED",
      staleXau030Rejected: true,
    };
    report.overall = overallFor(report, marketOpen === true);
    if (phaseStatus === "ACTIVE" && marketOpen === false) {
      report.overall = "WAITING_FOR_LIVE_MARKET";
    }
    return report;
  });

  const activeInstruments = instruments.filter((i) => isStage3ActiveInstrument(i.instrument));
  const activeResolved = activeInstruments.length > 0
    && activeInstruments.every((i) => i.overall === "RESOLVED");
  return {
    stage: "STAGE_1_SPREAD_SLIPPAGE_POLICY",
    stageComplete: activeResolved,
    completionCode: activeResolved ? "STAGE_1_COMPLETE" : "NOT_RESOLVED",
    activePhase: {
      module: "KWIZERA_AI_STUDIO_FOREX_AUTOMATED_TRADING",
      activeInstruments: [...STAGE3_ACTIVE_INSTRUMENTS],
      trackedCatalog: [...STAGE3_TRACKED_INSTRUMENTS],
      note:
        "XAU/USD is the only ACTIVE Automated Trading instrument this phase. "
        + "EUR/USD, GBP/USD, and USD/JPY remain in the tracked catalog as OUT_OF_SCOPE "
        + "(not deleted; excluded from active Stage 1 completion and AT workflow).",
    },
    marketGate: marketOpen === false
      ? { ...marketGate, collectionStatus: "WAITING_FOR_LIVE_MARKET", code: "WAITING_FOR_LIVE_MARKET", marketLikelyOpen: false }
      : marketGate,
    ownerApproval: ownerApprovalRequirements(),
    slippageWorkflow: getSlippageEvidenceCollectionWorkflow(),
    instruments,
    tradingSafety: {
      placesOrders: false,
      mutatesBroker: false,
      mayApproveOnBehalfOfOwner: false,
      mayFabricateLiveObservations: false,
      mayInventThresholds: false,
    },
    note:
      "Stage 1 complete for this phase only when ACTIVE instruments (XAU/USD) have VERIFIED "
      + "spread + slippage policies backed by valid evidence and owner approve+confirm. "
      + "OUT_OF_SCOPE instruments do not block phase completion. Cached XAU 0.30 is rejected.",
  };
}

/** Explicit rejection of the known stale XAU observation as policy input. */
export function rejectStaleXau030AsPolicyEvidence(): {
  accepted: false;
  provenance: QuoteProvenanceLabel;
  code: "NON_LIVE_OBSERVATION";
  mayUseAsThreshold: false;
  message: string;
} {
  return {
    accepted: false,
    provenance: "CACHED",
    code: "NON_LIVE_OBSERVATION",
    mayUseAsThreshold: false,
    message:
      "XAU/USD spread 0.30 observed while market closed (CACHED/STALE) is not LIVE evidence "
      + "and must not be used as a recommendation or approved threshold.",
  };
}
