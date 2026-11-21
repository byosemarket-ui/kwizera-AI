/**
 * Build evidence linkage only from explicit genuine IDs — never infer from proximity.
 */
import { createHash } from "node:crypto";
import { stableSerialize } from "../quality/stable-identity.js";
import {
  MIF_EVIDENCE_LINKAGE_CONTRACT_ID,
  MIF_EVIDENCE_LINKAGE_CONTRACT_VERSION,
} from "./contracts.js";
import type { MifEvidenceLinkageRecord, MifEvidenceLinkageStatus } from "./types.js";

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(stableSerialize(payload)).digest("hex");
}

export function buildEvidenceLinkage(input: {
  searchId?: string | null;
  analogueId?: string | null;
  predictionId?: string | null;
  assessmentId?: string | null;
  freezeId?: string | null;
  searchHash?: string | null;
  snapshotHash?: string | null;
  freezeHash?: string | null;
  createdAt?: string;
  /** Explicit unavailable marker when no relationship exists. */
  markUnavailable?: boolean;
  unavailableReason?: string | null;
}):
  | { ok: true; linkage: MifEvidenceLinkageRecord }
  | { ok: false; code: string; message: string } {
  const searchId = input.searchId?.trim() || null;
  const analogueId = input.analogueId?.trim() || null;
  const predictionId = input.predictionId?.trim() || null;
  const assessmentId = input.assessmentId?.trim() || null;
  const freezeId = input.freezeId?.trim() || null;

  if (input.markUnavailable) {
    const body = {
      status: "LINKAGE_UNAVAILABLE" as const,
      searchId,
      analogueId,
      predictionId,
      assessmentId,
      freezeId,
    };
    const linkageHash = hashPayload(body);
    const linkage: MifEvidenceLinkageRecord = {
      contractId: MIF_EVIDENCE_LINKAGE_CONTRACT_ID,
      contractVersion: MIF_EVIDENCE_LINKAGE_CONTRACT_VERSION,
      linkageId: `elink:${linkageHash.slice(0, 28)}`,
      linkageHash,
      status: "LINKAGE_UNAVAILABLE",
      statusReason: input.unavailableReason ?? "LINKAGE_UNAVAILABLE",
      searchId,
      analogueId,
      predictionId,
      assessmentId,
      freezeId,
      providerId: "HFM_MT5",
      createdAt: input.createdAt ?? "1970-01-01T00:00:00.000Z",
      sourceVersions: {
        searchHash: input.searchHash ?? null,
        snapshotHash: input.snapshotHash ?? null,
        freezeHash: input.freezeHash ?? null,
      },
      placesOrders: false,
      mutatesBroker: false,
      acceptsForExecution: false,
      doesNotApproveAiReasoning: true,
      neverInferredFromProximity: true,
    };
    return { ok: true, linkage };
  }

  // Genuine LINKED requires at least (searchId+analogueId) OR predictionId with one of assessment/freeze
  const hasAnalogue = Boolean(searchId && analogueId);
  const hasPredictionSide = Boolean(predictionId && (assessmentId || freezeId));
  if (!hasAnalogue && !hasPredictionSide) {
    return {
      ok: false,
      code: "INSUFFICIENT_IDS",
      message:
        "LINKED requires genuine (searchId+analogueId) and/or (predictionId with assessmentId or freezeId); never invent from proximity",
    };
  }
  if ((searchId && !analogueId) || (!searchId && analogueId)) {
    return {
      ok: false,
      code: "CONFLICT",
      message: "searchId and analogueId must both be present or both absent",
    };
  }

  let status: MifEvidenceLinkageStatus = "LINKED";
  let statusReason: string | null = null;
  if (hasAnalogue && hasPredictionSide) {
    status = "LINKED";
  } else if (hasAnalogue || hasPredictionSide) {
    status = "LINKED";
    statusReason = "partial_side_link_explicit";
  }

  const body = {
    status,
    searchId,
    analogueId,
    predictionId,
    assessmentId,
    freezeId,
    searchHash: input.searchHash ?? null,
    snapshotHash: input.snapshotHash ?? null,
    freezeHash: input.freezeHash ?? null,
  };
  const linkageHash = hashPayload(body);
  const linkage: MifEvidenceLinkageRecord = {
    contractId: MIF_EVIDENCE_LINKAGE_CONTRACT_ID,
    contractVersion: MIF_EVIDENCE_LINKAGE_CONTRACT_VERSION,
    linkageId: `elink:${linkageHash.slice(0, 28)}`,
    linkageHash,
    status,
    statusReason,
    searchId,
    analogueId,
    predictionId,
    assessmentId,
    freezeId,
    providerId: "HFM_MT5",
    createdAt: input.createdAt ?? "1970-01-01T00:00:00.000Z",
    sourceVersions: {
      searchHash: input.searchHash ?? null,
      snapshotHash: input.snapshotHash ?? null,
      freezeHash: input.freezeHash ?? null,
    },
    placesOrders: false,
    mutatesBroker: false,
    acceptsForExecution: false,
    doesNotApproveAiReasoning: true,
    neverInferredFromProximity: true,
  };
  return { ok: true, linkage };
}
