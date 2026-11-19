/**
 * Phase 5D.6 — Support/Resistance from confirmed structure zones.
 * Reuses buildStructureZones. Does not invent institutional order blocks.
 */
import { createHash } from "node:crypto";
import { DEFAULT_STRUCTURE_PARAMS, mergeStructureParams } from "../../../../../forex-structure/params.js";
import { detectSwings } from "../../../../../forex-structure/swings.js";
import { buildStructureZones } from "../../../../../forex-structure/zones.js";
import type { StructureRuleParams } from "../../../../../forex-structure/types.js";
import type { MifCanonicalCandle } from "../../canonical/candle.js";
import type { MifCanonicalInstrument } from "../../canonical/instrument.js";
import { MIF_PROVIDER_ID } from "../../canonical/types.js";
import { stableSerialize } from "../../quality/stable-identity.js";
import type { MifStep1DataIntegrityAssessment } from "../../quality/types.js";
import { mifCandlesToStructureCandles } from "../adapter/mif-to-structure-candle.js";
import {
  evaluateMifAnalyticalQualityGate,
  type MifQualityGateSource,
} from "../quality/assessment-quality-gate.js";
import type { MifMarketStructureAssessment } from "../market-structure/types.js";
import {
  MIF_SUPPORT_RESISTANCE_CONTRACT_ID,
  MIF_SUPPORT_RESISTANCE_CONTRACT_VERSION,
  MIF_SUPPORT_RESISTANCE_ENGINE_ID,
  MIF_SUPPORT_RESISTANCE_ENGINE_VERSION,
  MIF_SUPPORT_RESISTANCE_POLICY_ID,
  MIF_SUPPORT_RESISTANCE_POLICY_VERSION,
} from "./contracts.js";
import type {
  MifBoundaryLevel,
  MifSupportResistanceAssessment,
  MifSupportResistanceStatus,
} from "./types.js";

export interface AssessMifSupportResistanceInput {
  candles: readonly MifCanonicalCandle[];
  providerSymbol: string;
  timeframe: string;
  instrument?: MifCanonicalInstrument | null;
  quality:
    | { kind: "step1-data-integrity"; assessment: MifStep1DataIntegrityAssessment }
    | null;
  /** Optional prior structure assessment — referenced, not mutated. */
  marketStructure?: MifMarketStructureAssessment | null;
  structureParams?: Partial<StructureRuleParams>;
  assessmentTimestamp?: string;
  assessmentId?: string;
}

function idHash(parts: Record<string, unknown>): string {
  return createHash("sha256").update(stableSerialize(parts)).digest("hex");
}

