/**
 * Phase 4.18G.1 — Read-only order-preparation handoff (no quantity / no broker).
 */
import type { AtOrderPreparationHandoff, AtResultIntakeRecord } from "./types.js";

export function toOrderPreparationHandoff(
  record: AtResultIntakeRecord | null | undefined,
  opts?: { nowMs?: number },
): AtOrderPreparationHandoff | null {
  if (!record) return null;
  if (record.intakeLifecycle !== "ACCEPTED") return null;
  if (!record.eligibleForOrderPreparation) return null;
  if (record.canonicalDecision !== "BUY" && record.canonicalDecision !== "SELL") return null;
  if (record.decision !== "BUY" && record.decision !== "SELL") return null;

  const nowMs = opts?.nowMs ?? Date.now();
  if (record.expiresAtUtc) {
    const exp = Date.parse(record.expiresAtUtc);
    if (Number.isFinite(exp) && nowMs > exp) return null;
  }

  return {
    acceptedResultId: record.resultId,
    analysisId: record.analysisId,
    instrument: record.instrument,
    canonicalDirection: record.canonicalDecision,
    directionalConfidencePct: record.directionalConfidencePct,
    confidenceType: record.confidenceType,
    isCalibratedWinProbability: false,
    observationId: record.observationId,
    imageId: record.imageId,
    imageHash: record.imageHash,
    analyzedAtUtc: record.analyzedAtUtc,
    resultExpiresAtUtc: record.expiresAtUtc,
    validationStatus: record.validationStatus,
    intakeLifecycle: "ACCEPTED",
    evidenceReferences: {
      reconciliationStatus: record.reconciliationStatus,
      canonicalOutcome: record.canonicalOutcome,
      primaryTimeframe: record.primaryTimeframe,
      mtfAlignment: record.mtfAlignment,
    },
    placesOrders: false,
    acceptsForExecution: false,
    mutatesBroker: false,
    note:
      "Order-preparation candidate only. Not a broker order. Quantity/SL/TP/margin calculated in a later stage.",
  };
}
