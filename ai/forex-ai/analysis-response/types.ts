/**
 * Phase 46 — Evidence-grounded guided analysis response contract.
 * Financial numbers always come from Phase 45 deterministic risk — never from AI prose.
 */

export const FOREX_GUIDED_ANALYSIS_SCHEMA = "forex-guided-analysis-response-v1";

export type FieldSupportLevel = "verified" | "estimated" | "unavailable" | "guidance_only";

export interface OrderTicketFieldGuidance {
  fieldId: string;
  label: string;
  proposedValue: string | null;
  support: FieldSupportLevel;
  why: string;
  verify: string;
  unavailableReason: string | null;
}

export interface OrderTicketGuidance {
  schemaVersion: "forex-order-ticket-guidance-v1";
  planKind: string;
  planId: string;
  readiness: "READY_FOR_REVIEW" | "WAIT_CONFIRMATION" | "BLOCKED" | "UNSUITABLE";
  readinessNote: string;
  fields: OrderTicketFieldGuidance[];
  disclaimer: string;
}

export interface GuidedMarketSummary {
  instrument: string | null;
  provider: string | null;
  snapshotId: string | null;
  dataQuality: string | null;
  marketCondition: string | null;
  conditionMeaning: string | null;
  conditionExplanation: string | null;
  decision: string | null;
  decisionRationale: string | null;
  confidenceDisplay: string | null;
}

export interface GuidedEvidenceSection {
  observedFacts: string[];
  supportingEvidence: string[];
  contradictingEvidence: string[];
  confirmationRequired: string[];
  invalidationConditions: string[];
  dataLimitations: string[];
  structureNotes: string[];
}

export interface GuidedFinalDecision {
  summary: string;
  nextAction: string;
  primaryInvalidation: string | null;
  keyFinancialRisk: string | null;
}

export interface GuidedAnalysisResponse {
  schemaVersion: typeof FOREX_GUIDED_ANALYSIS_SCHEMA;
  provider: string | null;
  model: string | null;
  marketSummary: GuidedMarketSummary;
  evidence: GuidedEvidenceSection;
  orderTicketByPlan: OrderTicketGuidance[];
  finalDecision: GuidedFinalDecision;
  tradeAllocation: {
    amount: number | null;
    currency: string | null;
    note: string;
  } | null;
}

export interface TradeAllocationInput {
  amount: number;
  currency: string;
}