export function assessMifSupportResistance(
  input: AssessMifSupportResistanceInput,
): MifSupportResistanceAssessment {
  const providerSymbol = String(input.providerSymbol || "").trim().toUpperCase();
  const timeframe = String(input.timeframe || "").trim().toUpperCase();
  const assessmentTimestamp = input.assessmentTimestamp ?? new Date().toISOString();
  const params = mergeStructureParams(input.structureParams ?? DEFAULT_STRUCTURE_PARAMS);
  const instrument = input.instrument ?? null;

  const gate = evaluateMifAnalyticalQualityGate({
    quality: input.quality as MifQualityGateSource | null,
    allowedStatusesForConfirmedAnchors: ["VALID", "WARNING"],
  });
  const qualityRef = {
    sourceKind: gate.sourceKind,
    status: gate.qualityStatus,
    inputIdentity: gate.qualityInputIdentity,
    assessmentId: gate.qualityAssessmentId,
  };

  const empty = (
    status: MifSupportResistanceStatus,
    reason: string,
  ): MifSupportResistanceAssessment => {
    const id = idHash({ providerSymbol, timeframe, status, reason });
    return {
      contractId: MIF_SUPPORT_RESISTANCE_CONTRACT_ID,
      contractVersion: MIF_SUPPORT_RESISTANCE_CONTRACT_VERSION,
      scope: "phase5d6-support-resistance",
      assessmentId: input.assessmentId ?? `sr:${id.slice(0, 16)}`,
      inputIdentity: id,
      providerId: MIF_PROVIDER_ID,
      providerSymbol,
      timeframe,
      instrument,
      policyId: MIF_SUPPORT_RESISTANCE_POLICY_ID,
      policyVersion: MIF_SUPPORT_RESISTANCE_POLICY_VERSION,
      engineId: MIF_SUPPORT_RESISTANCE_ENGINE_ID,
      engineVersion: MIF_SUPPORT_RESISTANCE_ENGINE_VERSION,
      assessmentTimestamp,
      status,
      boundaries: [],
      primaryBoundary: null,
      qualityRef,
      diagnosticsSummary: reason,
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      analyticalBoundaryInformationOnly: true,
    };
  };

  if (!providerSymbol || !timeframe) return empty("BLOCKED", "identity required");
  if (!gate.present || gate.qualityStatus === "BLOCKED" || gate.qualityStatus === "MISSING") {
    return empty("BLOCKED", `quality ${gate.qualityStatus}`);
  }

  const adapted = mifCandlesToStructureCandles({
    candles: input.candles,
    providerSymbol,
    timeframe,
  });
  if (adapted.blocking || !adapted.ok) {
    return empty("INSUFFICIENT_DATA", adapted.issues[0]?.message ?? "adapter blocked");
  }

  const swings = detectSwings(
    adapted.structureCandles,
    adapted.closedCount,
    params,
    false,
  );
  const zones = buildStructureZones(
    adapted.structureCandles,
    adapted.closedCount,
    swings,
    params,
  );

  if (zones.length === 0) {
    return empty("INSUFFICIENT_DATA", "fewer than 2 confirmed swings for zone clustering");
  }

  const boundaries: MifBoundaryLevel[] = zones.map((z) => ({
    boundaryId: z.id,
    kind: z.kind,
    low: z.low,
    high: z.high,
    mid: z.mid,
    sourceSwingIds: z.sourceSwingIds,
    touchCount: z.touchCount,
    lifecycle:
      z.status === "BROKEN" ? "BROKEN" : z.status === "STALE" ? "STALE" : "ACTIVE",
    lastTouchOpenTimeSec:
      z.lastTouchIndex >= 0 && adapted.structureCandles[z.lastTouchIndex]
        ? adapted.structureCandles[z.lastTouchIndex]!.time
        : null,
  }));

  const active = boundaries.filter((b) => b.lifecycle === "ACTIVE");
  const primaryBoundary =
    active.sort((a, b) => b.touchCount - a.touchCount)[0]
    ?? boundaries[0]
    ?? null;

  let status: MifSupportResistanceStatus = "VALID";
  if (gate.qualityStatus === "WARNING") status = "WARNING";
  if (gate.qualityStatus === "DEGRADED") status = "DEGRADED";
  if (active.length === 0) status = "WARNING";

  const id = idHash({
    contractId: MIF_SUPPORT_RESISTANCE_CONTRACT_ID,
    providerSymbol,
    timeframe,
    boundaryIds: boundaries.map((b) => b.boundaryId),
    structureRef: input.marketStructure?.assessmentId ?? null,
  });

  return {
    contractId: MIF_SUPPORT_RESISTANCE_CONTRACT_ID,
    contractVersion: MIF_SUPPORT_RESISTANCE_CONTRACT_VERSION,
    scope: "phase5d6-support-resistance",
    assessmentId: input.assessmentId ?? `sr:${id.slice(0, 16)}`,
    inputIdentity: id,
    providerId: MIF_PROVIDER_ID,
    providerSymbol,
    timeframe,
    instrument,
    policyId: MIF_SUPPORT_RESISTANCE_POLICY_ID,
    policyVersion: MIF_SUPPORT_RESISTANCE_POLICY_VERSION,
    engineId: MIF_SUPPORT_RESISTANCE_ENGINE_ID,
    engineVersion: MIF_SUPPORT_RESISTANCE_ENGINE_VERSION,
    assessmentTimestamp,
    status,
    boundaries,
    primaryBoundary,
    qualityRef,
    diagnosticsSummary: `boundaries=${boundaries.length}; active=${active.length}`,
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    analyticalBoundaryInformationOnly: true,
  };
}
