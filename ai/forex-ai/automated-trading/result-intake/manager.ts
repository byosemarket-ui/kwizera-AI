/**
 * Phase 4.18G.1 — Ingest canonical analysis into result-intake store.
 * Automatic after scheduled/manual canonical runs. Never mutates broker.
 */
import { randomUUID } from "node:crypto";
import { ANALYSIS_CONFIDENCE_TYPE } from "../analysis/canonical-analysis.types.js";
import type { CanonicalAnalysisResult } from "../analysis/canonical-analysis.types.js";
import { getAtSystemMasterStore } from "../system-master/store.js";
import { toOrderPreparationHandoff } from "./handoff.js";
import {
  getAtResultIntakeStore,
  type AtResultIntakeStore,
} from "./store.js";
import {
  AT_RESULT_INTAKE_DEFAULT_MAX_AGE_MS,
  AT_RESULT_INTAKE_PHASE,
  AT_RESULT_INTAKE_SCHEMA,
  type AtResultIntakeEnrichment,
  type AtResultIntakePublicStatus,
  type AtResultIntakeRecord,
} from "./types.js";
import {
  mapCanonicalToDecision,
  resultIntakeIdempotencyKey,
  validateCanonicalForIntake,
} from "./validate.js";

export interface IngestCanonicalResultInput {
  result: CanonicalAnalysisResult;
  enrichment?: AtResultIntakeEnrichment | null;
  nowMs?: number;
  maxAgeMs?: number;
  /** When true, skip System Master gate (unit tests only). */
  bypassSystemMasterGate?: boolean;
  /** Soft: observation/image optional unless require* set. */
  requireObservation?: boolean;
  requireImage?: boolean;
  store?: AtResultIntakeStore;
}

export interface IngestCanonicalResultOutput {
  ok: boolean;
  duplicate: boolean;
  skipped: boolean;
  record: AtResultIntakeRecord | null;
  handoff: ReturnType<typeof toOrderPreparationHandoff>;
  placesOrders: false;
  acceptsForExecution: false;
  mutatesBroker: false;
}

function buildRejectedShell(
  result: CanonicalAnalysisResult | null,
  enrichment: AtResultIntakeEnrichment | null | undefined,
  validationStatus: AtResultIntakeRecord["validationStatus"],
  rejectionReason: string,
  intakeLifecycle: AtResultIntakeRecord["intakeLifecycle"],
  nowIso: string,
): AtResultIntakeRecord {
  const analysisId = result?.analysisId ?? `missing-${randomUUID()}`;
  const fp = result?.evidenceFingerprint ?? "none";
  const mapped = result
    ? mapCanonicalToDecision(result)
    : { decision: "NO_TRADE" as const, canonicalDecision: "NO_TRADE" as const };
  return {
    schemaVersion: AT_RESULT_INTAKE_SCHEMA,
    phase: AT_RESULT_INTAKE_PHASE,
    resultId: randomUUID(),
    idempotencyKey: resultIntakeIdempotencyKey(analysisId, fp),
    analysisId,
    observationId: enrichment?.observationId ?? null,
    imageId: enrichment?.imageId ?? null,
    imageHash: enrichment?.imageHash ?? null,
    instrument: result?.instrument ?? "",
    provider: "FOREXCONNECT",
    environment: result?.environment ?? "DEMO",
    modelIdentifier: enrichment?.modelIdentifier ?? null,
    primaryTimeframe: result?.primaryTimeframe ?? "",
    timeframeCoverage: enrichment?.timeframeCoverage ?? (result?.primaryTimeframe ? [result.primaryTimeframe] : []),
    analyzedAtUtc: result?.analyzedAtUtc ?? nowIso,
    receivedAtUtc: nowIso,
    decision: mapped.decision,
    canonicalOutcome: result?.finalOutcome ?? "INSUFFICIENT_DATA",
    aiDirection: result?.ai?.direction ?? null,
    strategyDirection: result?.deterministic?.direction ?? null,
    canonicalDecision: mapped.canonicalDecision,
    reconciliationStatus: result?.reconciliationCode ?? "UNKNOWN",
    validationStatus,
    intakeLifecycle,
    directionalConfidencePct: result?.confidencePct ?? null,
    confidenceType: ANALYSIS_CONFIDENCE_TYPE,
    isCalibratedWinProbability: false,
    confidenceBreakdown: result?.confidenceBreakdown ?? null,
    confidenceLimitations: result?.confidenceLimitations ?? [],
    analysisReasons: result?.explanation?.slice(0, 12) ?? [],
    supportingEvidence: enrichment?.supportingEvidence?.slice(0, 12) ?? [],
    conflictingEvidence: enrichment?.conflictingEvidence?.slice(0, 12) ?? [],
    marketTrend: result?.marketStructure?.trendDirection?.value ?? null,
    marketMomentum: result?.marketStructure?.momentum?.value ?? null,
    volatility: result?.marketStructure?.volatilityRegime?.value ?? null,
    mtfAlignment: result?.htf?.agreement ?? null,
    marketStructure: result?.marketStructure?.trendStrength?.value ?? null,
    invalidationConditions: enrichment?.invalidationConditions?.slice(0, 8) ?? [],
    sourceProvenance: [
      "canonical_reconciler",
      result?.ai?.analysisId ? "openai_advisory" : "deterministic_only",
    ],
    imageSource: enrichment?.imageSource ?? null,
    imageDeliveryStatus: enrichment?.imageDeliveryStatus ?? null,
    includedImageBytesInRequest: enrichment?.includedImageBytesInRequest ?? null,
    observationCorrelated: enrichment?.observationId ? true : null,
    imageHashVerified:
      enrichment?.expectedImageHash && enrichment?.imageHash
        ? enrichment.expectedImageHash === enrichment.imageHash
        : enrichment?.imageHash
          ? true
          : null,
    noTradeReason:
      mapped.decision === "NO_TRADE"
        ? (result?.reconciliationCode ?? result?.finalOutcome ?? rejectionReason)
        : null,
    rejectionReason,
    supersededByResultId: null,
    supersedesResultId: null,
    expiresAtUtc: null,
    eligibleForOrderPreparation: false,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };
}

