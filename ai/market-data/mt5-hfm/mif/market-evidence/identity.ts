/**
 * Phase 2 — deterministic evidence identity helpers.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import type { MifEvidenceType } from "./types.js";

export function hashEvidencePayload(payload: unknown): string {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

export function buildEvidenceId(parts: {
  sourceEngine: string;
  evidenceType: MifEvidenceType;
  providerSymbol: string;
  timeframe: string | null;
  sourceAssessmentId: string | null;
  sourceCandidateId: string | null;
  sourceFingerprint: string;
  snapshotId: string | null;
}): string {
  const key = [
    parts.sourceEngine,
    parts.evidenceType,
    parts.providerSymbol,
    parts.timeframe ?? "",
    parts.sourceAssessmentId ?? "",
    parts.sourceCandidateId ?? "",
    parts.snapshotId ?? "",
    parts.sourceFingerprint,
  ].join("|");
  return `ume:${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
}

export function buildPackageId(parts: {
  providerSymbol: string;
  analysisId: string | null;
  runId: string | null;
  snapshotId: string | null;
  itemFingerprints: readonly string[];
}): string {
  const key = {
    providerSymbol: parts.providerSymbol,
    analysisId: parts.analysisId,
    runId: parts.runId,
    snapshotId: parts.snapshotId,
    fingerprints: [...parts.itemFingerprints].sort(),
  };
  return `umep:${hashEvidencePayload(key).slice(0, 24)}`;
}