export async function ingestCanonicalAnalysisResult(
  input: IngestCanonicalResultInput,
): Promise<IngestCanonicalResultOutput> {
  const nowMs = input.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const store = input.store ?? getAtResultIntakeStore();
  const enrichment = input.enrichment ?? null;

  const safety = {
    placesOrders: false as const,
    acceptsForExecution: false as const,
    mutatesBroker: false as const,
  };

  if (!input.bypassSystemMasterGate) {
    try {
      const master = getAtSystemMasterStore().get();
      if (master.ownerState !== "ON" || master.masterEnabled !== true) {
        const shell = buildRejectedShell(
          input.result,
          enrichment,
          "SYSTEM_MASTER_OFF",
          "System Master OFF — new result intake skipped; history preserved.",
          "REJECTED",
          nowIso,
        );
        // Do not persist skipped OFF intakes as history noise.
        return {
          ok: false,
          duplicate: false,
          skipped: true,
          record: shell,
          handoff: null,
          ...safety,
        };
      }
    } catch {
      // Fail closed if master store unavailable.
      return {
        ok: false,
        duplicate: false,
        skipped: true,
        record: null,
        handoff: null,
        ...safety,
      };
    }
  }

  const gate = validateCanonicalForIntake(input.result, enrichment, {
    nowMs,
    maxAgeMs: input.maxAgeMs ?? AT_RESULT_INTAKE_DEFAULT_MAX_AGE_MS,
    requireObservation: input.requireObservation,
    requireImage: input.requireImage,
  });

  if (!gate.ok) {
    const lifecycle =
      gate.validationStatus === "STALE_ANALYSIS"
        ? "EXPIRED"
        : gate.validationStatus === "INVALID_SCHEMA"
          || gate.validationStatus === "MISSING_IDENTITY"
          || gate.validationStatus === "IMAGE_HASH_MISMATCH"
          ? "QUARANTINED"
          : "REJECTED";
    const shell = buildRejectedShell(
      input.result,
      enrichment,
      gate.validationStatus,
      gate.rejectionReason ?? "Validation failed.",
      lifecycle,
      nowIso,
    );
    const saved = await store.save(shell);
    return {
      ok: false,
      duplicate: saved.duplicate,
      skipped: false,
      record: saved.record,
      handoff: null,
      ...safety,
    };
  }

  const result = input.result;
  const idempotencyKey = resultIntakeIdempotencyKey(result.analysisId, result.evidenceFingerprint);
  const existing = store.getByIdempotencyKey(idempotencyKey);
  if (existing) {
    return {
      ok: existing.intakeLifecycle === "ACCEPTED",
      duplicate: true,
      skipped: false,
      record: {
        ...existing,
        intakeLifecycle:
          existing.intakeLifecycle === "ACCEPTED" ? existing.intakeLifecycle : "DUPLICATE",
        validationStatus: "DUPLICATE",
      },
      handoff: toOrderPreparationHandoff(existing, { nowMs }),
      ...safety,
    };
  }

  const mapped = mapCanonicalToDecision(result);
  const expiresAtUtc = new Date(
    Date.parse(result.analyzedAtUtc) + (input.maxAgeMs ?? AT_RESULT_INTAKE_DEFAULT_MAX_AGE_MS),
  ).toISOString();

  const eligibleForOrderPreparation =
    mapped.canonicalDecision === "BUY" || mapped.canonicalDecision === "SELL";

  const htfCoverage = result.htf?.confirmationTimeframes?.map(String) ?? [];
  const timeframeCoverage = Array.from(
    new Set([
      result.primaryTimeframe,
      ...htfCoverage,
      ...(enrichment?.timeframeCoverage ?? []),
    ]),
  );

  const record: AtResultIntakeRecord = {
    schemaVersion: AT_RESULT_INTAKE_SCHEMA,
    phase: AT_RESULT_INTAKE_PHASE,
    resultId: randomUUID(),
    idempotencyKey,
    analysisId: result.analysisId,
    observationId: enrichment?.observationId ?? null,
    imageId: enrichment?.imageId ?? null,
    imageHash: enrichment?.imageHash ?? null,
    instrument: result.instrument,
    provider: "FOREXCONNECT",
    environment: result.environment,
    modelIdentifier: enrichment?.modelIdentifier ?? null,
    primaryTimeframe: result.primaryTimeframe,
    timeframeCoverage,
    analyzedAtUtc: result.analyzedAtUtc,
    receivedAtUtc: nowIso,
    decision: mapped.decision,
    canonicalOutcome: result.finalOutcome,
    aiDirection: result.ai?.direction ?? null,
    strategyDirection: result.deterministic?.direction ?? null,
    canonicalDecision: mapped.canonicalDecision,
    reconciliationStatus: result.reconciliationCode,
    validationStatus: "VALID",
    intakeLifecycle: "ACCEPTED",
    directionalConfidencePct: result.confidencePct,
    confidenceType: ANALYSIS_CONFIDENCE_TYPE,
    isCalibratedWinProbability: false,
    confidenceBreakdown: result.confidenceBreakdown,
    confidenceLimitations: result.confidenceLimitations ?? [],
    analysisReasons: (result.explanation ?? []).slice(0, 12),
    supportingEvidence: (enrichment?.supportingEvidence ?? result.deterministic?.reasons ?? []).slice(0, 12),
    conflictingEvidence: (enrichment?.conflictingEvidence ?? []).slice(0, 12),
    marketTrend: result.marketStructure?.trendDirection?.value ?? null,
    marketMomentum: result.marketStructure?.momentum?.value ?? null,
    volatility: result.marketStructure?.volatilityRegime?.value ?? null,
    mtfAlignment: result.htf?.agreement ?? null,
    marketStructure: result.marketStructure?.trendStrength?.value ?? null,
    invalidationConditions: (enrichment?.invalidationConditions ?? []).slice(0, 8),
    sourceProvenance: [
      "canonical_reconciler",
      result.ai?.analysisId ? "openai_advisory" : "deterministic_only",
      `recon:${result.reconciliationCode}`,
    ],
    imageSource: enrichment?.imageSource ?? null,
    imageDeliveryStatus: enrichment?.imageDeliveryStatus ?? null,
    includedImageBytesInRequest: enrichment?.includedImageBytesInRequest ?? null,
    observationCorrelated: enrichment?.observationId ? true : null,
    imageHashVerified:
      enrichment?.expectedImageHash && enrichment?.imageHash
        ? enrichment.expectedImageHash === enrichment.imageHash
        : enrichment?.imageHash
          ? true
          : null,
    noTradeReason:
      mapped.decision === "NO_TRADE"
        ? [
            result.reconciliationCode,
            result.finalOutcome,
            ...(result.deterministic?.reasons ?? []).slice(0, 3),
          ].filter(Boolean).join(" · ")
        : null,
    rejectionReason: null,
    supersededByResultId: null,
    supersedesResultId: null,
    expiresAtUtc,
    eligibleForOrderPreparation,
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
  };

  const saved = await store.save(record);

  // Phase 2 — auto proposal/handoff/precheck for eligible ACCEPTED intakes only.
  if (
    !saved.duplicate
    && saved.record.intakeLifecycle === "ACCEPTED"
    && saved.record.eligibleForOrderPreparation
  ) {
    try {
      const { invokePhase2DownstreamHook } = await import("../phase2-pipeline.js");
      const generation = getAtSystemMasterStore().getAnalysisGeneration();
      invokePhase2DownstreamHook({
        record: saved.record,
        analysisGeneration: generation,
      });
    } catch {
      /* hook registration optional during unit tests */
    }
  }

  return {
    ok: saved.record.intakeLifecycle === "ACCEPTED",
    duplicate: saved.duplicate,
    skipped: false,
    record: saved.record,
    handoff: toOrderPreparationHandoff(saved.record, { nowMs }),
    ...safety,
  };
}

export function getResultIntakePublicStatus(
  store?: AtResultIntakeStore,
): AtResultIntakePublicStatus {
  const s = store ?? getAtResultIntakeStore();
  const latest = s.latest();
  return {
    phase: AT_RESULT_INTAKE_PHASE,
    schemaVersion: AT_RESULT_INTAKE_SCHEMA,
    latest,
    historyCount: s.count(),
    acceptedDirectionalCount: s.countAcceptedDirectional(),
    latestHandoff: toOrderPreparationHandoff(latest),
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "AI analysis result intake only. BUY/SELL are order-preparation candidates — never broker orders.",
  };
}
